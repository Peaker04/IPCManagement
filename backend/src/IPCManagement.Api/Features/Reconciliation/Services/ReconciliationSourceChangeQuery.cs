using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static partial class ReconciliationSourceChangeQuery
{
    private sealed record Sources(IQueryable<AuditLog> Audits, IQueryable<BomAdjustment> Adjustments, Func<AuditLog, bool>? InMemoryPredicate);

    internal static async Task<IReadOnlyList<ReconciliationSourceChangeDto>> ListAsync(IpcManagementContext context, string id, CancellationToken token = default)
    {
        var sources = await BuildSourcesAsync(context, id, token);
        var audits = await sources.Audits.ToListAsync(token);
        if (sources.InMemoryPredicate is not null) audits = audits.Where(sources.InMemoryPredicate).ToList();
        var adjustments = await sources.Adjustments.ToListAsync(token);
        return await MapAsync(context, audits, adjustments, token);
    }

    private static async Task<Sources> BuildSourcesAsync(IpcManagementContext context, string id, CancellationToken token)
    {
        var batchId = ReconciliationBatchService.RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking()
            .Include(item => item.Lines)
            .SingleOrDefaultAsync(item => item.BatchId == batchId, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối chiếu.");
        var batchLineIds = batch.Lines.Select(line => line.BatchLineId).ToList();
        var contributors = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(contributor => batchLineIds.Contains(contributor.BatchLineId)).ToListAsync(token);
        var revisions = await context.Reconciliationsourcerevisions.AsNoTracking()
            .Where(revision => revision.BatchId == batchId).ToListAsync(token);
        var versionIds = revisions.SelectMany(revision => new[] { revision.PreviousMenuVersionId, revision.AppliedMenuVersionId })
            .Append(batch.MenuVersionId)
            .DistinctBy(Convert.ToHexString)
            .ToList();
        var amendmentIds = revisions.Where(revision => revision.MenuAmendmentId != null)
            .Select(revision => revision.MenuAmendmentId!)
            .DistinctBy(Convert.ToHexString)
            .ToList();
        var revisionIds = revisions.Select(revision => revision.SourceRevisionId).ToList();
        var isInMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var versionScheduleIds = isInMemory
            ? (await context.Menuschedules.AsNoTracking().ToListAsync(token))
                .Where(schedule => schedule.MenuVersionId != null && versionIds.Any(id => id.AsSpan().SequenceEqual(schedule.MenuVersionId)))
                .Select(schedule => schedule.MenuScheduleId)
                .ToList()
            : await context.Menuschedules.AsNoTracking()
                .Where(schedule => schedule.MenuVersionId != null && versionIds.Contains(schedule.MenuVersionId))
                .Select(schedule => schedule.MenuScheduleId)
                .ToListAsync(token);
        var menuScheduleIds = contributors.Select(contributor => contributor.MenuScheduleId)
            .Concat(versionScheduleIds)
            .DistinctBy(Convert.ToHexString)
            .ToList();
        var quantityPlanLineIds = contributors.Select(contributor => contributor.MealQuantityPlanLineId).ToList();
        var dishBomIds = contributors.Select(contributor => contributor.DishBomId).ToList();
        var quantitySources = await context.Mealquantityplanlines.AsNoTracking()
            .Where(line => quantityPlanLineIds.Contains(line.QuantityPlanLineId))
            .Select(line => new { line.QuantityPlanId, line.MenuId }).Distinct().ToListAsync(token);
        var quantityPlanIds = quantitySources.Select(source => source.QuantityPlanId).ToList();
        var menuIds = quantitySources.Select(source => source.MenuId).ToList();

        Func<AuditLog, bool> inMemoryPredicate = audit =>
                    (audit.EntityName == nameof(MenuVersion) && versionIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(MenuAmendment) && amendmentIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(ReconciliationSourceRevision) && revisionIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(QuantityImportBatch) && batch.QuantityImportBatchId.AsSpan().SequenceEqual(audit.EntityId!))
                    || ((audit.EntityName == nameof(MenuItem) || audit.EntityName == nameof(MenuSchedule)) && menuScheduleIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(MealQuantityPlanLine) && quantityPlanLineIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(MealQuantityPlan) && quantityPlanIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(Menu) && menuIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)))
                    || (audit.EntityName == nameof(DishBom) && dishBomIds.Any(id => id.AsSpan().SequenceEqual(audit.EntityId!)));
        var auditQuery = isInMemory ? context.Auditlogs.AsNoTracking().Where(audit => audit.EntityId != null) : context.Auditlogs.AsNoTracking()
                .Where(audit => audit.EntityId != null && (
                    (audit.EntityName == nameof(MenuVersion) && versionIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(MenuAmendment) && amendmentIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(ReconciliationSourceRevision) && revisionIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(QuantityImportBatch) && audit.EntityId == batch.QuantityImportBatchId)
                    || ((audit.EntityName == nameof(MenuItem) || audit.EntityName == nameof(MenuSchedule)) && menuScheduleIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(MealQuantityPlanLine) && quantityPlanLineIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(MealQuantityPlan) && quantityPlanIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(Menu) && menuIds.Contains(audit.EntityId))
                    || (audit.EntityName == nameof(DishBom) && dishBomIds.Contains(audit.EntityId))));
        var adjustmentQuery = context.Bomadjustments.AsNoTracking().Where(adjustment => dishBomIds.Contains(adjustment.BomId));
        return new Sources(auditQuery, adjustmentQuery, isInMemory ? inMemoryPredicate : null);
    }

    private static async Task<IReadOnlyList<ReconciliationSourceChangeDto>> MapAsync(IpcManagementContext context,
        IReadOnlyList<AuditLog> audits, IReadOnlyList<BomAdjustment> adjustments, CancellationToken token)
    {
        var actorNames = await LoadActorNamesAsync(context,
            audits.Select(audit => audit.ChangedBy).Concat(adjustments.Select(adjustment => adjustment.AdjustedBy)).ToList(),
            token);
        var changes = audits.Select(audit => new ReconciliationSourceChangeDto(
                GuidHelper.ToGuidString(audit.AuditId), audit.ChangedAt,
                actorNames.GetValueOrDefault(Convert.ToHexString(audit.ChangedBy)) ?? GuidHelper.ToGuidString(audit.ChangedBy),
                audit.BusinessArea, audit.EntityName, GuidHelper.ToGuidString(audit.EntityId!),
                audit.FieldName, audit.OldValue, audit.NewValue, audit.Reason))
            .ToList();
        changes.AddRange(adjustments.Select(adjustment => new ReconciliationSourceChangeDto(
            GuidHelper.ToGuidString(adjustment.BomAdjustmentId), adjustment.AdjustedAt,
            actorNames.GetValueOrDefault(Convert.ToHexString(adjustment.AdjustedBy)) ?? GuidHelper.ToGuidString(adjustment.AdjustedBy),
            "BOM", nameof(BomAdjustment), GuidHelper.ToGuidString(adjustment.BomId),
            "QuantityAndWaste",
            FormatBomAdjustmentValue(adjustment.OldGrossQtyPerServing, adjustment.OldWasteRatePercent),
            FormatBomAdjustmentValue(adjustment.NewGrossQtyPerServing, adjustment.NewWasteRatePercent),
            adjustment.Reason)));

        var adjustmentKeys = changes
            .Where(change => change.EntityName == nameof(BomAdjustment))
            .Select(BomChangeIdentity)
            .ToHashSet(StringComparer.Ordinal);
        var referencedDishIds = changes.Where(change => change.FieldName == "DishId")
            .SelectMany(change => new[] { change.OldValue, change.NewValue })
            .Select(GuidHelper.ParseGuidString).Where(value => value is not null).Cast<byte[]>()
            .DistinctBy(Convert.ToHexString).ToList();
        var dishNames = referencedDishIds.Count == 0
            ? new Dictionary<string, string>(StringComparer.Ordinal)
            : (await context.Dishes.AsNoTracking()
                .Where(dish => referencedDishIds.Contains(dish.DishId))
                .Select(dish => new { dish.DishId, dish.DishCode, dish.DishName })
                .ToListAsync(token))
                .ToDictionary(dish => Convert.ToHexString(dish.DishId),
                    dish => $"{dish.DishName} ({dish.DishCode})", StringComparer.Ordinal);
        string? DishDisplay(string? value)
        {
            var parsed = GuidHelper.ParseGuidString(value);
            return parsed is null ? null : dishNames.GetValueOrDefault(Convert.ToHexString(parsed));
        }
        return changes
            .Where(change => change.EntityName == nameof(BomAdjustment) || !adjustmentKeys.Contains(BomChangeIdentity(change)))
            .OrderByDescending(change => change.ChangedAt)
            .ThenByDescending(change => change.ChangeId, StringComparer.Ordinal)
            .Select(change => change.FieldName == "DishId"
                ? change with { OldDisplayValue = DishDisplay(change.OldValue), NewDisplayValue = DishDisplay(change.NewValue) }
                : change)
            .ToList();
    }

    private static string FormatBomAdjustmentValue(decimal grossQuantity, decimal wasteRate) =>
        FormattableString.Invariant($"{grossQuantity:0.######} / hao hụt {wasteRate:0.##}%");

    private static string BomChangeIdentity(ReconciliationSourceChangeDto change) =>
        change.BusinessArea == "BOM"
        && change.EntityName is nameof(DishBom) or nameof(BomAdjustment)
        && change.FieldName == "QuantityAndWaste"
            ? string.Join('\u001f', change.EntityId, change.Actor, change.OldValue, change.NewValue, change.Reason)
            : $"change:{change.ChangeId}";

    private static async Task<IReadOnlyDictionary<string, string>> LoadActorNamesAsync(
        IpcManagementContext context,
        IReadOnlyList<byte[]> actorIds,
        CancellationToken token)
    {
        if (actorIds.Count == 0 || context.Model.FindEntityType(typeof(User)) is null)
            return new Dictionary<string, string>(StringComparer.Ordinal);
        var distinctIds = actorIds.DistinctBy(Convert.ToHexString).ToList();
        var users = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Users.AsNoTracking().ToListAsync(token))
                .Where(user => distinctIds.Any(id => id.AsSpan().SequenceEqual(user.UserId))).ToList()
            : await context.Users.AsNoTracking().Where(user => distinctIds.Contains(user.UserId)).ToListAsync(token);
        return users.ToDictionary(
            user => Convert.ToHexString(user.UserId),
            user => user.FullName ?? user.Username,
            StringComparer.Ordinal);
    }

}
