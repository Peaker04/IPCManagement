using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class InventoryAdjustmentApprovalHandler : ApprovalHandlerBase<QuantityAdjustment>
{
    private const string OrderAdjustmentTargetType = "order-adjustment";

    public InventoryAdjustmentApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryAdjustment;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(
        byte[] targetId,
        ApprovalRequest request,
        byte[] actorId)
    {
        var adjustment = await Context.Quantityadjustments
            .Include(item => item.QuantityPlanLine)
            .ThenInclude(item => item.QuantityPlan)
            .FirstOrDefaultAsync(item => item.AdjustmentId == targetId);
        if (adjustment is null) return null;

        var alreadyResolved = await Context.Approvalhistories
            .AsNoTracking()
            .AnyAsync(item => item.TargetType == OrderAdjustmentTargetType && item.TargetId == targetId);

        if (alreadyResolved)
        {
            throw new InvalidOperationException("Yêu cầu điều chỉnh này đã được xử lý.");
        }

        var oldStatus = "PENDING";
        var newStatus = request.Status == ApprovalDecision.Approve ? "APPROVED" : "REJECTED";
        var result = await SaveHistoryAsync(
            OrderAdjustmentTargetType,
            targetId,
            request,
            actorId,
            oldStatus,
            newStatus);

        if (request.Status == ApprovalDecision.Approve)
        {
            var line = adjustment.QuantityPlanLine;
            var oldValue = line.FinalServings;
            var changedAt = DateTime.UtcNow;

            line.AdjustedServings = adjustment.NewServings - line.ConfirmedServings;
            line.FinalServings = adjustment.NewServings;
            line.QuantityPlan.Status = OrderStatus.Adjusted;

            Context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "Coordination",
                EntityName = nameof(MealQuantityPlanLine),
                EntityId = line.QuantityPlanLineId,
                FieldName = "finalServings",
                OldValue = oldValue.ToString(),
                NewValue = adjustment.NewServings.ToString(),
                Reason = adjustment.Reason
            });
        }

        return result;
    }
}
