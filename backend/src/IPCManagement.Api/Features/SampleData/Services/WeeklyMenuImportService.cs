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
    IWeeklyMenuImportPersistence persistence,
    WeeklyMenuImportPreviewTicketStore previewTicketStore,
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
            plan.SourceChecksum = ComputeFileChecksum(tempFilePath);
            var result = await resultBuilder.BuildAsync(plan, customer, committed: false, cancellationToken);
            result.SourceChecksum = plan.SourceChecksum;
            if (!result.Validation.HasCriticalErrors)
            {
                var ticket = previewTicketStore.Issue(
                    plan.SourceChecksum,
                    GuidHelper.ToGuidString(customer.CustomerId),
                    plan.WeekStartDate,
                    normalizedPriceTier);
                result.PreviewToken = ticket.Token;
                result.PreviewExpiresAt = ticket.ExpiresAt;
            }
            return result;
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
        string? previewToken,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var prepared = await PrepareCommitAsync(
                new WeeklyMenuImportBatchItem(
                    fileStream,
                    fileName,
                    customerId,
                    weekStartDate,
                    priceTierAmount,
                    previewToken),
                cancellationToken);
            var results = await CommitPreparedBatchAsync([prepared], actorUserId, cancellationToken);
            return results[0];
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            throw new BusinessRuleException(WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage, ex);
        }
    }

    public async Task<IReadOnlyList<WeeklyMenuImportResultDto>> CommitWeeklyMenuImportBatchAsync(
        IReadOnlyList<WeeklyMenuImportBatchItem> items,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (items.Count < 2)
        {
            throw new ArgumentException("Batch import cần ít nhất hai file thực đơn.");
        }

        try
        {
            var prepared = new List<PreparedWeeklyMenuImport>(items.Count);
            foreach (var item in items)
            {
                prepared.Add(await PrepareCommitAsync(item, cancellationToken));
            }

            return await CommitPreparedBatchAsync(prepared, actorUserId, cancellationToken);
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            throw new BusinessRuleException(WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage, ex);
        }
    }

    private async Task<PreparedWeeklyMenuImport> PrepareCommitAsync(
        WeeklyMenuImportBatchItem item,
        CancellationToken cancellationToken)
    {
        var customer = await customerResolver.ResolveAsync(item.CustomerId, cancellationToken);
        var normalizedPriceTier = NormalizeWeeklyMenuPriceTier(item.PriceTierAmount);
        var mapping = ResolveCustomerImportMapping(
            await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken),
            customer.CustomerCode);
        var tempFilePath = await SaveTempWorkbookAsync(item.FileStream, cancellationToken);
        try
        {
            var plan = WeeklyMenuWorkbookParser.Parse(
                _reader,
                tempFilePath,
                item.FileName,
                item.WeekStartDate,
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
                var firstIssue = validationResult.Validation.Issues.FirstOrDefault(issue =>
                    string.Equals(issue.Severity, "error", StringComparison.OrdinalIgnoreCase));
                throw new BusinessRuleException(
                    firstIssue?.Message ?? "File import còn lỗi critical, không thể commit DB.");
            }

            return new PreparedWeeklyMenuImport(
                plan,
                customer,
                normalizedPriceTier,
                item.PreviewToken);
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    internal async Task<IReadOnlyList<WeeklyMenuImportResultDto>> CommitPreparedBatchAsync(
        IReadOnlyList<PreparedWeeklyMenuImport> prepared,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var duplicateScope = prepared
            .GroupBy(item => $"{GuidHelper.ToGuidString(item.Customer.CustomerId)}|{item.Plan.WeekStartDate:yyyy-MM-dd}")
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicateScope is not null)
        {
            throw new BusinessRuleException(
                "Batch import có trùng khách hàng và tuần. Vui lòng chỉ giữ một file cho mỗi phạm vi.");
        }

        foreach (var item in prepared)
        {
            previewTicketStore.Validate(
                item.PreviewToken,
                item.Plan.SourceChecksum!,
                GuidHelper.ToGuidString(item.Customer.CustomerId),
                item.Plan.WeekStartDate,
                item.PriceTierAmount);
        }

        List<WeeklyMenuImportResultDto> committedResults = [];
        try
        {
            var results = await transactionRunner.ExecuteAsync(
                async token =>
                {
                    committedResults = [];
                    foreach (var item in prepared)
                    {
                        try
                        {
                            committedResults.Add(await persistence.CommitAsync(
                                item.Plan,
                                item.Customer,
                                item.PriceTierAmount,
                                actorUserId,
                                token));
                            await context.SaveChangesAsync(token);
                        }
                        catch (BusinessRuleException ex) when (prepared.Count > 1)
                        {
                            throw new BusinessRuleException(
                                $"Batch thất bại tại khách hàng {item.Customer.CustomerCode}: {ex.Message} " +
                                "Không file nào trong batch được lưu.",
                                ex);
                        }
                    }

                    return (IReadOnlyList<WeeklyMenuImportResultDto>)committedResults.ToList();
                },
                async token =>
                {
                    if (committedResults.Count != prepared.Count)
                    {
                        return false;
                    }

                    for (var index = 0; index < committedResults.Count; index++)
                    {
                        var menuVersionId = GuidHelper.ParseGuidString(committedResults[index].MenuVersionId);
                        if (menuVersionId is null ||
                            !await context.Menuversions.AsNoTracking().AnyAsync(
                                version =>
                                    version.MenuVersionId == menuVersionId &&
                                    version.SourceChecksum == prepared[index].Plan.SourceChecksum,
                                token))
                        {
                            return false;
                        }
                    }

                    return true;
                },
                cancellationToken: cancellationToken);

            DishCatalogCache.Clear(cache);
            foreach (var item in prepared)
            {
                previewTicketStore.Consume(item.PreviewToken!);
            }

            return results;
        }
        catch
        {
            context.ChangeTracker.Clear();
            throw;
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

internal sealed record PreparedWeeklyMenuImport(
    WeeklyMenuImportPlan Plan,
    Customer Customer,
    decimal PriceTierAmount,
    string? PreviewToken);
