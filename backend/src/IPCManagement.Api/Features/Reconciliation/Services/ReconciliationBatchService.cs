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
        var batch = await context.Reconciliationbatches.AsNoTracking()
            .Include(item => item.Lines).ThenInclude(line => line.Ingredient)
            .Include(item => item.Lines).ThenInclude(line => line.CanonicalUnit)
            .SingleOrDefaultAsync(item => item.BatchId == batchId, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối chiếu.");

        var batchLinesById = batch.Lines.ToDictionary(line => Convert.ToHexString(line.BatchLineId), StringComparer.Ordinal);
        var batchLineIds = batch.Lines.Select(line => line.BatchLineId).ToList();

        var contributors = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(contributor => batchLineIds.Contains(contributor.BatchLineId)).ToListAsync(token);
        var dishBomIds = contributors.Select(contributor => contributor.DishBomId).Distinct().ToList();
        var quantityPlanLineIds = contributors.Select(contributor => contributor.MealQuantityPlanLineId).ToList();
        var planLines = await context.Mealquantityplanlines.AsNoTracking()
            .Where(line => quantityPlanLineIds.Contains(line.QuantityPlanLineId))
            .Include(line => line.MenuSchedule)
            .ToListAsync(token);
        var planLinesById = planLines.ToDictionary(line => Convert.ToHexString(line.QuantityPlanLineId), StringComparer.Ordinal);

        var boms = await context.Dishboms.AsNoTracking()
            .Where(bom => dishBomIds.Contains(bom.BomId))
            .Include(bom => bom.Dish)
            .Include(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
            .Include(bom => bom.Unit)
            .ToListAsync(token);

        var contributorMap = contributors
            .GroupBy(contributor => Convert.ToHexString(contributor.DishBomId))
            .ToDictionary(group => group.Key, group =>
            {
                var batchLineIds = group
                    .Select(contributor => Convert.ToHexString(contributor.BatchLineId))
                    .Distinct(StringComparer.Ordinal)
                    .ToList();
                if (batchLineIds.Count != 1)
                    throw new BusinessRuleException("Nguồn định mức của món không ánh xạ duy nhất tới dòng đã đóng băng; hãy chọn nguyên liệu trực tiếp từ lô để xuất thêm.");
                return group.First().BatchLineId;
            }, StringComparer.Ordinal);

        var groupedByDish = boms
            .GroupBy(bom => Convert.ToHexString(bom.DishId))
            .Select(group =>
            {
                var firstBom = group.First();
                var materials = group.Select(bom =>
                {
                    contributorMap.TryGetValue(Convert.ToHexString(bom.BomId), out var matchingLineId);
                    ReconciliationBatchLine? matchingLine = null;
                    if (matchingLineId is not null)
                    {
                        batchLinesById.TryGetValue(Convert.ToHexString(matchingLineId), out matchingLine);
                    }
                    if (matchingLine is null || !matchingLine.IngredientId.SequenceEqual(bom.IngredientId))
                        throw new BusinessRuleException("Nguyên liệu BOM hiện hành không khớp dòng đã đóng băng; hãy chọn nguyên liệu trực tiếp từ lô để xuất thêm.");
                    if (matchingLine.CanonicalUnit is null || bom.Unit is null) return null;
                    var grossConverted = ConvertToCanonical(bom.GrossQtyPerServing, bom.Unit, matchingLine.CanonicalUnit);
                    return new ReconciliationBatchDishMaterialDto(
                        GuidHelper.ToGuidString(matchingLine.BatchLineId),
                        GuidHelper.ToGuidString(bom.IngredientId),
                        bom.Ingredient?.IngredientCode,
                        bom.Ingredient?.IngredientName,
                        GuidHelper.ToGuidString(matchingLine.CanonicalUnitId),
                        matchingLine.CanonicalUnit?.UnitName,
                        // Round the final issue quantity after multiplying servings, not this rate.
                        grossConverted);
                })
                .Where(m => m != null)
                .Select(m => m!)
                .ToList();

                var groupBomIds = group.Select(bom => Convert.ToHexString(bom.BomId)).ToHashSet(StringComparer.Ordinal);
                var bomById = group.ToDictionary(bom => Convert.ToHexString(bom.BomId), StringComparer.Ordinal);
                var scopes = contributors
                    .Where(contributor => groupBomIds.Contains(Convert.ToHexString(contributor.DishBomId)))
                    .GroupBy(contributor => Convert.ToHexString(contributor.MealQuantityPlanLineId))
                    .Select(contributorGroup =>
                    {
                        if (!planLinesById.TryGetValue(contributorGroup.Key, out var planLine) || planLine.MenuSchedule is null) return null;
                        var frozenCandidates = contributorGroup.Select(contributor =>
                        {
                            if (!bomById.TryGetValue(Convert.ToHexString(contributor.DishBomId), out var bom)) return 0m;
                            if (!batchLinesById.TryGetValue(Convert.ToHexString(contributor.BatchLineId), out var frozenLine) || bom.Unit is null || frozenLine.CanonicalUnit is null) return 0m;
                            var rate = ConvertToCanonical(bom.GrossQtyPerServing, bom.Unit, frozenLine.CanonicalUnit);
                            return rate > 0 ? contributor.SourceQuantity / rate : 0m;
                        }).Where(value => value > 0).ToList();
                        if (frozenCandidates.Count == 0) return null;
                        var frozenServings = (int)Math.Round(frozenCandidates.Average(), MidpointRounding.AwayFromZero);
                        return new ReconciliationBatchDishScopeDto(
                            planLine.MenuSchedule.ServiceDate.ToString("yyyy-MM-dd"),
                            planLine.ShiftName,
                            frozenServings,
                            planLine.FinalServings,
                            Math.Max(0, planLine.FinalServings - frozenServings));
                    })
                    .Where(scope => scope is not null)
                    .Select(scope => scope!)
                    .OrderBy(scope => scope.ServiceDate)
                    .ThenBy(scope => scope.ShiftName)
                    .ToList();

                return new ReconciliationBatchDishSummaryDto(
                    GuidHelper.ToGuidString(firstBom.DishId),
                    firstBom.Dish?.DishCode ?? "",
                    firstBom.Dish?.DishName ?? "Món chưa đặt tên",
                    materials,
                    scopes);
            })
            .Where(d => d.Materials.Count > 0)
            .OrderBy(d => d.DishName)
            .ToList();

        return groupedByDish;
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
                    line.Contributors.Add(new ReconciliationBatchContributor
                    {
                        ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId,
                        MenuScheduleId = projectedSource.Source.MenuScheduleId,
                        MealQuantityPlanLineId = projectedSource.Source.QuantityPlanLineId,
                        DishBomId = bom.BomId, SourceQuantity = material.RequiredQuantity
                    });
                }
            }
        }
        if (batch.Lines.Count == 0
            || batch.Lines.Any(line => line.RequiredQuantity <= 0
                || line.Contributors.Count == 0
                || line.Contributors.Any(contributor => contributor.SourceQuantity <= 0)))
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
                var batch = await context.Reconciliationbatches.Include(x => x.Lines).ThenInclude(x => x.Contributors).SingleOrDefaultAsync(x => x.BatchId == bytes, operationToken) ?? throw new KeyNotFoundException();
                context.Entry(batch).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
                if (batch.Status != "DRAFT" || batch.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi.");
                if (batch.Lines.Count == 0 || batch.Lines.Any(x => x.RequiredQuantity <= 0 || x.FrozenTolerance < 0 || x.Contributors.Count == 0 || x.Contributors.Any(contributor => contributor.SourceQuantity <= 0))) throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu hợp lệ để sẵn sàng đối chiếu.");
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
