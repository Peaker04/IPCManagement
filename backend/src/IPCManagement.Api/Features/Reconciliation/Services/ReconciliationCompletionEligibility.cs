using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationCompletionEligibility
{
    internal static async Task RequireAsync(IpcManagementContext context, ReconciliationBatch batch,
        ReconciliationWarehouseDailyDto? dailyProjection, CancellationToken token)
    {
        var id = GuidHelper.ToGuidString(batch.BatchId);
        var projections = new Dictionary<string, ReconciliationWarehouseDailyDto>();
        if (dailyProjection is not null) projections.Add(id, dailyProjection);
        var decisions = await GetBlockersAsync(context, [batch], projections, token);
        if (decisions[id] is { } blocker) throw new BusinessRuleException(blocker);
    }

    internal static async Task<IReadOnlyDictionary<string, string?>> GetBlockersAsync(IpcManagementContext context,
        IReadOnlyCollection<ReconciliationBatch> batches, IReadOnlyDictionary<string, ReconciliationWarehouseDailyDto> projections,
        CancellationToken token)
    {
        var activeIds = batches.Where(batch => batch.Status == "IN_PROGRESS").Select(batch => batch.BatchId).ToList();
        var blockers = new Dictionary<string, string?>(StringComparer.Ordinal);
        if (activeIds.Count == 0)
        {
            foreach (var batch in batches) blockers.Add(GuidHelper.ToGuidString(batch.BatchId), "Lô chưa sẵn sàng hoàn tất.");
            return blockers;
        }
        var demands = await context.Reconciliationsupplementaldemands.AsNoTracking()
            .Where(x => activeIds.Contains(x.BatchId) && (x.Status == "PENDING" || x.Status == "APPROVED"))
            .Select(x => new { x.BatchId, x.ServiceDate, x.Status }).ToListAsync(token);
        var demandsByBatch = demands.ToLookup(x => GuidHelper.ToGuidString(x.BatchId), StringComparer.Ordinal);
        var pendingHistoricalIds = await context.Mrxhistoricalpurposeproposals.AsNoTracking()
            .Where(x => activeIds.Contains(x.BatchId) && x.Status == "PENDING").Select(x => x.BatchId).ToListAsync(token);
        var pendingHistorical = pendingHistoricalIds.Select(GuidHelper.ToGuidString).ToHashSet(StringComparer.Ordinal);
        foreach (var batch in batches)
        {
            var id = GuidHelper.ToGuidString(batch.BatchId);
            var scopedDemands = demandsByBatch[id];
            blockers.Add(id, await FindBlockerAsync(context, batch, projections.GetValueOrDefault(id),
                scopedDemands.Any(x => x.Status == "PENDING"), pendingHistorical.Contains(id),
                scopedDemands.Where(x => x.Status == "APPROVED").Select(x => x.ServiceDate).Distinct(), token));
        }
        return blockers;
    }

    private static async Task<string?> FindBlockerAsync(IpcManagementContext context, ReconciliationBatch batch,
        ReconciliationWarehouseDailyDto? dailyProjection, bool hasPendingDemand, bool hasPendingHistorical,
        IEnumerable<DateOnly> extraDates, CancellationToken token)
    {
        if (batch.Status != "IN_PROGRESS") return "Lô chưa sẵn sàng hoàn tất.";
        if (hasPendingDemand) return "Còn nhu cầu suất phát sinh đang chờ duyệt. Cần xử lý trước khi chốt lô.";
        if (hasPendingHistorical) return "Còn đề xuất phân bổ phiếu lịch sử đang chờ duyệt. Cần xử lý trước khi chốt lô.";
        var batchId = batch.BatchId;
        foreach (var day in extraDates)
        {
            var fulfillment = await ReconciliationSupplementalFulfillmentQuery.GetAsync(context, batchId, day, token);
            if (fulfillment.Lines.Any(x => !x.IsDemandFulfilled))
                return "Chưa thể chốt: còn thiếu nhu cầu gốc, thiếu suất phát sinh hoặc lịch sử chưa rõ phân bổ mục đích.";
        }
        var usesDailyLineage = dailyProjection is not null
            && dailyProjection.Compatibility.ReasonCode != "LEGACY_DAILY_LINEAGE_MISSING";
        if (usesDailyLineage && dailyProjection!.WeeklyStatus != "WEEK_COMPLETE")
            return "Chưa thể hoàn tất khi vẫn còn ngày chưa xuất đủ hoặc chênh lệch chưa xử lý.";
        if (!usesDailyLineage)
        {
            var lines = batch.Lines.Count > 0 ? batch.Lines.ToList() : await context.Reconciliationbatchlines.AsNoTracking()
                .Where(line => line.BatchId == batchId).ToListAsync(token);
            if (lines.Count == 0) return "Lô chưa có dòng đối soát để hoàn tất.";
            var lineIds = lines.Select(x => x.BatchLineId).ToList();
            var actuals = await context.Reconciliationactuals.Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
            var dispositions = await context.Reconciliationdispositions
                .Where(x => x.InvalidatedAt == null && lineIds.Contains(x.BatchLineId)).ToListAsync(token);
            var linkedIssued = await ReconciliationLinkedIssueQuery.LoadAsync(context, lineIds, token);
            foreach (var line in lines)
            {
                var comparison = ReconciliationComparisonService.Map(
                    line,
                    actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(),
                    dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)),
                    ReconciliationBatchService.LinkedQuantity(linkedIssued, line.BatchLineId));
                if (comparison.IssuedQuantity is null) return "Mọi dòng phải có số lượng xuất kho liên kết.";
                if (comparison.Triggers.Count > 0)
                {
                    var disposition = dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId));
                    if (disposition is null || string.IsNullOrWhiteSpace(disposition.Reason)) return "Mọi dòng cần kiểm tra phải có hướng xử lý và lý do.";
                }
            }
        }
        return null;
    }
}
