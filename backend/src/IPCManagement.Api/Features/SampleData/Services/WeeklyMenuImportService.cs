using System.Security.Cryptography;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Caching;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuImportService(
    IpcManagementContext context,
    WeeklyMenuCustomerResolver customerResolver,
    WeeklyMenuImportResultBuilder resultBuilder,
    WeeklyMenuImportPersistence persistence,
    IEfTransactionRunner transactionRunner,
    IMemoryCache cache) : IWeeklyMenuImportService
{
    private static readonly decimal[] WeeklyMenuPriceTiers = [25000m, 30000m, 34000m];
    private readonly XlsxWorkbookReader _reader = new();

    public async Task<WeeklyMenuImportResultDto> PreviewWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        CancellationToken cancellationToken = default)
    {
        var customer = await customerResolver.TryResolveAsync(customerId, cancellationToken);
        if (customer is null)
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                customerId,
                "UNKNOWN_CUSTOMER",
                "Không tìm thấy khách hàng đang hoạt động để import thực đơn.",
                "customerId");
        }

        var normalizedPriceTier = NormalizeWeeklyMenuPriceTier(priceTierAmount);
        var mapping = ResolveCustomerImportMapping(
            await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken),
            customer.CustomerCode);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = WeeklyMenuWorkbookParser.Parse(
                _reader,
                tempFilePath,
                fileName,
                weekStartDate,
                mapping,
                normalizedPriceTier);
            return await resultBuilder.BuildAsync(plan, customer, committed: false, cancellationToken);
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId),
                "FILE_READ_ERROR",
                WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage,
                "file");
        }
        catch (BusinessRuleException ex)
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId),
                WeeklyMenuImportValidationPolicy.ResolveCode(ex.Message),
                ex.Message,
                WeeklyMenuImportValidationPolicy.ResolveField(ex.Message));
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    public async Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var customer = await customerResolver.ResolveAsync(customerId, cancellationToken);
        var normalizedPriceTier = NormalizeWeeklyMenuPriceTier(priceTierAmount);
        var mapping = ResolveCustomerImportMapping(
            await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken),
            customer.CustomerCode);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = WeeklyMenuWorkbookParser.Parse(
                _reader,
                tempFilePath,
                fileName,
                weekStartDate,
                mapping,
                normalizedPriceTier);
            plan.SourceChecksum = ComputeFileChecksum(tempFilePath);
            var validationResult = await resultBuilder.BuildAsync(
                plan,
                customer,
                committed: false,
                cancellationToken);
            if (validationResult.Validation.HasCriticalErrors)
            {
                var firstIssue = validationResult.Validation.Issues.FirstOrDefault(item =>
                    string.Equals(item.Severity, "error", StringComparison.OrdinalIgnoreCase));
                throw new BusinessRuleException(
                    firstIssue?.Message ?? "File import còn lỗi critical, không thể commit DB.");
            }

            WeeklyMenuImportResultDto? committedResult = null;
            var result = await transactionRunner.ExecuteAsync(
                async token =>
                {
                    committedResult = await persistence.CommitAsync(
                        plan,
                        customer,
                        normalizedPriceTier,
                        actorUserId,
                        token);
                    await context.SaveChangesAsync(token);
                    return committedResult;
                },
                async token =>
                {
                    var menuVersionId = GuidHelper.ParseGuidString(committedResult?.MenuVersionId);
                    return menuVersionId is not null &&
                           await context.Menuversions
                               .AsNoTracking()
                               .AnyAsync(
                                   version =>
                                       version.MenuVersionId == menuVersionId &&
                                       version.SourceChecksum == plan.SourceChecksum,
                                   token);
                },
                cancellationToken: cancellationToken);
            DishCatalogCache.Clear(cache);
            return result;
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            throw new BusinessRuleException(WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage, ex);
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    private Task<CustomerImportMapping?> FindCustomerImportMappingAsync(
        byte[] customerId,
        CancellationToken cancellationToken)
        => context.Customerimportmappings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CustomerId.SequenceEqual(customerId),
                cancellationToken);

    private static CustomerImportMapping ResolveCustomerImportMapping(
        CustomerImportMapping? mapping,
        string customerCode)
        => !string.IsNullOrWhiteSpace(mapping?.SheetNameHint)
            ? mapping
            : new CustomerImportMapping
            {
                SheetNameHint = customerCode,
                LabelColumn = mapping?.LabelColumn
            };

    private static decimal NormalizeWeeklyMenuPriceTier(decimal? priceTierAmount)
    {
        if (priceTierAmount is null)
        {
            throw new BusinessRuleException(
                "Vui lòng chọn định mức 25.000, 30.000 hoặc 34.000 trước khi import menu.");
        }

        var normalized = DecimalPolicy.RoundMoney(priceTierAmount.Value);
        if (!Array.Exists(WeeklyMenuPriceTiers, tier => tier == normalized))
        {
            throw new BusinessRuleException(
                "Định mức import menu chỉ được chọn 25.000, 30.000 hoặc 34.000.");
        }

        return normalized;
    }

    private static string ComputeFileChecksum(string filePath)
        => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(filePath)));

    private static async Task<string> SaveTempWorkbookAsync(
        Stream fileStream,
        CancellationToken cancellationToken)
    {
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        await using var fileOut = new FileStream(
            tempFilePath,
            FileMode.CreateNew,
            FileAccess.Write);
        await fileStream.CopyToAsync(fileOut, cancellationToken);
        return tempFilePath;
    }

    private static void DeleteTempWorkbook(string tempFilePath)
    {
        if (File.Exists(tempFilePath))
        {
            File.Delete(tempFilePath);
        }
    }
}
