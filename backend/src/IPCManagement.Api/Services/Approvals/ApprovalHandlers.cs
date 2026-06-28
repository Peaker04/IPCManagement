using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Approvals;

public abstract class ApprovalHandlerBase<TEntity> : IApprovalTargetHandler
    where TEntity : class
{
    protected readonly IpcManagementContext Context;

    protected ApprovalHandlerBase(IpcManagementContext context)
    {
        Context = context;
    }

    public abstract ApprovalTargetType TargetType { get; }

    public async Task<ApprovalResultDto?> HandleAsync(string targetId, ApprovalRequestDto request, byte[] actorId)
    {
        var entityId = GuidHelper.ParseGuidString(targetId);
        if (entityId is null)
        {
            return null;
        }

        await using var transaction = await Context.Database.BeginTransactionAsync();

        try
        {
            var result = await HandleCoreAsync(entityId, request, actorId);
            if (result is null)
            {
                await transaction.RollbackAsync();
                return null;
            }

            await Context.SaveChangesAsync();
            await transaction.CommitAsync();
            return result;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    protected abstract Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId);

    protected async Task<ApprovalResultDto> SaveHistoryAsync(
        string targetType,
        byte[] targetId,
        ApprovalRequestDto request,
        byte[] actorId,
        string? oldStatus,
        string? newStatus)
    {
        var actionAt = DateTime.UtcNow;
        var historyId = GuidHelper.NewId();

        Context.Approvalhistories.Add(new Approvalhistory
        {
            ApprovalHistoryId = historyId,
            TargetType = targetType,
            TargetId = targetId,
            Decision = request.Status.ToString().ToUpperInvariant(),
            OldStatus = oldStatus,
            NewStatus = newStatus,
            Reason = request.Reason,
            ActionBy = actorId,
            ActionAt = actionAt
        });

        return new ApprovalResultDto
        {
            TargetType = targetType,
            TargetId = GuidHelper.ToGuidString(targetId),
            Status = request.Status.ToString().ToUpperInvariant(),
            OldStatus = oldStatus,
            NewStatus = newStatus,
            HistoryId = GuidHelper.ToGuidString(historyId),
            ActionAt = actionAt
        };
    }
}

public sealed class PurchaseRequestApprovalHandler : ApprovalHandlerBase<Purchaserequest>
{
    public PurchaseRequestApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.PurchaseRequest;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId)
    {
        var entity = await Context.Purchaserequests.FirstOrDefaultAsync(item => item.PurchaseRequestId == targetId);
        if (entity is null) return null;

        var oldStatus = entity.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? "APPROVED" : "REJECTED";

        entity.Status = newStatus;
        entity.ApprovedBy = actorId;
        entity.ApprovedAt = DateTime.UtcNow;

        return await SaveHistoryAsync("purchase-request", targetId, request, actorId, oldStatus, newStatus);
    }
}

public sealed class InventoryReceiptApprovalHandler : ApprovalHandlerBase<Inventoryreceipt>
{
    public InventoryReceiptApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryReceipt;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId)
    {
        var receipt = await Context.Inventoryreceipts
            .Include(item => item.PurchaseRequest)
            .FirstOrDefaultAsync(item => item.ReceiptId == targetId);

        if (receipt is null) return null;

        var oldStatus = receipt.PurchaseRequest?.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? "SENTTOWAREHOUSE" : "CANCELLED";

        if (receipt.PurchaseRequest is not null)
        {
            receipt.PurchaseRequest.Status = newStatus;
            receipt.PurchaseRequest.ApprovedBy = actorId;
            receipt.PurchaseRequest.ApprovedAt = DateTime.UtcNow;
        }

        return await SaveHistoryAsync("inventory-receipt", targetId, request, actorId, oldStatus, newStatus);
    }
}

public sealed class InventoryIssueApprovalHandler : ApprovalHandlerBase<Inventoryissue>
{
    public InventoryIssueApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryIssue;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId)
    {
        var issue = await Context.Inventoryissues
            .Include(item => item.MaterialRequest)
            .FirstOrDefaultAsync(item => item.IssueId == targetId);

        if (issue is null) return null;

        var oldStatus = issue.MaterialRequest.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? "CONFIRMED" : "REJECTED";

        issue.MaterialRequest.Status = newStatus;
        issue.ReceivedBy = actorId;

        return await SaveHistoryAsync("inventory-issue", targetId, request, actorId, oldStatus, newStatus);
    }
}

public sealed class InventoryAdjustmentApprovalHandler : ApprovalHandlerBase<Quantityadjustment>
{
    public InventoryAdjustmentApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryAdjustment;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId)
    {
        var adjustment = await Context.Quantityadjustments.FirstOrDefaultAsync(item => item.AdjustmentId == targetId);
        if (adjustment is null) return null;

        var oldStatus = "PENDING";
        var newStatus = request.Status == ApprovalDecision.Approve ? "APPROVED" : "REJECTED";

        return await SaveHistoryAsync("inventory-adjustment", targetId, request, actorId, oldStatus, newStatus);
    }
}