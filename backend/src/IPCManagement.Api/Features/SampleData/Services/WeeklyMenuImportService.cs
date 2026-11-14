using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure;
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
    IMemoryCache cache,
    SystemOperationRequestContext? operationContext = null,
    IMrxSourceChangeGateway? mrxGateway = null) : IWeeklyMenuImportService
{
    private readonly IMrxSourceChangeGateway sourceChangeGateway = mrxGateway
        ?? MrxSourceChangeGatewayFactory.Create(context, transactionRunner, operationContext);
    private static readonly decimal[] WeeklyMenuPriceTiers = MenuPriceTierPolicy.SupportedPriceTiers;
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
                customerId, weekStartDate,
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
            var result = await PreviewPreparedAsync(plan, customer, normalizedPriceTier, cancellationToken);
            result.SourceChecksum = plan.SourceChecksum;
            if (!result.Validation.HasCriticalErrors)
            {
                var ticket = previewTicketStore.Issue(
                    plan.SourceChecksum,
                    GuidHelper.ToGuidString(customer.CustomerId),
                    plan.WeekStartDate,
                    normalizedPriceTier,
                    WeeklyMenuWorkbookParser.ParserVersion);
                result.PreviewToken = ticket.Token;
                result.PreviewExpiresAt = ticket.ExpiresAt;
            }
            return result;
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId), weekStartDate,
                "FILE_READ_ERROR",
                WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage,
                "file");
        }
        catch (BusinessRuleException ex)
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId), weekStartDate,
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
        CancellationToken cancellationToken = default,
        IReadOnlyCollection<string>? actorRoles = null)
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
            return await CommitPreparedSingleAsync(
                prepared,
                actorUserId,
                actorRoles ?? [],
                cancellationToken);
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
            var validationResult = await PreviewPreparedAsync(
                plan,
                customer,
                normalizedPriceTier,
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

    internal async Task<WeeklyMenuImportResultDto> PreviewPreparedAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        decimal priceTierAmount,
        CancellationToken cancellationToken)
    {
        var result = await resultBuilder.BuildAsync(plan, customer, committed: false, cancellationToken);
        var analysis = await AnalyzeMrxReimportAsync(plan, customer, priceTierAmount, cancellationToken);
        result.MrxDayOutcomes = analysis?.Outcomes;
        return result;
    }

    internal async Task<WeeklyMenuImportResultDto> CommitPreparedSingleAsync(
        PreparedWeeklyMenuImport prepared,
        string? actorUserId,
        IReadOnlyCollection<string> actorRoles,
        CancellationToken cancellationToken)
    {
        var preview = await PreviewPreparedAsync(prepared.Plan, prepared.Customer, prepared.PriceTierAmount, cancellationToken);
        var analysis = await AnalyzeMrxReimportAsync(prepared.Plan, prepared.Customer, prepared.PriceTierAmount, cancellationToken);
        if (analysis is null)
        {
            var results = await CommitPreparedBatchAsync([prepared], actorUserId, cancellationToken);
            return results[0];
        }

        previewTicketStore.Validate(
            prepared.PreviewToken,
            prepared.Plan.SourceChecksum!,
            GuidHelper.ToGuidString(prepared.Customer.CustomerId),
            prepared.Plan.WeekStartDate,
            prepared.PriceTierAmount,
            WeeklyMenuWorkbookParser.ParserVersion);

        if (analysis.HasUnsupportedStructureChange)
            throw new BusinessRuleException("Import lại MRX chỉ hỗ trợ thay món tại các slot hiện có; không thêm hoặc xóa slot.");

        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new UnauthorizedAccessException("Không xác định được người import thực đơn.");
        MenuAmendmentResultDto sourceChange;
        if (analysis.Lines.Count == 0)
        {
            sourceChange = new MenuAmendmentResultDto { Status = "UNCHANGED" };
            var currentVersion = await context.Menuversions.AsNoTracking()
                .SingleAsync(item => item.MenuVersionId == analysis.Batch.MenuVersionId, cancellationToken);
            WeeklyMenuImportProjection.ApplyMenuVersion(preview, currentVersion);
            preview.Committed = true;
        }
        else
        {
            var request = new CreateMenuAmendmentRequest
            {
                CustomerId = GuidHelper.ToGuidString(prepared.Customer.CustomerId),
                WeekStartDate = prepared.Plan.WeekStartDate,
                ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(analysis.Batch.MenuVersionId),
                ExpectedBatchVersion = analysis.Batch.Version,
                Reason = $"Import lại thực đơn từ file {prepared.Plan.FileName}",
                Lines = analysis.Lines
            };
            var canApply = actorRoles.Any(role =>
                IPCManagement.Api.Security.AuthorizationPolicies.IsAdminRole(role) ||
                IPCManagement.Api.Security.AuthorizationPolicies.MatchesManagerRole(role));
            if (canApply)
            {
                var impact = await sourceChangeGateway.PreviewAsync(request, cancellationToken);
                var amendment = new MenuAmendment
                {
                    MenuAmendmentId = GuidHelper.NewId(), CustomerId = prepared.Customer.CustomerId,
                    WeekStartDate = prepared.Plan.WeekStartDate, BaseMenuVersionId = analysis.Batch.MenuVersionId,
                    Status = "PENDING_REVIEW", Reason = request.Reason, ImpactSnapshotJson = JsonSerializer.Serialize(impact),
                    CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Lines = impact.ImpactLines.Select(item => new MenuAmendmentLine
                    {
                        MenuAmendmentLineId = GuidHelper.NewId(), ServiceDate = item.ServiceDate,
                        ShiftName = item.ShiftName, DishSlot = item.DishSlot,
                        OldDishId = GuidHelper.ParseGuidString(item.OldDishId),
                        NewDishId = GuidHelper.ParseGuidString(item.NewDishId)!
                    }).ToList()
                };
                sourceChange = await sourceChangeGateway.ApplyAsync(
                    amendment,
                    actorId,
                    actorRoles,
                    "REIMPORT",
                    analysis.Batch.Version,
                    cancellationToken);
                preview.Committed = true;
                var appliedVersionId = GuidHelper.ParseGuidString(sourceChange.AppliedMenuVersionId)
                    ?? throw new InvalidOperationException("Áp dụng thay đổi nguồn không trả về phiên bản thực đơn.");
                var appliedVersion = await context.Menuversions.AsNoTracking()
                    .SingleAsync(item => item.MenuVersionId == appliedVersionId, cancellationToken);
                WeeklyMenuImportProjection.ApplyMenuVersion(preview, appliedVersion);
            }
            else if (actorRoles.Any(role => string.Equals(role, "Coordinator", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(role, "COORDINATOR", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(role, "Điều phối", StringComparison.OrdinalIgnoreCase)))
            {
                sourceChange = await new MenuAmendmentService(
                        context,
                        transactionRunner,
                        operationContext: operationContext,
                        mrxGateway: sourceChangeGateway)
                    .SubmitMrxReimportAsync(request, actorUserId, cancellationToken);
            }
            else
            {
                throw new UnauthorizedAccessException("Vai trò hiện tại không được import lại nguồn MRX.");
            }
        }

        preview.MrxSourceChange = sourceChange;
        DishCatalogCache.Clear(cache);
        previewTicketStore.Consume(prepared.PreviewToken!);
        return preview;
    }

    private async Task<MrxReimportAnalysis?> AnalyzeMrxReimportAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        decimal priceTierAmount,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(operationContext?.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
            return null;

        var batches = await (
                from candidate in context.Reconciliationbatches.AsNoTracking()
                join version in context.Menuversions.AsNoTracking() on candidate.MenuVersionId equals version.MenuVersionId
                where version.CustomerId == customer.CustomerId && version.WeekStartDate == plan.WeekStartDate
                select candidate)
            .ToListAsync(cancellationToken);
        if (batches.Count == 0) return null;
        if (batches.Count > 1)
            throw new BusinessRuleException("Tuần có nhiều lô đối soát; không xác định được lô nhận import lại.");
        var batch = batches[0];
        if (batch.Status != "DRAFT" || await context.Inventoryissues.AsNoTracking()
                .AnyAsync(issue => issue.ReconciliationBatchId == batch.BatchId, cancellationToken))
            throw new MrxSourceChangeException(MrxErrorCodes.ReimportClosed, StatusCodes.Status409Conflict,
                "Lô đối soát đã chốt hoặc bắt đầu xuất kho. Không thể import lại tuần này; hãy dùng Chỉnh sửa món cho ngày còn mở.");
        var schedules = await context.Menuschedules.AsNoTracking()
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems)
            .Where(item => item.CustomerId == customer.CustomerId && item.WeekStartDate == plan.WeekStartDate
                && item.MenuVersionId == batch.MenuVersionId)
            .ToListAsync(cancellationToken);
        var weekTier = await context.Customerweekmenutiers.AsNoTracking()
            .Where(item => item.CustomerId == customer.CustomerId && item.WeekStartDate == plan.WeekStartDate)
            .Select(item => (decimal?)item.PriceTierAmount)
            .SingleOrDefaultAsync(cancellationToken);
        if ((weekTier.HasValue && weekTier.Value != priceTierAmount)
            || schedules.Any(item => DecimalPolicy.RoundMoney(item.MenuPrice) != priceTierAmount)
            || (weekTier is null && schedules.Count == 0))
            throw new BusinessRuleException("Import lại không hỗ trợ đổi định mức của tuần đã có lô đối soát. Vui lòng giữ định mức đã lưu.");

        var locked = batch.Status == "COMPLETED"
            ? schedules.Select(item => item.ServiceDate).ToHashSet()
            : await sourceChangeGateway.GetLockedDatesAsync(batch.BatchId, cancellationToken);

        var current = schedules.SelectMany(schedule => schedule.Menu.Menuitems.Select(item =>
        {
            var slot = WeeklyMenuImportProjection.ParsePersistedDishSlot(item.DishSlot);
            return new ReimportSlot(
                SlotKey(schedule.ServiceDate, schedule.ShiftName, slot.VariantKey, slot.Slot),
                schedule.ServiceDate, schedule.ShiftName, item.DishSlot ?? $"{slot.VariantKey}-{slot.Slot}", item.DishId);
        })).ToDictionary(item => item.Key, StringComparer.OrdinalIgnoreCase);
        var imported = plan.Items.Select(item => new ReimportSlot(
            SlotKey(item.ServiceDate, item.DbShiftName, item.VariantKey, item.Slot),
            item.ServiceDate, item.DbShiftName, $"{item.VariantKey}-{item.Slot}", GuidHelper.ParseGuidString(item.DishId)))
            .ToDictionary(item => item.Key, StringComparer.OrdinalIgnoreCase);
        if (imported.Values.Any(item => item.DishId is null))
            throw new BusinessRuleException("Import lại MRX có lô đối soát không hỗ trợ món chưa có trong danh mục. Vui lòng tạo món và BOM trước khi import lại.");
        var allKeys = current.Keys.Union(imported.Keys, StringComparer.OrdinalIgnoreCase).ToList();
        var changedKeys = allKeys.Where(key =>
            !current.TryGetValue(key, out var oldSlot) || !imported.TryGetValue(key, out var newSlot)
            || oldSlot.DishId is null || newSlot.DishId is null
            || !oldSlot.DishId.AsSpan().SequenceEqual(newSlot.DishId)).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var outcomes = current.Values.Select(item => item.ServiceDate).Union(imported.Values.Select(item => item.ServiceDate))
            .Distinct().Order().Select(date =>
            {
                var changed = changedKeys.Any(key =>
                    (current.GetValueOrDefault(key)?.ServiceDate ?? imported.GetValueOrDefault(key)!.ServiceDate) == date);
                return new MrxReimportDayDto(date, locked.Contains(date)
                    ? changed ? "LOCKED_CONFLICT" : "LOCKED_IDENTICAL"
                    : changed ? "CHANGED" : "UNCHANGED");
            }).ToList();
        var unsupported = changedKeys.Any(key => !current.ContainsKey(key) || !imported.ContainsKey(key));
        var lines = changedKeys.Where(key => current.ContainsKey(key) && imported.ContainsKey(key)).Select(key =>
        {
            var oldSlot = current[key];
            var newSlot = imported[key];
            return new CreateMenuAmendmentLineRequest
            {
                ServiceDate = oldSlot.ServiceDate, ShiftName = oldSlot.ShiftName,
                DishSlot = oldSlot.DishSlot, NewDishId = GuidHelper.ToGuidString(newSlot.DishId!)
            };
        }).ToList();
        return new MrxReimportAnalysis(batch, outcomes, lines, unsupported);
    }

    private static string SlotKey(DateOnly date, string shiftName, string variant, string slot)
        => $"{date:yyyyMMdd}|{shiftName.ToUpperInvariant()}|{variant.ToLowerInvariant()}|{slot.ToLowerInvariant()}";

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

        await WeeklyMenuImportValidationPolicy.RequireNoMrxBatchAsync(context, operationContext?.Mode, prepared, cancellationToken);
        foreach (var item in prepared)
        {
            previewTicketStore.Validate(
                item.PreviewToken,
                item.Plan.SourceChecksum!,
                GuidHelper.ToGuidString(item.Customer.CustomerId),
                item.Plan.WeekStartDate,
                item.PriceTierAmount,
                WeeklyMenuWorkbookParser.ParserVersion);
        }

        List<WeeklyMenuImportResultDto> committedResults = [];
        try
        {
            var results = await transactionRunner.ExecuteAsync(
                async token =>
                {
                    committedResults = [];
                    await WeeklyMenuImportValidationPolicy.RequireNoMrxBatchAsync(context, operationContext?.Mode, prepared, token);
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
                isolationLevel: string.Equals(operationContext?.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal)
                    ? IsolationLevel.Serializable : IsolationLevel.ReadCommitted,
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

internal sealed record MrxReimportAnalysis(
    ReconciliationBatch Batch,
    List<MrxReimportDayDto> Outcomes,
    List<CreateMenuAmendmentLineRequest> Lines,
    bool HasUnsupportedStructureChange);

internal sealed record ReimportSlot(
    string Key,
    DateOnly ServiceDate,
    string ShiftName,
    string DishSlot,
    byte[]? DishId);
