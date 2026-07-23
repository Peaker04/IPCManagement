using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.Workflow;
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
        var alreadyResolved = await Context.Approvalhistories
            .AsNoTracking()
            .AnyAsync(item => item.TargetType == targetType && item.TargetId == targetId);
        if (alreadyResolved)
        {
            throw new InvalidOperationException("Phiếu này đã được xử lý.");
        }

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
        var entity = await Context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.SupplierDecisions)
                    .ThenInclude(decision => decision.Purchasepriceexceptions)
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == targetId);
        if (entity is null) return null;

        var oldStatus = entity.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? "APPROVED" : "REJECTED";

        if (request.Status == ApprovalDecision.Approve && await HasPriceWarningAsync(entity))
        {
            throw new InvalidOperationException("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi duyệt.");
        }

        entity.Status = newStatus;
        entity.ApprovedBy = actorId;
        entity.ApprovedAt = DateTime.UtcNow;

        return await SaveHistoryAsync("purchase-request", targetId, request, actorId, oldStatus, newStatus);
    }

    private async Task<bool> HasPriceWarningAsync(Purchaserequest purchaseRequest)
    {
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var currentDecision = line.SupplierDecisions.SingleOrDefault(decision =>
                string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
            if (currentDecision is null)
            {
                return true;
            }

            var variance = PurchasePricePolicy.CalculateVariancePercent(
                currentDecision.EvidenceReferencePrice,
                currentDecision.ProposedUnitPrice);
            if (PurchasePricePolicy.RequiresException(variance) &&
                !currentDecision.Purchasepriceexceptions.Any(priceException =>
                    string.Equals(priceException.ProposalFingerprint, currentDecision.DecisionFingerprint, StringComparison.Ordinal) &&
                    priceException.ProposalVersion == currentDecision.Version &&
                    string.Equals(priceException.Status, "APPROVED", StringComparison.Ordinal)))
            {
                return true;
            }
        }

        await Task.CompletedTask;
        return false;
    }
}

public sealed class PurchasePriceExceptionApprovalHandler : ApprovalHandlerBase<Purchasepriceexception>
{
    private const string TargetTypeName = "purchase-price-exception";

    public PurchasePriceExceptionApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.PurchasePriceException;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(
        byte[] targetId,
        ApprovalRequestDto request,
        byte[] actorId)
    {
        var priceException = await Context.Purchasepriceexceptions
            .Include(item => item.PurchaseLineSupplierDecision)
            .FirstOrDefaultAsync(item => item.PurchasePriceExceptionId == targetId);
        if (priceException is null)
        {
            return null;
        }

        var existingHistory = await Context.Approvalhistories
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.TargetType == TargetTypeName && item.TargetId == targetId);
        if (existingHistory is not null)
        {
            var requestedDecision = request.Status.ToString().ToUpperInvariant();
            if (!string.Equals(existingHistory.Decision, requestedDecision, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(priceException.Status, existingHistory.NewStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Ngoại lệ giá đã có quyết định khác hoặc không còn đúng phiên bản.");
            }

            return MapExistingResult(existingHistory);
        }

        if (!string.Equals(priceException.Status, "PENDING", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Chỉ ngoại lệ giá PENDING hiện hành mới được quyết định.");
        }

        var decision = priceException.PurchaseLineSupplierDecision;
        if (!string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal) ||
            !string.Equals(decision.DecisionFingerprint, priceException.ProposalFingerprint, StringComparison.Ordinal) ||
            decision.Version != priceException.ProposalVersion)
        {
            throw new DbUpdateConcurrencyException(
                "Ngoại lệ giá đã cũ hoặc không còn khớp quyết định nhà cung cấp hiện hành.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ArgumentException("Lý do quyết định ngoại lệ giá không được để trống.");
        }

        var oldStatus = priceException.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? "APPROVED" : "REJECTED";
        priceException.Status = newStatus;
        priceException.DecidedBy = actorId;
        priceException.DecisionReason = request.Reason;
        priceException.DecidedAt = DateTime.UtcNow;
        priceException.ConcurrencyVersion++;

        return await SaveHistoryAsync(
            TargetTypeName,
            targetId,
            request,
            actorId,
            oldStatus,
            newStatus);
    }

    private static ApprovalResultDto MapExistingResult(Approvalhistory history)
        => new()
        {
            TargetType = history.TargetType,
            TargetId = GuidHelper.ToGuidString(history.TargetId),
            Status = history.Decision,
            OldStatus = history.OldStatus,
            NewStatus = history.NewStatus,
            HistoryId = GuidHelper.ToGuidString(history.ApprovalHistoryId),
            ActionAt = history.ActionAt
        };
}

public sealed class MaterialDemandApprovalHandler : ApprovalHandlerBase<Materialrequest>
{
    private const string MaterialDemandTargetType = "material-demand";
    private const string PendingStatus = "DRAFT";
    private const string ApprovedStatus = "MANAGERAPPROVED";
    private const string RejectedStatus = "CANCELLED";

    public MaterialDemandApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.MaterialDemand;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(
        byte[] targetId,
        ApprovalRequestDto request,
        byte[] actorId)
    {
        var demand = await Context.Materialrequests
            .FirstOrDefaultAsync(item => item.RequestId == targetId);
        if (demand is null)
        {
            return null;
        }

        var existingHistory = await Context.Approvalhistories
            .AsNoTracking()
            .Where(item => item.TargetType == MaterialDemandTargetType && item.TargetId == targetId)
            .OrderBy(item => item.ActionAt)
            .FirstOrDefaultAsync();
        if (existingHistory is not null)
        {
            var requestedDecision = request.Status.ToString().ToUpperInvariant();
            if (!string.Equals(existingHistory.Decision, requestedDecision, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(demand.Status, existingHistory.NewStatus, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Nhu cầu nguyên liệu đã có quyết định khác hoặc không còn đúng phiên bản.");
            }

            return MapExistingResult(existingHistory);
        }

        if (!string.Equals(demand.Status, PendingStatus, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chỉ nhu cầu nguyên liệu DRAFT hiện hành mới được quyết định.");
        }

        var oldStatus = demand.Status;
        var newStatus = request.Status == ApprovalDecision.Approve ? ApprovedStatus : RejectedStatus;
        var decidedAt = DateTime.UtcNow;
        demand.Status = newStatus;
        demand.ApprovedBy = actorId;
        demand.ApprovedAt = decidedAt;

        return await SaveHistoryAsync(
            MaterialDemandTargetType,
            targetId,
            request,
            actorId,
            oldStatus,
            newStatus);
    }

    private static ApprovalResultDto MapExistingResult(Approvalhistory history)
        => new()
        {
            TargetType = history.TargetType,
            TargetId = GuidHelper.ToGuidString(history.TargetId),
            Status = history.Decision,
            OldStatus = history.OldStatus,
            NewStatus = history.NewStatus,
            HistoryId = GuidHelper.ToGuidString(history.ApprovalHistoryId),
            ActionAt = history.ActionAt
        };
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

        return await SaveHistoryAsync("inventory-issue", targetId, request, actorId, oldStatus, newStatus);
    }
}

public sealed class InventoryAdjustmentApprovalHandler : ApprovalHandlerBase<Quantityadjustment>
{
    private const string OrderAdjustmentTargetType = "order-adjustment";

    public InventoryAdjustmentApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryAdjustment;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequestDto request, byte[] actorId)
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

        var result = await SaveHistoryAsync(OrderAdjustmentTargetType, targetId, request, actorId, oldStatus, newStatus);

        if (request.Status == ApprovalDecision.Approve)
        {
            var line = adjustment.QuantityPlanLine;
            var oldValue = line.FinalServings;
            var changedAt = DateTime.UtcNow;

            line.AdjustedServings = adjustment.NewServings - line.ConfirmedServings;
            line.FinalServings = adjustment.NewServings;
            line.QuantityPlan.Status = OrderStatus.Adjusted;

            Context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "Coordination",
                EntityName = nameof(Mealquantityplanline),
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
