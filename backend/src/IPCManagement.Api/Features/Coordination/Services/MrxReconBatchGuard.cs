using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

/// <summary>
/// MRX-only guard: once a customer x week owns any reconciliation batch, source edits must go through
/// the source-change applier instead of direct quick-servings / bulk-update writes.
/// </summary>
internal static class MrxReconBatchGuard
{
    public const string BatchExistsMessage = "Tuần này đã có lô đối soát. Vui lòng dùng chức năng Điều chỉnh nguồn.";

    public static async Task<bool> AnyBatchAsync(
        IpcManagementContext context,
        DateOnly weekStartDate,
        byte[] customerId,
        CancellationToken cancellationToken)
    {
        var menuVersionIds = await context.Menuversions
            .AsNoTracking()
            .Where(mv => mv.CustomerId == customerId && mv.WeekStartDate == weekStartDate)
            .Select(mv => mv.MenuVersionId)
            .ToListAsync(cancellationToken);

        return menuVersionIds.Count > 0 &&
               await context.Reconciliationbatches
                   .AsNoTracking()
                   .AnyAsync(batch => menuVersionIds.Contains(batch.MenuVersionId), cancellationToken);
    }
}
