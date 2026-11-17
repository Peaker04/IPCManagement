using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationApprovedSupplementalQuery
{
    internal static async Task<IReadOnlyList<ReconciliationSupplementalDemandMaterial>> LoadMaterialsAsync(IpcManagementContext context,
        IReadOnlyList<byte[]> batchIds, DateOnly start, DateOnly end, CancellationToken token)
    {
        if (batchIds.Count == 0) return [];
        var query = context.Reconciliationsupplementaldemandmaterials.AsNoTracking().Include(x => x.Demand)
            .Include(x => x.Contributions).ThenInclude(x => x.DemandDish)
            .Where(x => x.Demand.Status == "APPROVED" && x.Demand.ServiceDate >= start && x.Demand.ServiceDate <= end);
        var inMemory = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";
        if (!inMemory) query = query.Where(x => batchIds.Contains(x.BatchId));
        var rows = await query.ToListAsync(token);
        if (inMemory) rows = rows.Where(x => batchIds.Any(id => id.SequenceEqual(x.BatchId))).ToList();
        if (rows.Any(x => !x.Demand.BatchId.SequenceEqual(x.BatchId) || x.Contributions.Count == 0
            || x.Contributions.Any(c => !c.DemandDish.DemandId.SequenceEqual(x.DemandId))
            || x.RequiredQuantity != DecimalPolicy.RoundQuantity(x.Contributions.Sum(RequiredQuantity))))
            throw new InvalidOperationException("SUPPLEMENTAL_SNAPSHOT_LINEAGE_INVALID: Định lượng snapshot phát sinh không khớp các món đã duyệt.");
        return rows;
    }

    internal static decimal RequiredQuantity(ReconciliationSupplementalDemandContribution contribution)
    {
        if (contribution.FrozenBomQuantityPerServing <= 0 || contribution.FrozenBomUnitToBaseRate <= 0
            || contribution.FrozenCanonicalUnitToBaseRate <= 0 || contribution.DemandDish.ExtraServings <= 0)
            throw new InvalidOperationException("SUPPLEMENTAL_SNAPSHOT_QUANTITY_INVALID: Snapshot thiếu định lượng hoặc quy đổi hợp lệ.");
        return checked(contribution.FrozenBomQuantityPerServing * contribution.FrozenBomUnitToBaseRate
            / contribution.FrozenCanonicalUnitToBaseRate * contribution.DemandDish.ExtraServings);
    }

    internal static async Task<IReadOnlyList<ReconciliationSupplementalDemandContribution>> LoadAsync(IpcManagementContext context,
        IReadOnlyList<byte[]> batchIds, CancellationToken token)
    {
        if (batchIds.Count == 0) return [];
        var query = context.Reconciliationsupplementaldemandcontributions.AsNoTracking()
            .Include(x => x.DemandDish).ThenInclude(x => x.Demand)
            .Include(x => x.DemandMaterial).ThenInclude(x => x.DailyLine)
            .Where(x => x.DemandDish.Demand.Status == "APPROVED");
        var inMemory = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";
        if (!inMemory) query = query.Where(x => batchIds.Contains(x.DemandDish.Demand.BatchId));
        var rows = await query.ToListAsync(token);
        if (inMemory) rows = rows.Where(x => batchIds.Any(id => id.SequenceEqual(x.DemandDish.Demand.BatchId))).ToList();
        if (rows.Any(x => x.DemandMaterial.DailyLine is null
            || !x.DemandDish.DemandId.SequenceEqual(x.DemandMaterial.DemandId)
            || !x.DemandDish.Demand.BatchId.SequenceEqual(x.DemandMaterial.BatchId)
            || !x.DemandMaterial.BatchId.SequenceEqual(x.DemandMaterial.DailyLine.BatchId)
            || x.DemandDish.Demand.ServiceDate != x.DemandMaterial.DailyLine.ServiceDate
            || !x.DemandMaterial.IngredientId.SequenceEqual(x.DemandMaterial.DailyLine.IngredientId)
            || !x.DemandMaterial.CanonicalUnitId.SequenceEqual(x.DemandMaterial.DailyLine.CanonicalUnitId)))
            throw new InvalidOperationException("SUPPLEMENTAL_SNAPSHOT_LINEAGE_INVALID: Snapshot phát sinh không khớp nguồn đóng băng.");
        return rows;
    }
}
