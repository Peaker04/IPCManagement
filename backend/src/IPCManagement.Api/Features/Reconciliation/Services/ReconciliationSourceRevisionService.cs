using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed record ReconciliationRevisionContributionFact(
    string MenuScheduleId,
    string MealQuantityPlanLineId,
    string DishBomId,
    string DishId,
    string ShiftName,
    string DishCode,
    string DishName,
    int Servings,
    decimal BomQuantityPerServing,
    decimal WasteRatePercent,
    decimal SourceQuantity);

public sealed record ReconciliationRevisionMaterialFact(
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity,
    IReadOnlyList<ReconciliationRevisionContributionFact>? Contributions = null);

public sealed class ReconciliationSourceRevisionService(IpcManagementContext context) : IReconciliationSourceRevisionStager
{
    public async Task<PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>> GetPendingPageAsync(
        ReconciliationSourceDeltaPageQuery request,
        CancellationToken token = default)
    {
        var query = context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(item => item.Status == "PENDING");
        if (!string.IsNullOrWhiteSpace(request.BatchId))
        {
            var batchId = ReconciliationBatchService.RequiredId(request.BatchId);
            query = query.Where(item => item.BatchId == batchId);
        }
        if (request.ServiceDate is { } serviceDate)
            query = query.Where(item => item.ServiceDate == serviceDate);
        if (!string.IsNullOrWhiteSpace(request.WorkKind))
        {
            var workKind = request.WorkKind.Trim().ToUpperInvariant();
            if (workKind is not ("SUPPLEMENTAL_ISSUE" or "RETURN_REQUIRED"))
                throw new ArgumentException("Loại công việc thay đổi nguồn không hợp lệ.");
            query = query.Where(item => item.WorkKind == workKind);
        }

        var total = await query.CountAsync(token);
        var rows = await (
                from item in query
                join daily in context.Reconciliationbatchdailylines.AsNoTracking() on item.DailyLineId equals daily.DailyLineId
                join line in context.Reconciliationbatchlines.AsNoTracking() on daily.BatchLineId equals line.BatchLineId
                join ingredient in context.Ingredients.AsNoTracking() on item.IngredientId equals ingredient.IngredientId
                join unit in context.Units.AsNoTracking() on item.CanonicalUnitId equals unit.UnitId
                orderby item.CreatedAt, item.SourceDeltaId
                select new ReconciliationSourceDeltaQueueItemDto(
                    GuidHelper.ToGuidString(item.SourceDeltaId), GuidHelper.ToGuidString(item.SourceRevisionId),
                    GuidHelper.ToGuidString(item.BatchId), GuidHelper.ToGuidString(daily.DailyLineId), item.ServiceDate,
                    GuidHelper.ToGuidString(item.IngredientId), ingredient.IngredientCode,
                    ingredient.IngredientName, GuidHelper.ToGuidString(item.CanonicalUnitId),
                    unit.UnitName, item.PreviousRequiredQuantity,
                    item.NewRequiredQuantity, item.DeltaQuantity, item.WorkKind, item.Status, item.Version, item.CreatedAt))
            .Skip((request.PageNumber - 1) * request.PageSize).Take(request.PageSize)
            .ToListAsync(token);
        return PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>.Create(rows, total, request.PageNumber, request.PageSize);
    }

    public async Task<ReconciliationSourceRevision> StageBatchAsync(
        string batchId,
        string menuAmendmentId,
        string previousMenuVersionId,
        string appliedMenuVersionId,
        IReadOnlyList<ReconciliationRevisionMaterialFact> currentRequirements,
        string actorId,
        string reason,
        CancellationToken token = default)
    {
        var batchBytes = ReconciliationBatchService.RequiredId(batchId);
        var amendmentBytes = ReconciliationBatchService.RequiredId(menuAmendmentId);
        var existing = await context.Reconciliationsourcerevisions
            .SingleOrDefaultAsync(item => item.MenuAmendmentId == amendmentBytes && item.BatchId == batchBytes, token);
        if (existing is not null) return existing;

        var batch = await context.Reconciliationbatches
            .Include(item => item.Lines).ThenInclude(item => item.DailyLines)
            .Include(item => item.Lines).ThenInclude(item => item.Contributors)
            .SingleOrDefaultAsync(item => item.BatchId == batchBytes, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát bị ảnh hưởng.");
        if (batch.Status == "COMPLETED")
            throw new InvalidOperationException("Không thể áp dụng thay đổi nguồn vào lô đã hoàn tất.");

        var issued = await context.Inventoryissues.AsNoTracking()
            .AnyAsync(item => item.ReconciliationBatchId == batchBytes, token);
        if (!issued && currentRequirements.Any(item => item.RequiredQuantity > 0 && (item.Contributions is null || item.Contributions.Count == 0)))
            throw new InvalidOperationException("Lô chưa xuất kho cần đủ lineage món, ca, số suất và BOM để supersede nguồn.");
        var frozen = batch.Lines.SelectMany(line => line.DailyLines.Select(daily => new ReconciliationRequiredFact(
            GuidHelper.ToGuidString(daily.DailyLineId), daily.ServiceDate,
            GuidHelper.ToGuidString(daily.IngredientId), GuidHelper.ToGuidString(daily.CanonicalUnitId), daily.RequiredQuantity))).ToList();
        var current = currentRequirements.Select(item => new ReconciliationCurrentRequirement(
            item.ServiceDate, item.IngredientId, item.CanonicalUnitId, item.RequiredQuantity)).ToList();
        var projected = ReconciliationSourceDeltaProjector.Project(frozen, current);
        var revisionNumber = (await context.Reconciliationsourcerevisions.AsNoTracking()
            .Where(item => item.BatchId == batchBytes).Select(item => (long?)item.RevisionNumber).MaxAsync(token) ?? 0) + 1;
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var now = DateTime.UtcNow;
        var revision = new ReconciliationSourceRevision
        {
            SourceRevisionId = GuidHelper.NewId(), MenuAmendmentId = amendmentBytes, BatchId = batchBytes,
            PreviousMenuVersionId = ReconciliationBatchService.RequiredId(previousMenuVersionId),
            AppliedMenuVersionId = ReconciliationBatchService.RequiredId(appliedMenuVersionId),
            RevisionNumber = revisionNumber, Status = "APPLIED", Reason = reason.Trim(), AppliedBy = actor, AppliedAt = now
        };
        context.Reconciliationsourcerevisions.Add(revision);

        var tolerances = await context.Reconciliationtolerances.AsNoTracking().ToListAsync(token);
        foreach (var delta in projected)
        {
            var ingredientId = ReconciliationBatchService.RequiredId(delta.IngredientId);
            var unitId = ReconciliationBatchService.RequiredId(delta.CanonicalUnitId);
            ReconciliationBatchDailyLine dailyLine;
            if (delta.DailyLineId is not null)
            {
                dailyLine = batch.Lines.SelectMany(item => item.DailyLines)
                    .Single(item => item.DailyLineId.SequenceEqual(ReconciliationBatchService.RequiredId(delta.DailyLineId)));
            }
            else
            {
                var batchLine = batch.Lines.SingleOrDefault(item => item.IngredientId.SequenceEqual(ingredientId) && item.CanonicalUnitId.SequenceEqual(unitId));
                if (batchLine is null)
                {
                    var tolerance = ReconciliationBatchService.ResolveTolerance(tolerances, ingredientId, unitId);
                    batchLine = new ReconciliationBatchLine
                    {
                        BatchLineId = GuidHelper.NewId(), BatchId = batchBytes, Batch = batch,
                        IngredientId = ingredientId, CanonicalUnitId = unitId, RequiredQuantity = issued ? 0 : delta.NewQuantity,
                        FrozenTolerance = tolerance.Value, ToleranceSourceKind = tolerance.Kind, ToleranceSourceVersion = tolerance.Version, Version = 1
                    };
                    batch.Lines.Add(batchLine);
                }
                dailyLine = new ReconciliationBatchDailyLine
                {
                    DailyLineId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, BatchId = batchBytes,
                    IngredientId = ingredientId, CanonicalUnitId = unitId, ServiceDate = delta.ServiceDate,
                    RequiredQuantity = issued ? 0 : delta.NewQuantity, Version = 1, BatchLine = batchLine
                };
                batchLine.DailyLines.Add(dailyLine);
            }

            if (!issued)
            {
                dailyLine.RequiredQuantity = delta.NewQuantity;
                dailyLine.Version++;
            }

            var entity = new ReconciliationSourceDelta
            {
                SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = revision.SourceRevisionId, SourceRevision = revision,
                BatchId = batchBytes, DailyLineId = dailyLine.DailyLineId, DailyLine = dailyLine, ServiceDate = delta.ServiceDate,
                IngredientId = ingredientId, CanonicalUnitId = unitId,
                PreviousRequiredQuantity = delta.PreviousQuantity, NewRequiredQuantity = delta.NewQuantity,
                DeltaQuantity = delta.DeltaQuantity, WorkKind = delta.WorkKind, Status = issued ? "PENDING" : "RESOLVED",
                Version = 1, CreatedAt = now, ResolvedAt = issued ? null : now
            };
            revision.Deltas.Add(entity);
            context.Reconciliationsourcedeltas.Add(entity);

            if (issued && delta.DailyLineId is not null)
            {
                var disposition = await context.Reconciliationdailydispositions
                    .SingleOrDefaultAsync(item => item.DailyLineId == dailyLine.DailyLineId && item.InvalidatedAt == null, token);
                if (disposition is not null)
                {
                    disposition.InvalidatedAt = now;
                    disposition.InvalidatedBy = actor;
                    disposition.InvalidationReason = $"Source revision {revisionNumber}: {reason.Trim()}";
                }
            }
        }

        if (!issued)
        {
            context.Reconciliationbatchcontributors.RemoveRange(batch.Lines.SelectMany(item => item.Contributors));
            foreach (var requirement in currentRequirements.Where(item => item.RequiredQuantity > 0))
            {
                var ingredientId = ReconciliationBatchService.RequiredId(requirement.IngredientId);
                var unitId = ReconciliationBatchService.RequiredId(requirement.CanonicalUnitId);
                var line = batch.Lines.Single(item => item.IngredientId.SequenceEqual(ingredientId) && item.CanonicalUnitId.SequenceEqual(unitId));
                var daily = line.DailyLines.Single(item => item.ServiceDate == requirement.ServiceDate);
                foreach (var contribution in requirement.Contributions ?? [])
                {
                    line.Contributors.Add(new ReconciliationBatchContributor
                    {
                        ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line,
                        DailyLineId = daily.DailyLineId, DailyLine = daily,
                        MenuScheduleId = ReconciliationBatchService.RequiredId(contribution.MenuScheduleId),
                        MealQuantityPlanLineId = ReconciliationBatchService.RequiredId(contribution.MealQuantityPlanLineId),
                        DishBomId = ReconciliationBatchService.RequiredId(contribution.DishBomId),
                        DishId = ReconciliationBatchService.RequiredId(contribution.DishId),
                        FrozenShiftName = contribution.ShiftName, FrozenDishCode = contribution.DishCode,
                        FrozenDishName = contribution.DishName, FrozenServings = contribution.Servings,
                        FrozenBomQuantityPerServing = contribution.BomQuantityPerServing,
                        FrozenWasteRatePercent = contribution.WasteRatePercent,
                        SourceQuantity = contribution.SourceQuantity
                    });
                }
            }
            foreach (var line in batch.Lines)
                line.RequiredQuantity = line.DailyLines.Sum(item => item.RequiredQuantity);
            batch.MenuVersionId = revision.AppliedMenuVersionId;
            batch.Version++;
        }

        await context.SaveChangesAsync(token);
        return revision;
    }

    public Task<ReconciliationSourceRevision> StageIssuedBatchAsync(
        string batchId,
        string menuAmendmentId,
        string previousMenuVersionId,
        string appliedMenuVersionId,
        IReadOnlyList<ReconciliationRevisionMaterialFact> currentRequirements,
        string actorId,
        string reason,
        CancellationToken token = default)
        => StageBatchAsync(batchId, menuAmendmentId, previousMenuVersionId, appliedMenuVersionId,
            currentRequirements, actorId, reason, token);

    public async Task StageAffectedBatchesAsync(
        string amendmentId,
        byte[] baseMenuVersionId,
        byte[] newMenuVersionId,
        string? actorUserId,
        string reason,
        IReadOnlyList<MenuSchedule> schedules,
        CancellationToken cancellationToken = default)
    {
        var affectedBatchIds = await context.Reconciliationbatches.AsNoTracking()
            .Where(item => item.MenuVersionId == baseMenuVersionId && item.Status != "COMPLETED")
            .Select(item => item.BatchId)
            .ToListAsync(cancellationToken);
        if (affectedBatchIds.Count == 0) return;

        var scheduleIds = schedules.Select(schedule => schedule.MenuScheduleId).ToList();
        var projectedSources = await context.Mealquantityplanlines
            .Where(item => scheduleIds.Contains(item.MenuScheduleId))
            .Include(item => item.QuantityPlan)
            .Include(item => item.MenuSchedule)
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Unit)
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        var requirements = ReconciliationMaterialProjection.Project(projectedSources)
            .SelectMany(source => source.Dishes.SelectMany(dish => dish.Materials.Select(material => new ReconciliationRevisionMaterialFact(
                source.Source.QuantityPlan.ServiceDate,
                GuidHelper.ToGuidString(material.Bom.IngredientId),
                GuidHelper.ToGuidString(material.Bom.Ingredient.UnitId),
                material.RequiredQuantity,
                [new ReconciliationRevisionContributionFact(
                    GuidHelper.ToGuidString(source.Source.MenuScheduleId),
                    GuidHelper.ToGuidString(source.Source.QuantityPlanLineId),
                    GuidHelper.ToGuidString(material.Bom.BomId),
                    GuidHelper.ToGuidString(dish.MenuItem.DishId!),
                    source.Source.ShiftName, dish.MenuItem.Dish.DishCode, dish.MenuItem.Dish.DishName,
                    source.Source.FinalServings, material.Bom.GrossQtyPerServing,
                    material.Bom.WasteRatePercent, material.RequiredQuantity)]))))
            .GroupBy(item => new { item.ServiceDate, item.IngredientId, item.CanonicalUnitId })
            .Select(group => new ReconciliationRevisionMaterialFact(
                group.Key.ServiceDate, group.Key.IngredientId, group.Key.CanonicalUnitId,
                group.Sum(item => item.RequiredQuantity), group.SelectMany(item => item.Contributions ?? []).ToList()))
            .ToList();

        foreach (var batchId in affectedBatchIds)
        {
            await StageBatchAsync(
                GuidHelper.ToGuidString(batchId), amendmentId,
                GuidHelper.ToGuidString(baseMenuVersionId), GuidHelper.ToGuidString(newMenuVersionId),
                requirements, actorUserId!, reason, cancellationToken);
        }
    }
}
