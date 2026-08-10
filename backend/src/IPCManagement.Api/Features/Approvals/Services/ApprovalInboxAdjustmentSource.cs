using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed class ApprovalInboxAdjustmentSource
{
    private const string OrderAdjustmentTargetType = "order-adjustment";

    private readonly IpcManagementContext _context;
    private readonly ApprovalInboxSlaEnricher _slaEnricher;

    public ApprovalInboxAdjustmentSource(
        IpcManagementContext context,
        ApprovalInboxSlaEnricher slaEnricher)
    {
        _context = context;
        _slaEnricher = slaEnricher;
    }

    public async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var adjustmentQuery = _context.Quantityadjustments
            .AsNoTracking()
            .Include(item => item.AdjustedByNavigation)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Customer)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Menu)
            .Where(item => !_context.Approvalhistories.Any(history =>
                history.TargetType == OrderAdjustmentTargetType &&
                history.TargetId == item.AdjustmentId));
        if (cursor is not null)
        {
            var cursorDateTime = cursor.DueDate.ToDateTime(TimeOnly.MinValue);
            adjustmentQuery = adjustmentQuery.Where(item =>
                item.AdjustedAt.Date > cursorDateTime.Date ||
                (item.AdjustedAt.Date == cursorDateTime.Date && item.AdjustedAt > cursorDateTime));
        }

        var adjustments = await adjustmentQuery
            .OrderBy(item => item.AdjustedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var resultList = new List<ApprovalInboxItemDto>();
        var slaTargets = new List<ApprovalInboxSlaTarget>();
        foreach (var item in adjustments)
        {
            var itemDto = new ApprovalInboxItemDto
            {
                InboxItemId = "adjustment-" + GuidHelper.ToGuidString(item.AdjustmentId),
                TargetType = OrderAdjustmentTargetType,
                TargetId = GuidHelper.ToGuidString(item.AdjustmentId),
                TargetCode = item.QuantityPlanLine.Customer.CustomerCode + "-" + item.QuantityPlanLine.ShiftName,
                ItemType = "adjustment",
                Title = "Duyệt điều chỉnh suất ăn",
                Source = item.QuantityPlanLine.Customer.CustomerName,
                OwnerRole = "Kho / Quản lý",
                SubmittedBy = item.AdjustedByNavigation.FullName,
                DueDate = DateOnly.FromDateTime(item.AdjustedAt),
                Status = "PENDING",
                Reason = item.Reason ?? "Điều chỉnh số suất cần duyệt.",
                NextAction = "Duyệt điều chỉnh",
                Tone = "warning",
                Route = "/approvals",
                Materials =
                [
                    new ApprovalInboxMaterialDto
                    {
                        Name = item.QuantityPlanLine.Menu.MenuName,
                        Quantity = item.NewServings,
                        Unit = "suất"
                    }
                ]
            };
            slaTargets.Add(new ApprovalInboxSlaTarget(itemDto, item.AdjustmentId, item.AdjustedAt));
            resultList.Add(itemDto);
        }

        await _slaEnricher.PopulateAsync(OrderAdjustmentTargetType, slaTargets, cancellationToken);
        return resultList;
    }
}
