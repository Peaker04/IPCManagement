using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

/// <summary>
/// BR-MRX-EDIT-3: ngày phục vụ của lô bị khóa khi đã có ít nhất một phiếu xuất của lô cho ngày đó.
/// Khóa được tính từ phiếu xuất, không lưu cờ.
/// </summary>
public static class MrxDayLockReader
{
    /// <summary>
    /// Hợp (bảo thủ) của <c>IssueDate</c> các phiếu xuất của lô, ngày phục vụ ghi trên dòng phiếu,
    /// và <c>ServiceDate</c> của daily line mà dòng phiếu tham chiếu.
    /// </summary>
    public static async Task<IReadOnlySet<DateOnly>> GetLockedDatesAsync(IpcManagementContext ctx, byte[] batchId, CancellationToken ct)
    {
        var issueDates = await ctx.Inventoryissues.AsNoTracking()
            .Where(issue => issue.ReconciliationBatchId == batchId)
            .Select(issue => issue.IssueDate)
            .Distinct()
            .ToListAsync(ct);
        var lineServiceDates = await (
                from line in ctx.Inventoryissuelines.AsNoTracking()
                join issue in ctx.Inventoryissues.AsNoTracking() on line.IssueId equals issue.IssueId
                where issue.ReconciliationBatchId == batchId && line.ReconciliationServiceDate != null
                select line.ReconciliationServiceDate!.Value)
            .Distinct()
            .ToListAsync(ct);
        var referencedDailyDates = await (
                from line in ctx.Inventoryissuelines.AsNoTracking()
                join daily in ctx.Reconciliationbatchdailylines.AsNoTracking() on line.ReconciliationBatchDailyLineId equals daily.DailyLineId
                where daily.BatchId == batchId
                select daily.ServiceDate)
            .Distinct()
            .ToListAsync(ct);
        return issueDates.Concat(lineServiceDates).Concat(referencedDailyDates).ToHashSet();
    }
}
