using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

/// <summary>Người, vai trò, chế độ và lý do của một lần áp dụng thay đổi nguồn MRX (BR-MRX-EDIT-8).</summary>
public sealed record MrxRevisionStamp(
    byte[] ActorId,
    string ActorRole,
    string ApplyMode,
    string Reason,
    byte[] PreviousMenuVersionId,
    byte[] AppliedMenuVersionId,
    byte[]? MenuAmendmentId);

/// <summary>
/// BR-MRX-EDIT-3/5/7: tính lại tại chỗ lô đối soát hiện có, chỉ cho các ngày chưa khóa.
/// Ngày khóa giữ nguyên daily line và contributor; không sinh xuất thêm/trả hàng.
/// </summary>
public sealed class MrxBatchRecomputer(IpcManagementContext context)
{
    public const string AppliedStatus = "APPLIED";

    /// <summary>Tải lô (được theo dõi) cùng batch line, daily line và contributor để tính lại.</summary>
    public static async Task<ReconciliationBatch> LoadBatchAsync(IpcManagementContext ctx, byte[] batchId, CancellationToken ct)
        => await ctx.Reconciliationbatches
            .Include(item => item.Lines).ThenInclude(item => item.DailyLines)
            .Include(item => item.Lines).ThenInclude(item => item.Contributors)
            .AsSplitQuery()
            .SingleOrDefaultAsync(item => item.BatchId == batchId, ct)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát bị ảnh hưởng.");

    /// <summary>Tính yêu cầu định lượng theo ngày × nguyên liệu (kèm lineage contributor) từ nguồn hiện tại của các lịch thực đơn.</summary>
    public static async Task<IReadOnlyList<ReconciliationRevisionMaterialFact>> LoadRequirementsAsync(
        IpcManagementContext ctx,
        IReadOnlyCollection<byte[]> menuScheduleIds,
        CancellationToken ct)
    {
        var scheduleIds = menuScheduleIds.ToList();
        var sources = await ctx.Mealquantityplanlines
            .Where(item => scheduleIds.Contains(item.MenuScheduleId))
            .Include(item => item.QuantityPlan)
            .Include(item => item.MenuSchedule)
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Unit)
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
            .AsSplitQuery()
            .ToListAsync(ct);
        return BuildRequirements(ReconciliationMaterialProjection.Project(sources));
    }

    internal static IReadOnlyList<ReconciliationRevisionMaterialFact> BuildRequirements(IReadOnlyList<ProjectedSourceLine> projected)
        => projected
            .SelectMany(source => source.Dishes.SelectMany(dish => dish.Materials.Select(material => new ReconciliationRevisionMaterialFact(
                source.Source.MenuSchedule.ServiceDate,
                GuidHelper.ToGuidString(material.Bom.IngredientId),
                GuidHelper.ToGuidString(material.Bom.Ingredient.UnitId),
                material.RequiredQuantity,
                [ContributionFrom(source, dish, material)]))))
            .GroupBy(item => new { item.ServiceDate, item.IngredientId, item.CanonicalUnitId })
            .Select(group => new ReconciliationRevisionMaterialFact(
                group.Key.ServiceDate, group.Key.IngredientId, group.Key.CanonicalUnitId,
                group.Sum(item => item.RequiredQuantity), group.SelectMany(item => item.Contributions ?? []).ToList()))
            .ToList();

    /// <summary>Lineage của một món × BOM trong một dòng số suất; dùng chung cho tạo lô và tính lại lô.</summary>
    internal static ReconciliationRevisionContributionFact ContributionFrom(ProjectedSourceLine source, ProjectedDish dish, ProjectedMaterial material)
        => new(
            GuidHelper.ToGuidString(source.Source.MenuScheduleId),
            GuidHelper.ToGuidString(source.Source.QuantityPlanLineId),
            GuidHelper.ToGuidString(material.Bom.BomId),
            GuidHelper.ToGuidString(dish.MenuItem.DishId!),
            source.Source.ShiftName, dish.MenuItem.Dish.DishCode, dish.MenuItem.Dish.DishName,
            dish.Servings, material.Bom.GrossQtyPerServing, material.Bom.WasteRatePercent, material.RequiredQuantity,
            dish.MenuVariant);

    /// <summary>Contributor đóng băng (có <c>FrozenMenuVariant</c> và số suất của đúng loại) cho một daily line.</summary>
    internal static ReconciliationBatchContributor CreateContributor(
        ReconciliationBatchLine line,
        ReconciliationBatchDailyLine daily,
        ReconciliationRevisionContributionFact contribution)
        => new()
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line,
            DailyLineId = daily.DailyLineId, DailyLine = daily,
            MenuScheduleId = ReconciliationBatchService.RequiredId(contribution.MenuScheduleId),
            MealQuantityPlanLineId = ReconciliationBatchService.RequiredId(contribution.MealQuantityPlanLineId),
            DishBomId = ReconciliationBatchService.RequiredId(contribution.DishBomId),
            DishId = ReconciliationBatchService.RequiredId(contribution.DishId),
            FrozenShiftName = contribution.ShiftName,
            FrozenDishCode = contribution.DishCode,
            FrozenDishName = contribution.DishName,
            FrozenMenuVariant = contribution.MenuVariant,
            FrozenServings = contribution.Servings,
            FrozenBomQuantityPerServing = contribution.BomQuantityPerServing,
            FrozenWasteRatePercent = contribution.WasteRatePercent,
            SourceQuantity = contribution.SourceQuantity
        };

    public async Task<ReconciliationSourceRevision> ApplyAsync(
        ReconciliationBatch batch,
        IReadOnlyList<ReconciliationRevisionMaterialFact> requirements,
        IReadOnlySet<DateOnly> lockedDates,
        MrxRevisionStamp stamp,
        CancellationToken ct)
    {
        if (batch.Status == "COMPLETED")
            throw new MrxSourceChangeException(MrxErrorCodes.BatchCompleted, StatusCodes.Status409Conflict,
                "Lô đối soát đã hoàn tất nên mọi ngày đều bị khóa; không thể áp dụng thay đổi nguồn.");
        if (stamp.MenuAmendmentId is { } amendmentId)
        {
            var existing = await context.Reconciliationsourcerevisions
                .SingleOrDefaultAsync(item => item.MenuAmendmentId == amendmentId && item.BatchId == batch.BatchId, ct);
            if (existing is not null) return existing;
        }

        // Ngày khóa: bỏ qua hoàn toàn yêu cầu mới (BR-MRX-EDIT-7).
        var required = requirements
            .Where(item => !lockedDates.Contains(item.ServiceDate))
            .GroupBy(item => Key(item.ServiceDate, ReconciliationBatchService.RequiredId(item.IngredientId), ReconciliationBatchService.RequiredId(item.CanonicalUnitId)))
            .ToDictionary(group => group.Key, group => new OpenRequirement(
                Round(group.Sum(item => item.RequiredQuantity)),
                group.SelectMany(item => item.Contributions ?? []).ToList()));
        if (required.Values.Any(item => item.Quantity > 0 && item.Contributions.Count == 0))
            throw new BusinessRuleException("Ngày chưa khóa cần đủ lineage món, ca, số suất và BOM để tính lại định lượng.");

        var dailyLines = batch.Lines.SelectMany(line => line.DailyLines).ToList();
        var openDates = dailyLines.Select(item => item.ServiceDate)
            .Concat(required.Keys.Select(key => key.ServiceDate))
            .Where(date => !lockedDates.Contains(date))
            .Distinct()
            .Order()
            .ToList();

        var now = DateTime.UtcNow;
        var revisionNumber = (await context.Reconciliationsourcerevisions.AsNoTracking()
            .Where(item => item.BatchId == batch.BatchId).Select(item => (long?)item.RevisionNumber).MaxAsync(ct) ?? 0) + 1;
        var revision = new ReconciliationSourceRevision
        {
            SourceRevisionId = GuidHelper.NewId(), MenuAmendmentId = stamp.MenuAmendmentId, BatchId = batch.BatchId,
            PreviousMenuVersionId = stamp.PreviousMenuVersionId, AppliedMenuVersionId = stamp.AppliedMenuVersionId,
            RevisionNumber = revisionNumber, Status = AppliedStatus, Reason = stamp.Reason.Trim(),
            AppliedBy = stamp.ActorId, AppliedAt = now, AppliedByRole = stamp.ActorRole, ApplyMode = stamp.ApplyMode
        };
        context.Reconciliationsourcerevisions.Add(revision);

        // Chênh lệch theo ngày × nguyên liệu chỉ trên các ngày mở; ngày khóa không tham gia so sánh.
        var projected = ReconciliationSourceDeltaProjector.Project(
            dailyLines.Where(item => !lockedDates.Contains(item.ServiceDate)).Select(item => new ReconciliationRequiredFact(
                GuidHelper.ToGuidString(item.DailyLineId), item.ServiceDate,
                GuidHelper.ToGuidString(item.IngredientId), GuidHelper.ToGuidString(item.CanonicalUnitId), item.RequiredQuantity)),
            required.Select(entry => new ReconciliationCurrentRequirement(
                entry.Key.ServiceDate,
                GuidHelper.ToGuidString(Convert.FromHexString(entry.Key.IngredientHex)),
                GuidHelper.ToGuidString(Convert.FromHexString(entry.Key.UnitHex)),
                entry.Value.Quantity)));

        List<ReconciliationTolerance>? tolerances = null;
        var changedExistingDailyLines = new List<ReconciliationBatchDailyLine>();
        foreach (var change in projected)
        {
            var ingredientId = ReconciliationBatchService.RequiredId(change.IngredientId);
            var unitId = ReconciliationBatchService.RequiredId(change.CanonicalUnitId);
            ReconciliationBatchDailyLine daily;
            if (change.DailyLineId is not null)
            {
                var dailyLineId = ReconciliationBatchService.RequiredId(change.DailyLineId);
                daily = dailyLines.Single(item => item.DailyLineId.AsSpan().SequenceEqual(dailyLineId));
                daily.RequiredQuantity = change.NewQuantity;
                daily.Version++;
                changedExistingDailyLines.Add(daily);
            }
            else
            {
                var line = batch.Lines.SingleOrDefault(item => item.IngredientId.AsSpan().SequenceEqual(ingredientId) && item.CanonicalUnitId.AsSpan().SequenceEqual(unitId));
                if (line is null)
                {
                    tolerances ??= await context.Reconciliationtolerances.AsNoTracking().ToListAsync(ct);
                    var tolerance = ReconciliationBatchService.ResolveTolerance(tolerances, ingredientId, unitId);
                    line = new ReconciliationBatchLine
                    {
                        BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch,
                        IngredientId = ingredientId, CanonicalUnitId = unitId, RequiredQuantity = 0m,
                        FrozenTolerance = tolerance.Value, ToleranceSourceKind = tolerance.Kind, ToleranceSourceVersion = tolerance.Version, Version = 1
                    };
                    batch.Lines.Add(line);
                    context.Reconciliationbatchlines.Add(line);
                }
                daily = new ReconciliationBatchDailyLine
                {
                    DailyLineId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchId = batch.BatchId,
                    IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId, ServiceDate = change.ServiceDate,
                    RequiredQuantity = change.NewQuantity, Version = 1, BatchLine = line
                };
                line.DailyLines.Add(daily);
                context.Reconciliationbatchdailylines.Add(daily);
                dailyLines.Add(daily);
            }

            var delta = new ReconciliationSourceDelta
            {
                SourceDeltaId = GuidHelper.NewId(), SourceRevisionId = revision.SourceRevisionId, SourceRevision = revision,
                BatchId = batch.BatchId, DailyLineId = daily.DailyLineId, DailyLine = daily, ServiceDate = change.ServiceDate,
                IngredientId = daily.IngredientId, CanonicalUnitId = daily.CanonicalUnitId,
                PreviousRequiredQuantity = change.PreviousQuantity, NewRequiredQuantity = change.NewQuantity,
                DeltaQuantity = change.DeltaQuantity, WorkKind = change.WorkKind, Status = AppliedStatus, Version = 1, CreatedAt = now
            };
            revision.Deltas.Add(delta);
            context.Reconciliationsourcedeltas.Add(delta);
        }

        foreach (var date in openDates)
            ReplaceContributors(batch, dailyLines, required, date);

        foreach (var daily in changedExistingDailyLines)
        {
            // Quyết định chênh lệch cũ không còn đúng với định lượng mới; vô hiệu hóa, không xóa cứng.
            var disposition = await context.Reconciliationdailydispositions
                .SingleOrDefaultAsync(item => item.DailyLineId == daily.DailyLineId && item.InvalidatedAt == null, ct);
            if (disposition is null) continue;
            disposition.InvalidatedAt = now;
            disposition.InvalidatedBy = stamp.ActorId;
            disposition.InvalidationReason = $"Source revision {revisionNumber}: {stamp.Reason.Trim()}";
        }

        foreach (var line in batch.Lines)
            line.RequiredQuantity = line.DailyLines.Sum(item => item.RequiredQuantity);
        batch.MenuVersionId = stamp.AppliedMenuVersionId;
        batch.Version++;

        await context.SaveChangesAsync(ct);
        return revision;
    }

    private void ReplaceContributors(
        ReconciliationBatch batch,
        IReadOnlyList<ReconciliationBatchDailyLine> dailyLines,
        IReadOnlyDictionary<DayKey, OpenRequirement> required,
        DateOnly date)
    {
        var dayDailyIds = dailyLines.Where(item => item.ServiceDate == date)
            .Select(item => Convert.ToHexString(item.DailyLineId)).ToHashSet(StringComparer.Ordinal);
        var stale = batch.Lines.SelectMany(line => line.Contributors)
            .Where(item => item.DailyLineId is not null && dayDailyIds.Contains(Convert.ToHexString(item.DailyLineId)))
            .ToList();
        foreach (var contributor in stale)
        {
            contributor.BatchLine?.Contributors.Remove(contributor);
            contributor.DailyLine?.Contributors.Remove(contributor);
            context.Reconciliationbatchcontributors.Remove(contributor);
        }

        foreach (var (key, requirement) in required.Where(entry => entry.Key.ServiceDate == date && entry.Value.Quantity > 0))
        {
            var daily = dailyLines.Single(item => Key(item.ServiceDate, item.IngredientId, item.CanonicalUnitId) == key);
            var line = daily.BatchLine;
            foreach (var contribution in requirement.Contributions)
            {
                var contributor = CreateContributor(line, daily, contribution);
                line.Contributors.Add(contributor);
                context.Reconciliationbatchcontributors.Add(contributor);
            }
        }
    }

    private static decimal Round(decimal value) => decimal.Round(value, 6, MidpointRounding.AwayFromZero);

    private static DayKey Key(DateOnly date, byte[] ingredientId, byte[] unitId)
        => new(date, Convert.ToHexString(ingredientId), Convert.ToHexString(unitId));

    private readonly record struct DayKey(DateOnly ServiceDate, string IngredientHex, string UnitHex);

    private sealed record OpenRequirement(decimal Quantity, IReadOnlyList<ReconciliationRevisionContributionFact> Contributions);
}
