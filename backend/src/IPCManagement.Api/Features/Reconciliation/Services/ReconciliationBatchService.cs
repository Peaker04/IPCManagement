using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationBatchService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public async Task<IReadOnlyList<ReconciliationBatchDto>> ListAsync(CancellationToken token = default)
    {
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(x => x.Ingredient)
            .Include(x => x.Lines).ThenInclude(x => x.CanonicalUnit)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var lineIds = batches.SelectMany(x => x.Lines).Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var issued = await LoadLinkedIssuedQuantitiesAsync(lineIds, token);

        var customerMap = await LoadCustomersForBatchesAsync(batches, token);
        var weekMap = await LoadWeeksForBatchesAsync(batches, token);
        return batches.Select(batch => {
            var menuVersionKey = Convert.ToHexString(batch.MenuVersionId);
            customerMap.TryGetValue(menuVersionKey, out var customer);
            weekMap.TryGetValue(menuVersionKey, out var weekStartDate);
            return Map(batch, actuals, dispositions, issued, customer: customer, weekStartDate: weekStartDate);
        }).ToList();
    }

    public async Task<ReconciliationWarehouseDailyDto?> GetWarehouseDailyAsync(string id, CancellationToken token = default)
    {
        var batchId = RequiredId(id);
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var batch = inMemory
            ? (await context.Reconciliationbatches.AsNoTracking().ToListAsync(token))
                .SingleOrDefault(item => item.BatchId.SequenceEqual(batchId))
            : await context.Reconciliationbatches.AsNoTracking()
                .SingleOrDefaultAsync(item => item.BatchId == batchId, token);
        if (batch is null) return null;
        if (context.Model.FindEntityType(typeof(ReconciliationBatchDailyLine)) is null)
            return new ReconciliationWarehouseDailyDto(
                GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version, "LEGACY_INCOMPATIBLE",
                new ReconciliationDailyCompatibilityDto(true, false, "LEGACY_DAILY_LINEAGE_MISSING"), []);

        var storedDailyLines = inMemory
            ? (await context.Reconciliationbatchdailylines.AsNoTracking().ToListAsync(token))
                .Where(line => line.BatchId.SequenceEqual(batchId)).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking()
                .Where(line => line.BatchId == batchId).ToListAsync(token);
        var weeklyLines = inMemory
            ? await context.Reconciliationbatchlines.AsNoTracking().ToListAsync(token)
            : await context.Reconciliationbatchlines.AsNoTracking()
                .Include(line => line.Ingredient).Include(line => line.CanonicalUnit)
                .Where(line => line.BatchId == batchId).ToListAsync(token);
        var weeklyById = weeklyLines.ToDictionary(line => Convert.ToHexString(line.BatchLineId), StringComparer.Ordinal);
        var dailyLines = storedDailyLines.Select(daily => (
            Daily: daily,
            Weekly: weeklyById[Convert.ToHexString(daily.BatchLineId)])).ToList();
        var compatibility = ReconciliationDailyIssuePolicy.ResolveCompatibility(dailyLines.Count > 0, batch.Status);
        var dailyLineIds = storedDailyLines.Select(line => line.DailyLineId).ToList();
        var dailyDispositions = inMemory
            ? (await context.Reconciliationdailydispositions.AsNoTracking().ToListAsync(token))
                .Where(item => dailyLineIds.Any(idValue => idValue.SequenceEqual(item.DailyLineId))).ToList()
            : await context.Reconciliationdailydispositions.AsNoTracking()
                .Where(item => dailyLineIds.Contains(item.DailyLineId)).ToListAsync(token);
        var disposedDailyIds = dailyDispositions
            .Where(item => !string.IsNullOrWhiteSpace(item.Reason))
            .Select(item => Convert.ToHexString(item.DailyLineId)).ToHashSet(StringComparer.Ordinal);
        var weekStart = inMemory
            ? (await context.Menuversions.AsNoTracking().ToListAsync(token))
                .SingleOrDefault(item => item.MenuVersionId.SequenceEqual(batch.MenuVersionId))?.WeekStartDate
            : await context.Menuversions.AsNoTracking()
                .Where(item => item.MenuVersionId == batch.MenuVersionId)
                .Select(item => (DateOnly?)item.WeekStartDate)
                .SingleOrDefaultAsync(token);
        weekStart ??= dailyLines.Count == 0 ? null : StartOfWeek(dailyLines.Min(item => item.Daily.ServiceDate));

        var inMemoryIssues = inMemory ? await context.Inventoryissues.AsNoTracking().ToListAsync(token) : [];
        var issueRows = inMemory
            ? (await context.Inventoryissuelines.AsNoTracking().ToListAsync(token))
                .Where(line => line.ReconciliationBatchDailyLineId is not null
                    && inMemoryIssues.Any(issue => issue.IssueId.SequenceEqual(line.IssueId)
                        && issue.ReconciliationBatchId is not null && issue.ReconciliationBatchId.SequenceEqual(batchId))).ToList()
            : await context.Inventoryissuelines.AsNoTracking().Include(line => line.Issue)
                .Where(line => line.ReconciliationBatchDailyLineId != null && line.Issue.ReconciliationBatchId == batchId)
                .ToListAsync(token);
        var issueLineIds = issueRows.Select(line => line.IssueLineId).ToList();
        var inMemoryReturns = inMemory ? await context.Inventoryreturns.AsNoTracking().ToListAsync(token) : [];
        var returnRows = inMemory
            ? (await context.Inventoryreturnlines.AsNoTracking().ToListAsync(token))
                .Where(line => line.SourceIssueLineId is not null
                    && inMemoryReturns.Any(item => item.ReturnId.SequenceEqual(line.ReturnId) && item.ReceivedAt is not null)
                    && issueLineIds.Any(idValue => idValue.SequenceEqual(line.SourceIssueLineId))).ToList()
            : await context.Inventoryreturnlines.AsNoTracking().Include(line => line.Return)
                .Where(line => line.SourceIssueLineId != null && issueLineIds.Contains(line.SourceIssueLineId) && line.Return.ReceivedAt != null)
                .ToListAsync(token);
        var returnedByIssueLine = returnRows
            .GroupBy(line => Convert.ToHexString(line.SourceIssueLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity), StringComparer.Ordinal);
        var ledgerByDailyLine = issueRows
            .GroupBy(line => Convert.ToHexString(line.ReconciliationBatchDailyLineId!))
            .ToDictionary(
                group => group.Key,
                group => new
                {
                    Issued = group.Sum(line => line.IssuedQty - returnedByIssueLine.GetValueOrDefault(Convert.ToHexString(line.IssueLineId))),
                    Returned = group.Sum(line => returnedByIssueLine.GetValueOrDefault(Convert.ToHexString(line.IssueLineId)))
                },
                StringComparer.Ordinal);

        var dates = new List<ReconciliationWarehouseDayDto>();
        if (weekStart is { } start)
        {
            for (var offset = 0; offset < 7; offset++)
            {
                var serviceDate = start.AddDays(offset);
                var sources = dailyLines.Where(item => item.Daily.ServiceDate == serviceDate).ToList();
                var lineDtos = sources.Select(item =>
                {
                    var key = Convert.ToHexString(item.Daily.DailyLineId);
                    var hasLedger = ledgerByDailyLine.TryGetValue(key, out var ledger);
                    var issued = hasLedger ? ledger!.Issued : (decimal?)null;
                    var returned = hasLedger ? ledger!.Returned : 0m;
                    var hasDisposition = disposedDailyIds.Contains(key);
                    var status = ReconciliationDailyIssuePolicy.ResolveLineStatus(item.Daily.RequiredQuantity, issued, hasDisposition);
                    return new ReconciliationWarehouseDailyLineDto(
                        GuidHelper.ToGuidString(item.Daily.DailyLineId), GuidHelper.ToGuidString(item.Weekly.BatchLineId),
                        GuidHelper.ToGuidString(item.Weekly.IngredientId), item.Weekly.Ingredient?.IngredientCode, item.Weekly.Ingredient?.IngredientName,
                        GuidHelper.ToGuidString(item.Weekly.CanonicalUnitId), item.Weekly.CanonicalUnit?.UnitName,
                        item.Daily.RequiredQuantity, issued, returned,
                        DecimalPolicy.RoundQuantity(item.Daily.RequiredQuantity - (issued ?? 0m)), status.QuantityStatus, status.HasValidDisposition);
                }).OrderBy(line => line.IngredientName).ThenBy(line => line.DailyLineId, StringComparer.Ordinal).ToList();
                var lineStatuses = lineDtos.Select(line => new ReconciliationDailyLineStatus(line.QuantityStatus, line.HasValidDisposition)).ToList();
                var dayStatus = ReconciliationDailyIssuePolicy.ResolveDailyStatus(lineStatuses);
                dates.Add(new ReconciliationWarehouseDayDto(
                    serviceDate, dayStatus, lineDtos.Count > 0,
                    lineDtos.Sum(line => line.RequiredQuantity), lineDtos.Sum(line => line.IssuedQuantity ?? 0m),
                    lineDtos.Sum(line => line.ReturnedQuantity), lineDtos.Sum(line => line.RemainingQuantity), lineDtos));
            }
        }
        var weeklyStatus = compatibility.CanIssueByDate
            ? ReconciliationDailyIssuePolicy.ResolveWeeklyStatus(dates.Select(date => new ReconciliationDailySummary(date.Status, date.IsApplicable)).ToList())
            : compatibility.ReasonCode == "BATCH_READ_ONLY"
                ? ReconciliationDailyIssuePolicy.ResolveWeeklyStatus(dates.Select(date => new ReconciliationDailySummary(date.Status, date.IsApplicable)).ToList())
                : "LEGACY_INCOMPATIBLE";
        return new ReconciliationWarehouseDailyDto(
            GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version, weeklyStatus,
            new ReconciliationDailyCompatibilityDto(compatibility.CanRead, compatibility.CanIssueByDate, compatibility.ReasonCode), dates);
    }

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

    public async Task<IReadOnlyList<ReconciliationDraftSourceDto>> ListDraftSourcesAsync(CancellationToken token = default)
    {
        var imports = await context.Quantityimportbatches.AsNoTracking()
            .Where(import => import.Status == "CONFIRMED" && import.MenuVersionId != null)
            .Include(import => import.Mealquantityplans)
            .ThenInclude(plan => plan.Mealquantityplanlines)
            .ThenInclude(line => line.MenuSchedule)
            .ThenInclude(schedule => schedule.MenuVersion)
            .AsSplitQuery()
            .ToListAsync(token);

        return imports
            .Where(import => IsExactCommittedAuthority(import, import.MenuVersionId!))
            .Select(import => new { Import = import, MenuVersion = import.Mealquantityplans.First().Mealquantityplanlines.First().MenuSchedule.MenuVersion! })
            .OrderByDescending(source => source.MenuVersion.WeekStartDate)
            .ThenByDescending(source => source.Import.ImportedAt)
            .Select(source => new ReconciliationDraftSourceDto(
                GuidHelper.ToGuidString(source.Import.MenuVersionId!),
                $"Tuần {source.MenuVersion.WeekStartDate:dd/MM/yyyy} · phiên bản {source.MenuVersion.VersionNo}",
                GuidHelper.ToGuidString(source.Import.ImportBatchId),
                $"{source.Import.BatchCode} · {source.Import.ImportedAt:dd/MM/yyyy HH:mm}"))
            .ToList();
    }

    public async Task<ReconciliationBatchDto?> GetAsync(string id, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(x => x.Ingredient)
            .Include(x => x.Lines).ThenInclude(x => x.CanonicalUnit)
            .SingleOrDefaultAsync(x => x.BatchId == bytes, token);
        if (batch is null) return null;
        var batchLines = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Reconciliationbatchlines.AsNoTracking().Include(line => line.Ingredient).Include(line => line.CanonicalUnit).ToListAsync(token))
                .Where(line => line.BatchId.SequenceEqual(bytes)).ToList()
            : await context.Reconciliationbatchlines.AsNoTracking().Include(line => line.Ingredient).Include(line => line.CanonicalUnit)
                .Where(line => line.BatchId == bytes).ToListAsync(token);
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var lineIds = batchLines.Select(line => line.BatchLineId).ToList();
        var issued = await LoadLinkedIssuedQuantitiesAsync(lineIds, token);
        var issueNotes = (await context.Auditlogs.AsNoTracking()
                .Where(audit => audit.EntityName == nameof(InventoryIssueLine) && audit.FieldName == nameof(InventoryIssueLine.IssuedQty)
                    && audit.EntityId != null && lineIds.Contains(audit.EntityId) && audit.Reason != null)
                .OrderBy(audit => audit.ChangedAt)
                .Select(audit => new { audit.EntityId, audit.Reason }).ToListAsync(token))
            .GroupBy(audit => Convert.ToHexString(audit.EntityId!))
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(audit => audit.Reason!).ToList(), StringComparer.Ordinal);
        var customer = await TryGetCustomerAsync(batch.MenuVersionId, token);
        return Map(batch, actuals, dispositions, issued, batchLines, issueNotes, customer);
    }

    public async Task<IReadOnlyList<ReconciliationSourceChangeDto>> ListSourceChangesAsync(string id, CancellationToken token = default)
    {
        var batchId = RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking()
            .Include(item => item.Lines)
            .SingleOrDefaultAsync(item => item.BatchId == batchId, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối chiếu.");
        var batchLineIds = batch.Lines.Select(line => line.BatchLineId).ToList();
        var contributors = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(contributor => batchLineIds.Contains(contributor.BatchLineId)).ToListAsync(token);
        var menuScheduleIds = contributors.Select(contributor => contributor.MenuScheduleId).ToList();
        var quantityPlanLineIds = contributors.Select(contributor => contributor.MealQuantityPlanLineId).ToList();
        var dishBomIds = contributors.Select(contributor => contributor.DishBomId).ToList();
        var quantitySources = await context.Mealquantityplanlines.AsNoTracking()
            .Where(line => quantityPlanLineIds.Contains(line.QuantityPlanLineId))
            .Select(line => new { line.QuantityPlanId, line.MenuId }).Distinct().ToListAsync(token);
        var quantityPlanIds = quantitySources.Select(source => source.QuantityPlanId).ToList();
        var menuIds = quantitySources.Select(source => source.MenuId).ToList();

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(audit => audit.EntityId != null && (
                (audit.EntityName == nameof(MenuVersion) && audit.EntityId == batch.MenuVersionId)
                || (audit.EntityName == nameof(QuantityImportBatch) && audit.EntityId == batch.QuantityImportBatchId)
                || ((audit.EntityName == nameof(MenuItem) || audit.EntityName == nameof(MenuSchedule)) && menuScheduleIds.Contains(audit.EntityId))
                || (audit.EntityName == nameof(MealQuantityPlanLine) && quantityPlanLineIds.Contains(audit.EntityId))
                || (audit.EntityName == nameof(MealQuantityPlan) && quantityPlanIds.Contains(audit.EntityId))
                || (audit.EntityName == nameof(Menu) && menuIds.Contains(audit.EntityId))
                || (audit.EntityName == nameof(DishBom) && dishBomIds.Contains(audit.EntityId))))
            .ToListAsync(token);
        var changes = audits.Select(audit => new ReconciliationSourceChangeDto(
                GuidHelper.ToGuidString(audit.AuditId), audit.ChangedAt,
                GuidHelper.ToGuidString(audit.ChangedBy),
                audit.BusinessArea, audit.EntityName, GuidHelper.ToGuidString(audit.EntityId!),
                audit.FieldName, audit.OldValue, audit.NewValue, audit.Reason))
            .ToList();
        var adjustments = await context.Bomadjustments.AsNoTracking()
            .Where(adjustment => dishBomIds.Contains(adjustment.BomId))
            .ToListAsync(token);
        changes.AddRange(adjustments.Select(adjustment => new ReconciliationSourceChangeDto(
            GuidHelper.ToGuidString(adjustment.BomAdjustmentId), adjustment.AdjustedAt,
            GuidHelper.ToGuidString(adjustment.AdjustedBy),
            "BOM", nameof(BomAdjustment), GuidHelper.ToGuidString(adjustment.BomId),
            "QuantityAndWaste",
            FormatBomAdjustmentValue(adjustment.OldGrossQtyPerServing, adjustment.OldWasteRatePercent),
            FormatBomAdjustmentValue(adjustment.NewGrossQtyPerServing, adjustment.NewWasteRatePercent),
            adjustment.Reason)));

        var adjustmentKeys = changes
            .Where(change => change.EntityName == nameof(BomAdjustment))
            .Select(BomChangeIdentity)
            .ToHashSet(StringComparer.Ordinal);
        return changes
            .Where(change => change.EntityName == nameof(BomAdjustment) || !adjustmentKeys.Contains(BomChangeIdentity(change)))
            .OrderByDescending(change => change.ChangedAt)
            .ThenByDescending(change => change.ChangeId, StringComparer.Ordinal)
            .ToList();
    }

    public async Task<IReadOnlyList<ReconciliationBatchDishSummaryDto>> ListDishesAsync(string id, CancellationToken token = default)
    {
        var batchId = RequiredId(id);
        var linesQuery = context.Reconciliationbatchlines.AsNoTracking()
            .Include(line => line.Ingredient)
            .Include(line => line.CanonicalUnit)
            .Include(line => line.Contributors);
        var lines = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? context.ChangeTracker.Entries<ReconciliationBatchLine>().Select(entry => entry.Entity).Where(line => line.BatchId.AsSpan().SequenceEqual(batchId)).ToList()
            : await linesQuery.Where(line => line.BatchId == batchId).ToListAsync(token);
        if (lines.Count == 0) throw new KeyNotFoundException("Không tìm thấy lô đối chiếu.");

        var dailyLines = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? context.ChangeTracker.Entries<ReconciliationBatchDailyLine>().Select(entry => entry.Entity).Where(line => line.BatchId.AsSpan().SequenceEqual(batchId)).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking().Where(line => line.BatchId == batchId).ToListAsync(token);
        var dailyLinesById = dailyLines.ToDictionary(line => Convert.ToHexString(line.DailyLineId), StringComparer.Ordinal);
        var contributors = lines.SelectMany(line => line.Contributors.Select(contributor => new { Line = line, Contributor = contributor })).ToList();
        if (contributors.Any(item => item.Contributor.DailyLineId is null || !dailyLinesById.ContainsKey(Convert.ToHexString(item.Contributor.DailyLineId)) || item.Contributor.DishId is null
            || string.IsNullOrWhiteSpace(item.Contributor.FrozenDishCode) || string.IsNullOrWhiteSpace(item.Contributor.FrozenDishName)
            || string.IsNullOrWhiteSpace(item.Contributor.FrozenShiftName) || item.Contributor.FrozenServings is null || item.Contributor.FrozenBomQuantityPerServing is null))
            throw new BusinessRuleException("KITCHEN_FROZEN_LINEAGE_MISSING");

        return contributors
            .GroupBy(item => Convert.ToHexString(item.Contributor.DishId!))
            .Select(dishGroup =>
            {
                var first = dishGroup.First().Contributor;
                var materials = dishGroup
                    .GroupBy(item => new { Daily = Convert.ToHexString(item.Contributor.DailyLineId!), Line = Convert.ToHexString(item.Line.BatchLineId) })
                    .Select(group =>
                    {
                        var facts = group.Select(item => new { item.Contributor.FrozenBomQuantityPerServing, item.Contributor.FrozenWasteRatePercent }).Distinct().ToList();
                        if (facts.Count != 1) throw new BusinessRuleException("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS");
                        var item = group.First();
                        return new ReconciliationBatchDishMaterialDto(
                            GuidHelper.ToGuidString(item.Line.BatchLineId), GuidHelper.ToGuidString(item.Line.IngredientId), item.Line.Ingredient?.IngredientCode,
                            item.Line.Ingredient?.IngredientName, GuidHelper.ToGuidString(item.Line.CanonicalUnitId), item.Line.CanonicalUnit?.UnitName,
                            facts[0].FrozenBomQuantityPerServing!.Value, GuidHelper.ToGuidString(item.Contributor.DailyLineId!), dailyLinesById[Convert.ToHexString(item.Contributor.DailyLineId!)].ServiceDate.ToString("yyyy-MM-dd"));
                    }).OrderBy(material => material.ServiceDate).ThenBy(material => material.IngredientName).ToList();
                var scopes = dishGroup
                    .GroupBy(item => new { ServiceDate = dailyLinesById[Convert.ToHexString(item.Contributor.DailyLineId!)].ServiceDate, item.Contributor.FrozenShiftName, item.Contributor.FrozenServings })
                    .Select(group => new ReconciliationBatchDishScopeDto(group.Key.ServiceDate.ToString("yyyy-MM-dd"), group.Key.FrozenShiftName!, group.Key.FrozenServings!.Value, group.Key.FrozenServings.Value, 0))
                    .OrderBy(scope => scope.ServiceDate).ThenBy(scope => scope.ShiftName).ToList();
                return new ReconciliationBatchDishSummaryDto(GuidHelper.ToGuidString(first.DishId!), first.FrozenDishCode!, first.FrozenDishName!, materials, scopes);
            })
            .OrderBy(dish => dish.DishName)
            .ToList();
    }

    public async Task<ReconciliationBatchDto> CreateDraftAsync(CreateReconciliationDraftRequest request, string actorId, CancellationToken token = default)
    {
        var batchId = GuidHelper.NewId();
        var menuVersionId = RequiredId(request.MenuVersionId);
        var importBatchId = RequiredId(request.QuantityImportBatchId);
        var actor = RequiredId(actorId);
        var protection = RequiredProtection();

        try
        {
            return await transactions.ExecuteProtectedAsync(
                protection.OperationKey,
                protection.ExpectedVersion,
                async operationToken =>
                {
                    var existing = await LoadByImportAsync(importBatchId, operationToken);
                    if (existing is not null)
                    {
                        if (!existing.MenuVersionId.AsSpan().SequenceEqual(menuVersionId))
                            throw new InvalidOperationException("Nguồn thực đơn không khớp lô đối chiếu đã tồn tại.");
                        return Map(existing, [], []);
                    }

                    var batch = await MaterializeDraftAsync(batchId, menuVersionId, importBatchId, actor, operationToken);
                    await context.SaveChangesAsync(operationToken);
                    return Map(batch, [], []);
                },
                verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.QuantityImportBatchId == importBatchId && x.Lines.Any(), verifyToken),
                isolationLevel: IsolationLevel.Serializable,
                cancellationToken: token);
        }
        catch (DbUpdateException error) when (IsQuantityImportBatchDuplicate(error))
        {
            context.ChangeTracker.Clear();
            var winner = await LoadByImportAsync(importBatchId, token);
            if (winner is null)
                throw new DbUpdateConcurrencyException("Đợt nhập đã được tạo lô đối chiếu đồng thời.", error);
            if (!winner.MenuVersionId.AsSpan().SequenceEqual(menuVersionId))
                throw new InvalidOperationException("Nguồn thực đơn không khớp lô đối chiếu đã tồn tại.");
            return Map(winner, [], []);
        }
    }

    internal async Task<ReconciliationBatch> MaterializeDraftAsync(
        byte[] batchId,
        byte[] menuVersionId,
        byte[] importBatchId,
        byte[] actor,
        CancellationToken token)
    {
        var committedImport = await context.Quantityimportbatches.AsNoTracking()
            .Include(x => x.Mealquantityplans)
            .ThenInclude(x => x.Mealquantityplanlines)
            .ThenInclude(x => x.MenuSchedule)
            .ThenInclude(x => x.MenuVersion)
            .AsSplitQuery()
            .SingleOrDefaultAsync(x => x.ImportBatchId == importBatchId, token);
        if (!IsExactCommittedAuthority(committedImport, menuVersionId))
            throw new BusinessRuleException("Nguồn thực đơn hoặc đợt nhập chưa được cam kết hợp lệ.");

        var sourceLines = await context.Mealquantityplanlines
            .Where(x => x.QuantityPlan.ImportBatchId == importBatchId && x.MenuSchedule.MenuVersionId == menuVersionId)
            .Include(x => x.MenuSchedule)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Unit)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Ingredient).ThenInclude(x => x.Unit)
            .AsSplitQuery()
            .ToListAsync(token);
        if (sourceLines.Count == 0) throw new BusinessRuleException("Đợt nhập không có dòng số suất thuộc phiên bản thực đơn đã chọn.");

        var tolerances = await context.Reconciliationtolerances.AsNoTracking().ToListAsync(token);
        var batch = new ReconciliationBatch
        {
            BatchId = batchId,
            MenuVersionId = menuVersionId,
            QuantityImportBatchId = importBatchId,
            Status = "DRAFT",
            Version = 1,
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow
        };

        var materialized = new Dictionary<string, ReconciliationBatchLine>(StringComparer.Ordinal);
        var materializedDaily = new Dictionary<string, ReconciliationBatchDailyLine>(StringComparer.Ordinal);
        foreach (var projectedSource in ReconciliationMaterialProjection.Project(sourceLines))
        {
            foreach (var dish in projectedSource.Dishes)
            {
                foreach (var material in dish.Materials)
                {
                    var bom = material.Bom;
                    var key = Convert.ToBase64String(bom.IngredientId) + ":" + Convert.ToBase64String(bom.Ingredient.UnitId);
                    if (!materialized.TryGetValue(key, out var line))
                    {
                        var tolerance = ResolveTolerance(tolerances, bom.IngredientId, bom.Ingredient.UnitId);
                        line = new ReconciliationBatchLine
                        {
                            BatchLineId = GuidHelper.NewId(), BatchId = batchId, IngredientId = bom.IngredientId,
                            CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = 0, FrozenTolerance = tolerance.Value,
                            ToleranceSourceKind = tolerance.Kind, ToleranceSourceVersion = tolerance.Version, Version = 1
                        };
                        materialized.Add(key, line);
                        batch.Lines.Add(line);
                    }
                    line.RequiredQuantity += material.RequiredQuantity;
                    var dailyKey = $"{key}:{projectedSource.Source.MenuSchedule.ServiceDate:yyyy-MM-dd}";
                    if (!materializedDaily.TryGetValue(dailyKey, out var dailyLine))
                    {
                        dailyLine = new ReconciliationBatchDailyLine
                        {
                            DailyLineId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchId = batchId,
                            IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId,
                            ServiceDate = projectedSource.Source.MenuSchedule.ServiceDate, RequiredQuantity = 0, Version = 1
                        };
                        materializedDaily.Add(dailyKey, dailyLine);
                        line.DailyLines.Add(dailyLine);
                    }
                    dailyLine.RequiredQuantity += material.RequiredQuantity;
                    line.Contributors.Add(new ReconciliationBatchContributor
                    {
                        ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, DailyLineId = dailyLine.DailyLineId,
                        MenuScheduleId = projectedSource.Source.MenuScheduleId,
                        MealQuantityPlanLineId = projectedSource.Source.QuantityPlanLineId,
                        DishBomId = bom.BomId, DishId = dish.MenuItem.DishId,
                        FrozenShiftName = projectedSource.Source.ShiftName,
                        FrozenDishCode = dish.MenuItem.Dish.DishCode,
                        FrozenDishName = dish.MenuItem.Dish.DishName,
                        FrozenServings = projectedSource.Source.FinalServings,
                        FrozenBomQuantityPerServing = bom.GrossQtyPerServing,
                        FrozenWasteRatePercent = bom.WasteRatePercent,
                        SourceQuantity = material.RequiredQuantity
                    });
                }
            }
        }
        if (batch.Lines.Count == 0
            || batch.Lines.Any(line => line.RequiredQuantity <= 0
                || line.DailyLines.Count == 0
                || line.DailyLines.Any(daily => daily.RequiredQuantity <= 0)
                || decimal.Round(line.DailyLines.Sum(daily => daily.RequiredQuantity), 6, MidpointRounding.AwayFromZero) != decimal.Round(line.RequiredQuantity, 6, MidpointRounding.AwayFromZero)
                || line.Contributors.Count == 0
                || line.Contributors.Any(contributor => contributor.DailyLineId is null || contributor.SourceQuantity <= 0)))
            throw new BusinessRuleException("Không thể tạo đầy đủ dòng nguyên liệu dương từ nguồn đã chọn.");
        context.Reconciliationbatches.Add(batch);
        return batch;
    }

    public async Task<ReconciliationBatchDto> ReadyAsync(string id, ReadyReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var actor = RequiredId(actorId);
        var protection = RequiredProtection();
        return await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var batch = await context.Reconciliationbatches
                    .Include(x => x.Lines).ThenInclude(x => x.Contributors)
                    .Include(x => x.Lines).ThenInclude(x => x.DailyLines)
                    .SingleOrDefaultAsync(x => x.BatchId == bytes, operationToken) ?? throw new KeyNotFoundException();
                context.Entry(batch).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
                if (batch.Status != "DRAFT" || batch.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi.");
                if (batch.Lines.Count == 0 || batch.Lines.Any(x =>
                        x.RequiredQuantity <= 0
                        || x.FrozenTolerance < 0
                        || x.DailyLines.Count == 0
                        || x.DailyLines.Any(daily => daily.RequiredQuantity <= 0)
                        || decimal.Round(x.DailyLines.Sum(daily => daily.RequiredQuantity), 6, MidpointRounding.AwayFromZero) != decimal.Round(x.RequiredQuantity, 6, MidpointRounding.AwayFromZero)
                        || x.Contributors.Count == 0
                        || x.Contributors.Any(contributor => contributor.DailyLineId is null || contributor.SourceQuantity <= 0)))
                    throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu theo ngày hợp lệ để sẵn sàng đối chiếu.");
                batch.Status = "READY"; batch.Version++; batch.ReadyBy = actor; batch.ReadyAt = DateTime.UtcNow;
                await context.SaveChangesAsync(operationToken);
                return Map(batch, [], []);
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == bytes && x.Status == "READY" && x.Version == request.ExpectedVersion + 1, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
    }

    public async Task<ReconciliationWarehouseTransferDto> TransferToWarehouseAsync(string id, TransferReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        if (!string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
            throw new InvalidOperationException("Chỉ chế độ đối chiếu nguyên liệu mới được chuyển danh sách sang Kho.");
        var batchId = RequiredId(id);
        _ = RequiredId(actorId);
        var protection = RequiredProtection();
        var batch = await transactions.ExecuteProtectedAsync(
            protection.OperationKey,
            protection.ExpectedVersion,
            async operationToken =>
            {
                var source = await context.Reconciliationbatches
                    .Include(item => item.Lines).ThenInclude(line => line.Ingredient)
                    .Include(item => item.Lines).ThenInclude(line => line.CanonicalUnit)
                    .SingleOrDefaultAsync(item => item.BatchId == batchId, operationToken)
                    ?? throw new KeyNotFoundException();
                if (source.Status == "TRANSFERRED") return source;
                if (source.Status != "READY" || source.Version != request.ExpectedVersion)
                    throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi hoặc chưa sẵn sàng chuyển sang Kho.");
                source.Status = "TRANSFERRED";
                source.Version++;
                await context.SaveChangesAsync(operationToken);
                return source;
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(item => item.BatchId == batchId && item.Status == "TRANSFERRED", verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
        return MapTransfer(batch);
    }

    private static string FormatBomAdjustmentValue(decimal grossQuantity, decimal wasteRate) =>
        FormattableString.Invariant($"{grossQuantity:0.######} / hao hụt {wasteRate:0.##}%");

    private static string BomChangeIdentity(ReconciliationSourceChangeDto change) =>
        change.BusinessArea == "BOM"
        && change.EntityName is nameof(DishBom) or nameof(BomAdjustment)
        && change.FieldName == "QuantityAndWaste"
            ? string.Join('\u001f', change.EntityId, change.Actor, change.OldValue, change.NewValue, change.Reason)
            : $"change:{change.ChangeId}";

    internal Task<IReadOnlyDictionary<string, decimal>> LoadLinkedIssuedQuantitiesForCompletionAsync(IReadOnlyCollection<byte[]> lineIds, CancellationToken token) =>
        LoadLinkedIssuedQuantitiesAsync(lineIds, token);

    private async Task<IReadOnlyDictionary<string, decimal>> LoadLinkedIssuedQuantitiesAsync(IReadOnlyCollection<byte[]> lineIds, CancellationToken token)
    {
        if (lineIds.Count == 0) return new Dictionary<string, decimal>();
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var issueRows = inMemory
            ? (await context.Inventoryissuelines.AsNoTracking().Where(line => line.ReconciliationBatchLineId != null)
                .Select(line => new { line.IssueLineId, line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token))
                .Where(row => lineIds.Any(id => id.SequenceEqual(row.ReconciliationBatchLineId!))).ToList()
            : await context.Inventoryissuelines.AsNoTracking()
                .Where(line => line.ReconciliationBatchLineId != null && lineIds.Contains(line.ReconciliationBatchLineId))
                .Select(line => new { line.IssueLineId, line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token);
        var issueLineIds = issueRows.Select(row => row.IssueLineId).ToList();
        var receivedReturns = inMemory
            ? (await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null && line.Return.ReceivedAt != null)
                .Select(line => new { line.SourceIssueLineId, line.Quantity }).ToListAsync(token))
                .Where(row => issueLineIds.Any(id => id.SequenceEqual(row.SourceIssueLineId!))).ToList()
            : await context.Inventoryreturnlines.AsNoTracking()
                .Where(line => line.SourceIssueLineId != null && issueLineIds.Contains(line.SourceIssueLineId) && line.Return.ReceivedAt != null)
                .Select(line => new { line.SourceIssueLineId, line.Quantity }).ToListAsync(token);
        return ProjectNetIssuedQuantities(
            issueRows.Select(row => (row.IssueLineId, row.ReconciliationBatchLineId!, row.IssuedQty)),
            receivedReturns.Select(row => (row.SourceIssueLineId!, row.Quantity)));
    }

    internal static IReadOnlyDictionary<string, decimal> ProjectNetIssuedQuantities(
        IEnumerable<(byte[] IssueLineId, byte[] ReconciliationBatchLineId, decimal IssuedQty)> issueRows,
        IEnumerable<(byte[] SourceIssueLineId, decimal Quantity)> receivedReturns)
    {
        var returnedByIssueLine = receivedReturns
            .GroupBy(row => Convert.ToHexString(row.SourceIssueLineId))
            .ToDictionary(group => group.Key, group => group.Sum(row => row.Quantity), StringComparer.Ordinal);
        return issueRows.GroupBy(row => Convert.ToHexString(row.ReconciliationBatchLineId))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(row => row.IssuedQty - returnedByIssueLine.GetValueOrDefault(Convert.ToHexString(row.IssueLineId))),
                StringComparer.Ordinal);
    }

    private static ReconciliationWarehouseTransferDto MapTransfer(ReconciliationBatch batch) =>
        new(GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version,
            batch.Lines.OrderBy(line => Convert.ToHexString(line.BatchLineId)).Select(line =>
                new ReconciliationWarehouseTransferLineDto(
                    GuidHelper.ToGuidString(line.BatchLineId), GuidHelper.ToGuidString(line.IngredientId),
                    line.Ingredient?.IngredientCode, line.Ingredient?.IngredientName,
                    GuidHelper.ToGuidString(line.CanonicalUnitId), line.CanonicalUnit?.UnitName,
                    line.RequiredQuantity, line.Version)).ToList());

    private static bool IsExactCommittedAuthority(QuantityImportBatch? import, byte[] menuVersionId) =>
        import is not null
        && import.Status == "CONFIRMED"
        && import.MenuVersionId is not null
        && import.MenuVersionId.AsSpan().SequenceEqual(menuVersionId)
        && !string.IsNullOrWhiteSpace(import.ContentFingerprint)
        && import.FingerprintFormatVersion == ReconciliationQuantityImportService.CurrentFingerprintFormatVersion
        && !string.IsNullOrWhiteSpace(import.SourceLabel)
        && import.Mealquantityplans.Count > 0
        && import.Mealquantityplans.All(plan =>
            plan.Status == "COMPLETED"
            && plan.Mealquantityplanlines.Count > 0
            && plan.Mealquantityplanlines.All(line =>
                line.MenuSchedule.MenuVersionId is not null
                && line.MenuSchedule.MenuVersionId.AsSpan().SequenceEqual(menuVersionId)
                && line.MenuSchedule.MenuVersion is not null
                && MenuVersionStatusPolicy.PublishedCompatibleStatuses.Contains(line.MenuSchedule.MenuVersion.Status)));

    private Task<ReconciliationBatch?> LoadByImportAsync(byte[] importBatchId, CancellationToken token) =>
        context.Reconciliationbatches.AsNoTracking()
            .Include(batch => batch.Lines)
            .SingleOrDefaultAsync(batch => batch.QuantityImportBatchId == importBatchId, token);

    internal static bool IsQuantityImportBatchDuplicate(DbUpdateException error)
    {
        var message = error.InnerException?.Message ?? error.Message;
        return (error.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry }
                && message.Contains("ux_reconciliationbatches_quantityImportBatchId", StringComparison.OrdinalIgnoreCase))
            || message.Contains("reconciliationbatches.QuantityImportBatchId", StringComparison.OrdinalIgnoreCase)
            || message.Contains("reconciliationbatches_quantityImportBatchId", StringComparison.OrdinalIgnoreCase);
    }

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };

    internal static decimal ConvertToCanonical(decimal quantity, Unit source, Unit target)
    {
        if (source.UnitId.AsSpan().SequenceEqual(target.UnitId)) return quantity;
        if (string.IsNullOrWhiteSpace(source.BaseUnitCode) || string.IsNullOrWhiteSpace(target.BaseUnitCode)
            || !string.Equals(source.BaseUnitCode, target.BaseUnitCode, StringComparison.OrdinalIgnoreCase)
            || source.ConvertRateToBase <= 0 || target.ConvertRateToBase <= 0)
            throw new InvalidOperationException("Đơn vị nguyên liệu chưa có quy đổi chuẩn hợp lệ.");
        return quantity * source.ConvertRateToBase / target.ConvertRateToBase;
    }

    internal static (decimal Value, string Kind, string Version) ResolveTolerance(
        IReadOnlyList<ReconciliationTolerance> tolerances,
        byte[] ingredientId,
        byte[] canonicalUnitId)
    {
        var systemDefault = ReconciliationToleranceAuthority.ReadSystemDefault(tolerances)
            ?? throw new ReconciliationToleranceAuthorityException("Chưa cấu hình dung sai mặc định hệ thống.");
        var selected = tolerances.FirstOrDefault(x => x.ScopeKind == "INGREDIENT" && x.ScopeId != null && x.ScopeId.AsSpan().SequenceEqual(ingredientId))
            ?? tolerances.FirstOrDefault(x => x.ScopeKind == "UNIT_GROUP" && x.ScopeId != null && x.ScopeId.AsSpan().SequenceEqual(canonicalUnitId))
            ?? systemDefault;
        return (selected.Value, selected.ScopeKind, selected.Version.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private static ReconciliationBatchDto Map(
        ReconciliationBatch batch,
        IReadOnlyList<ReconciliationActual> actuals,
        IReadOnlyList<ReconciliationDisposition> dispositions,
        IReadOnlyDictionary<string, decimal>? linkedIssued = null,
        IReadOnlyList<ReconciliationBatchLine>? explicitLines = null,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? issueNotes = null,
        (string? CustomerId, string? CustomerName, string? CustomerCode)? customer = null,
        DateOnly? weekStartDate = null) =>
        new(GuidHelper.ToGuidString(batch.BatchId), GuidHelper.ToGuidString(batch.MenuVersionId), GuidHelper.ToGuidString(batch.QuantityImportBatchId), batch.Status, batch.Version, batch.CreatedAt, batch.ReadyAt, batch.CompletedAt,
            (explicitLines ?? batch.Lines.ToList()).Select(line => ReconciliationComparisonService.Map(
                line,
                actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(),
                dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)),
                LinkedQuantity(linkedIssued, line.BatchLineId),
                issueNotes?.GetValueOrDefault(Convert.ToHexString(line.BatchLineId)))).ToList())
        {
            CustomerId = customer?.CustomerId,
            CustomerName = customer?.CustomerName,
            CustomerCode = customer?.CustomerCode,
            WeekStartDate = weekStartDate,
            WeekEndDate = weekStartDate?.AddDays(5)
        };

    internal static decimal? LinkedQuantity(IReadOnlyDictionary<string, decimal>? linkedIssued, byte[] batchLineId) =>
        linkedIssued is not null && linkedIssued.TryGetValue(Convert.ToHexString(batchLineId), out var quantity) ? quantity : null;

    internal static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("ID không hợp lệ.");

    private async Task<(string? CustomerId, string? CustomerName, string? CustomerCode)?> TryGetCustomerAsync(byte[] menuVersionId, CancellationToken token)
    {
        if (context.Model.FindEntityType(typeof(MenuVersion)) is null)
            return null;

        var menuVersion = await context.Menuversions.AsNoTracking()
            .Where(mv => mv.MenuVersionId == menuVersionId)
            .Select(mv => new { mv.CustomerId })
            .SingleOrDefaultAsync(token);

        if (menuVersion is null)
            return null;

        var customerId = GuidHelper.ToGuidString(menuVersion.CustomerId);

        if (context.Model.FindEntityType(typeof(Customer)) is null)
            return (customerId, null, null);

        var customer = await context.Customers.AsNoTracking()
            .Where(c => c.CustomerId == menuVersion.CustomerId)
            .Select(c => new { c.CustomerName, c.CustomerCode })
            .SingleOrDefaultAsync(token);

        return (customerId, customer?.CustomerName, customer?.CustomerCode);
    }

    private async Task<IReadOnlyDictionary<string, DateOnly>> LoadWeeksForBatchesAsync(IReadOnlyList<ReconciliationBatch> batches, CancellationToken token)
    {
        if (batches.Count == 0 || context.Model.FindEntityType(typeof(MenuVersion)) is null)
            return new Dictionary<string, DateOnly>(StringComparer.Ordinal);
        var menuVersionIds = batches.Select(batch => batch.MenuVersionId).Distinct().ToList();
        return await context.Menuversions.AsNoTracking()
            .Where(version => menuVersionIds.Contains(version.MenuVersionId))
            .ToDictionaryAsync(version => Convert.ToHexString(version.MenuVersionId), version => version.WeekStartDate, StringComparer.Ordinal, token);
    }

    private async Task<IReadOnlyDictionary<string, (string? CustomerId, string? CustomerName, string? CustomerCode)>> LoadCustomersForBatchesAsync(
        IReadOnlyList<ReconciliationBatch> batches,
        CancellationToken token)
    {
        var result = new Dictionary<string, (string? CustomerId, string? CustomerName, string? CustomerCode)>(StringComparer.Ordinal);
        if (batches.Count == 0 || context.Model.FindEntityType(typeof(MenuVersion)) is null)
            return result;

        var menuVersionIds = batches.Select(x => x.MenuVersionId).Distinct().ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Where(mv => menuVersionIds.Contains(mv.MenuVersionId))
            .Select(mv => new { mv.MenuVersionId, mv.CustomerId })
            .ToListAsync(token);

        if (menuVersions.Count == 0)
            return result;

        Dictionary<string, (string CustomerName, string CustomerCode)>? customerLookup = null;
        if (context.Model.FindEntityType(typeof(Customer)) is not null)
        {
            var customerIds = menuVersions.Select(mv => mv.CustomerId).Distinct().ToList();
            var customers = await context.Customers.AsNoTracking()
                .Where(c => customerIds.Contains(c.CustomerId))
                .Select(c => new { c.CustomerId, c.CustomerName, c.CustomerCode })
                .ToListAsync(token);
            customerLookup = customers.ToDictionary(
                c => Convert.ToHexString(c.CustomerId),
                c => (c.CustomerName, c.CustomerCode),
                StringComparer.Ordinal
            );
        }

        foreach (var mv in menuVersions)
        {
            string? name = null;
            string? code = null;
            if (customerLookup is not null && customerLookup.TryGetValue(Convert.ToHexString(mv.CustomerId), out var cInfo))
            {
                name = cInfo.CustomerName;
                code = cInfo.CustomerCode;
            }

            result[Convert.ToHexString(mv.MenuVersionId)] = (
                GuidHelper.ToGuidString(mv.CustomerId),
                name,
                code
            );
        }

        return result;
    }
}
