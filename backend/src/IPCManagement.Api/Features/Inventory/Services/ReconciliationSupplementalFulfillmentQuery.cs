using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class ReconciliationSupplementalFulfillmentQuery
{
    internal static async Task<ReconciliationSupplementalFulfillmentDto> GetAsync(IpcManagementContext context,
        byte[] batchId, DateOnly day, CancellationToken token = default)
    {
        var lines = await context.Reconciliationbatchdailylines.AsNoTracking()
            .Where(x => x.BatchId == batchId && x.ServiceDate == day).ToListAsync(token);
        var pending = await context.Reconciliationsupplementaldemands.AsNoTracking()
            .CountAsync(x => x.BatchId == batchId && x.ServiceDate == day && x.Status == "PENDING", token);
        var projected = await GetManyAsync(context, lines, token);
        return new(GuidHelper.ToGuidString(batchId), day, pending, projected.Values.ToList());
    }

    internal static async Task<IReadOnlyDictionary<string, ReconciliationSupplementalFulfillmentLineDto>> GetManyAsync(
        IpcManagementContext context, IReadOnlyList<ReconciliationBatchDailyLine> lines, CancellationToken token = default)
    {
        if (lines.Count == 0) return new Dictionary<string, ReconciliationSupplementalFulfillmentLineDto>();
        var dailyIds = lines.Select(x => x.DailyLineId).ToList();
        var materials = await context.Reconciliationsupplementaldemandmaterials.AsNoTracking().Include(x => x.Demand)
            .Where(x => dailyIds.Contains(x.DailyLineId) && x.Demand.Status == "APPROVED").ToListAsync(token);
        var issues = await context.Inventoryissuelines.AsNoTracking().Include(x => x.Issue)
            .Where(x => x.ReconciliationBatchDailyLineId != null && dailyIds.Contains(x.ReconciliationBatchDailyLineId)
                && x.MaterialRequestLineId == null && x.Issue.MaterialRequestId == null && x.Issue.ReconciliationBatchId != null).ToListAsync(token);
        var scopeById = lines.ToDictionary(x => Key(x.DailyLineId));
        issues = issues.Where(x => scopeById.TryGetValue(Key(x.ReconciliationBatchDailyLineId!), out var line)
            && x.Issue.ReconciliationBatchId!.SequenceEqual(line.BatchId) && x.Issue.IssueDate == line.ServiceDate
            && x.IngredientId.SequenceEqual(line.IngredientId) && x.UnitId.SequenceEqual(line.CanonicalUnitId)).ToList();
        materials = materials.Where(x => scopeById.TryGetValue(Key(x.DailyLineId), out var line)
            && x.BatchId.SequenceEqual(line.BatchId) && x.Demand.BatchId.SequenceEqual(line.BatchId)
            && x.Demand.ServiceDate == line.ServiceDate && x.IngredientId.SequenceEqual(line.IngredientId)
            && x.CanonicalUnitId.SequenceEqual(line.CanonicalUnitId)).ToList();
        var issueIds = issues.Select(x => x.IssueLineId).ToList();
        var allocations = await context.Reconciliationissueallocations.AsNoTracking().Where(x => issueIds.Contains(x.IssueLineId)).ToListAsync(token);
        var returns = await context.Inventoryreturnlines.AsNoTracking().Where(x => x.SourceIssueLineId != null
            && issueIds.Contains(x.SourceIssueLineId) && x.Return.ReceivedAt != null)
            .Select(x => new { Id = x.SourceIssueLineId!, x.Quantity }).ToListAsync(token);
        var materialsByDaily = materials.ToLookup(x => Key(x.DailyLineId), StringComparer.Ordinal);
        var issuesByDaily = issues.ToLookup(x => Key(x.ReconciliationBatchDailyLineId!), StringComparer.Ordinal);
        var allocationsByIssue = allocations.ToLookup(x => Key(x.IssueLineId), StringComparer.Ordinal);
        var returnsByIssue = returns.ToLookup(x => Key(x.Id), StringComparer.Ordinal);
        return lines.ToDictionary(x => Key(x.DailyLineId), line =>
        {
            var key = Key(line.DailyLineId);
            var scopedIssues = issuesByDaily[key].ToList();
            return Project(line, materialsByDaily[key].ToList(), scopedIssues,
                scopedIssues.SelectMany(issue => allocationsByIssue[Key(issue.IssueLineId)]).ToList(),
                scopedIssues.SelectMany(issue => returnsByIssue[Key(issue.IssueLineId)]).Select(x => (x.Id, x.Quantity)).ToList());
        }, StringComparer.Ordinal);
    }

    internal static ReconciliationSupplementalFulfillmentLineDto Project(ReconciliationBatchDailyLine line,
        IReadOnlyList<ReconciliationSupplementalDemandMaterial> approvedMaterials, IReadOnlyList<InventoryIssueLine> issues,
        IReadOnlyList<ReconciliationIssueAllocation> allocations, IReadOnlyList<(byte[] SourceIssueLineId, decimal Quantity)> receivedReturns)
    {
        var materials = approvedMaterials.Where(x => x.DailyLineId.SequenceEqual(line.DailyLineId)).ToList();
        var materialKeys = materials.Select(x => Key(x.DemandMaterialId)).ToHashSet(StringComparer.Ordinal);
        var extraIssued = new Dictionary<string, decimal>(StringComparer.Ordinal);
        decimal baseline = 0m, unplanned = 0m, unallocated = 0m, net = 0m;
        var incomplete = false; var ambiguousReturn = false; var hasAllocations = false;
        foreach (var issue in issues.Where(x => x.ReconciliationBatchDailyLineId is not null && x.ReconciliationBatchDailyLineId.SequenceEqual(line.DailyLineId)))
        {
            var returned = receivedReturns.Where(x => x.SourceIssueLineId.SequenceEqual(issue.IssueLineId)).Sum(x => x.Quantity);
            net += issue.IssuedQty - returned;
            var assigned = allocations.Where(x => x.IssueLineId.SequenceEqual(issue.IssueLineId)).ToList();
            hasAllocations |= assigned.Count > 0;
            var assignedQuantity = assigned.Sum(x => x.Quantity);
            if (DecimalPolicy.RoundQuantity(assignedQuantity - issue.IssuedQty) != 0)
            {
                incomplete = true;
                unallocated += issue.IssuedQty - assignedQuantity - (assigned.Count == 0 ? returned : 0m);
            }
            if (returned < 0 || DecimalPolicy.GreaterThanQuantity(returned, issue.IssuedQty)) incomplete = true;
            // A received return identifies its issue line, not a purpose within a mixed line. Never split it by guesswork.
            if (returned > 0 && assigned.Count > 1) ambiguousReturn = true;
            foreach (var allocation in assigned)
            {
                if (!allocation.DailyLineId.SequenceEqual(line.DailyLineId) || allocation.Quantity <= 0)
                { incomplete = true; continue; }
                var quantity = allocation.Quantity - (assigned.Count == 1 ? returned : 0m);
                switch (allocation.Purpose)
                {
                    case "BASELINE_SHORTAGE" when allocation.DemandMaterialId is null: baseline += quantity; break;
                    case "UNPLANNED_EXTRA" when allocation.DemandMaterialId is null: unplanned += quantity; break;
                    case "APPROVED_EXTRA_DEMAND" when allocation.DemandMaterialId is not null && materialKeys.Contains(Key(allocation.DemandMaterialId)):
                        var key = Key(allocation.DemandMaterialId); extraIssued[key] = extraIssued.GetValueOrDefault(key) + quantity; break;
                    default: incomplete = true; break;
                }
            }
        }
        var uncertain = incomplete || ambiguousReturn;
        var extra = materials.Select(x => new ReconciliationSupplementalExtraBalanceDto(GuidHelper.ToGuidString(x.DemandId),
            GuidHelper.ToGuidString(x.DemandMaterialId), x.RequiredQuantity, DecimalPolicy.RoundQuantity(extraIssued.GetValueOrDefault(Key(x.DemandMaterialId))),
            uncertain ? null : Math.Max(0m, DecimalPolicy.RoundQuantity(x.RequiredQuantity - extraIssued.GetValueOrDefault(Key(x.DemandMaterialId)))))).ToList();
        var baselineRemaining = uncertain ? (decimal?)null : Math.Max(0m, DecimalPolicy.RoundQuantity(line.RequiredQuantity - baseline));
        return new(GuidHelper.ToGuidString(line.DailyLineId), GuidHelper.ToGuidString(line.IngredientId), GuidHelper.ToGuidString(line.CanonicalUnitId),
            line.RequiredQuantity, DecimalPolicy.RoundQuantity(baseline), baselineRemaining, DecimalPolicy.RoundQuantity(net),
            DecimalPolicy.RoundQuantity(unplanned), DecimalPolicy.RoundQuantity(unallocated), incomplete, ambiguousReturn,
            !uncertain && baselineRemaining == 0 && extra.All(x => x.RemainingQuantity == 0), extra) { HasPurposeAllocations = hasAllocations };
    }
    private static string Key(byte[] id) => Convert.ToHexString(id);
}
