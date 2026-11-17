using IPCManagement.Api.Data;
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
        if (batch.Status != "IN_PROGRESS" || batch.Lines.Count == 0)
            throw new BusinessRuleException("Lô chưa sẵn sàng hoàn tất.");
        var batchId = batch.BatchId;
        if (await context.Reconciliationsupplementaldemands.AnyAsync(x => x.BatchId == batchId && x.Status == "PENDING", token))
            throw new BusinessRuleException("Còn nhu cầu suất phát sinh đang chờ duyệt. Cần xử lý trước khi chốt lô.");
        var extraDates = await context.Reconciliationsupplementaldemands.AsNoTracking()
            .Where(x => x.BatchId == batchId && x.Status == "APPROVED").Select(x => x.ServiceDate).Distinct().ToListAsync(token);
        foreach (var day in extraDates)
        {
            var fulfillment = await ReconciliationSupplementalFulfillmentQuery.GetAsync(context, batchId, day, token);
            if (fulfillment.Lines.Any(x => !x.IsDemandFulfilled))
                throw new BusinessRuleException("Chưa thể chốt: còn thiếu nhu cầu gốc, thiếu suất phát sinh hoặc lịch sử chưa rõ phân bổ mục đích.");
        }
        var usesDailyLineage = dailyProjection is not null
            && dailyProjection.Compatibility.ReasonCode != "LEGACY_DAILY_LINEAGE_MISSING";
        if (usesDailyLineage && dailyProjection!.WeeklyStatus != "WEEK_COMPLETE")
            throw new BusinessRuleException("Chưa thể hoàn tất khi vẫn còn ngày chưa xuất đủ hoặc chênh lệch chưa xử lý.");
        if (!usesDailyLineage)
        {
            var lineIds = batch.Lines.Select(x => x.BatchLineId).ToList();
            var actuals = await context.Reconciliationactuals.Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
            var dispositions = await context.Reconciliationdispositions
                .Where(x => x.InvalidatedAt == null && lineIds.Contains(x.BatchLineId)).ToListAsync(token);
            var linkedIssued = await ReconciliationLinkedIssueQuery.LoadAsync(context, lineIds, token);
            foreach (var line in batch.Lines)
            {
                var comparison = ReconciliationComparisonService.Map(
                    line,
                    actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(),
                    dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)),
                    ReconciliationBatchService.LinkedQuantity(linkedIssued, line.BatchLineId));
                if (comparison.IssuedQuantity is null) throw new BusinessRuleException("Mọi dòng phải có số lượng xuất kho liên kết.");
                if (comparison.Triggers.Count > 0)
                {
                    var disposition = dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId));
                    if (disposition is null || string.IsNullOrWhiteSpace(disposition.Reason)) throw new BusinessRuleException("Mọi dòng cần kiểm tra phải có hướng xử lý và lý do.");
                }
            }
        }
    }
}
