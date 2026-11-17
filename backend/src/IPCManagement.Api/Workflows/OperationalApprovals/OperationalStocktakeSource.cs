using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

internal sealed class OperationalStocktakeSource(IpcManagementContext context)
{
    private const string Title = "Duyệt chênh lệch kiểm kê";
    internal async Task<IReadOnlyList<ApprovalInboxItemDto>> ReadAsync(ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100)
    {
        var id = string.IsNullOrWhiteSpace(query.TargetId) ? null : GuidHelper.ParseGuidString(query.TargetId)
            ?? throw new ArgumentException("Mã kiểm kê không hợp lệ.");
        var source = context.Stocktakes.AsNoTracking().Include(x => x.Warehouse).Include(x => x.CreatedByNavigation)
            .Where(x => (query.State == "PROCESSED" ? x.Status == "APPROVED" || x.Status == "REJECTED" : x.Status == "REVIEWING")
                && (id == null || x.StocktakeId == id));
        source = ApprovalInboxSourceFilter.ByDate(source, x => DateOnly.FromDateTime(x.CreatedAt), query);
        if (!string.IsNullOrWhiteSpace(query.SearchKeyword) && !Title.Contains(query.SearchKeyword.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            var search = query.SearchKeyword.Trim();
            source = source.Where(x => x.StocktakeCode.Contains(search) || x.Warehouse.WarehouseName.Contains(search)
                || x.CreatedByNavigation.FullName.Contains(search) || (x.Notes != null && x.Notes.Contains(search)));
        }
        var rows = await source.OrderBy(x => x.CreatedAt).ThenBy(x => x.StocktakeCode).ThenBy(x => x.StocktakeId)
            .Skip(offset).Take(limit).ToListAsync(token);
        return rows.Select(x => new ApprovalInboxItemDto { InboxItemId = $"DEFAULT:stocktake:{GuidHelper.ToGuidString(x.StocktakeId)}",
            TargetType = "stocktake", ItemType = "stocktake", TargetId = GuidHelper.ToGuidString(x.StocktakeId), TargetCode = x.StocktakeCode,
            Title = Title, Status = x.Status, Source = x.Warehouse?.WarehouseName ?? "", SubmittedBy = x.CreatedByNavigation?.FullName ?? "",
            SubmittedAt = x.ApprovedAt ?? x.CreatedAt, DueDate = DateOnly.FromDateTime(x.CreatedAt), Reason = x.Notes ?? "",
            Route = $"/approvals?targetType=stocktake&targetId={GuidHelper.ToGuidString(x.StocktakeId)}&state={query.State}" }).ToList();
    }

    internal async Task<StocktakeDto> DetailAsync(string id, CancellationToken token)
    {
        var key = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã kiểm kê không hợp lệ.");
        var x = await context.Stocktakes.AsNoTracking().Include(x => x.Warehouse).Include(x => x.CreatedByNavigation).Include(x => x.ApprovedByNavigation)
            .Include(x => x.Stocktakelines).ThenInclude(x => x.Ingredient).Include(x => x.Stocktakelines).ThenInclude(x => x.Unit)
            .SingleOrDefaultAsync(x => x.StocktakeId == key, token) ?? throw new KeyNotFoundException("Không tìm thấy kiểm kê.");
        return IPCManagement.Api.Features.Inventory.Services.StocktakeService.MapStocktake(x, includeLines: true);
    }
}
