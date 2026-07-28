using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Approvals.Services;

public abstract class ApprovalHandlerBase<TEntity> : IApprovalTargetHandler
    where TEntity : class
{
    protected readonly IpcManagementContext Context;

    protected ApprovalHandlerBase(IpcManagementContext context)
    {
        Context = context;
    }

    public abstract ApprovalTargetType TargetType { get; }

    public async Task<ApprovalResultDto?> HandleAsync(string targetId, ApprovalRequest request, byte[] actorId)
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

    protected abstract Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequest request, byte[] actorId);

    protected async Task<ApprovalResultDto> SaveHistoryAsync(
        string targetType,
        byte[] targetId,
        ApprovalRequest request,
        byte[] actorId,
        string? oldStatus,
        string? newStatus)
    {
        var alreadyResolved = await Context.Approvalhistories
            .AsNoTracking()
            .AnyAsync(item => item.TargetType == targetType && item.TargetId == targetId);
        if (alreadyResolved)
        {
            throw new BusinessRuleException("Phiếu này đã được xử lý.");
        }

        var actionAt = DateTime.UtcNow;
        var historyId = GuidHelper.NewId();

        Context.Approvalhistories.Add(new ApprovalHistory
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

public sealed class PurchaseRequestApprovalHandler : ApprovalHandlerBase<PurchaseRequest>
{
    public PurchaseRequestApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.PurchaseRequest;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequest request, byte[] actorId)
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
            throw new BusinessRuleException("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi duyệt.");
        }

        entity.Status = newStatus;
        entity.ApprovedBy = actorId;
        entity.ApprovedAt = DateTime.UtcNow;

        return await SaveHistoryAsync("purchase-request", targetId, request, actorId, oldStatus, newStatus);
    }

    private async Task<bool> HasPriceWarningAsync(PurchaseRequest purchaseRequest)
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

public sealed class PurchasePriceExceptionApprovalHandler : ApprovalHandlerBase<PurchasePriceException>
{
    private const string TargetTypeName = "purchase-price-exception";

    public PurchasePriceExceptionApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.PurchasePriceException;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(
        byte[] targetId,
        ApprovalRequest request,
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
                throw new BusinessRuleException("Ngoại lệ giá đã có quyết định khác hoặc không còn đúng phiên bản.");
            }

            return MapExistingResult(existingHistory);
        }

        if (!string.Equals(priceException.Status, "PENDING", StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Chỉ ngoại lệ giá PENDING hiện hành mới được quyết định.");
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

    private static ApprovalResultDto MapExistingResult(ApprovalHistory history)
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

public sealed class MaterialDemandApprovalHandler : ApprovalHandlerBase<MaterialRequest>
{
    private const string MaterialDemandTargetType = "material-demand";
    private const string PendingStatus = "DRAFT";
    private const string ApprovedStatus = "MANAGERAPPROVED";
    private const string RejectedStatus = "CANCELLED";

    public MaterialDemandApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.MaterialDemand;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(
        byte[] targetId,
        ApprovalRequest request,
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
                throw new BusinessRuleException("Nhu cầu nguyên liệu đã có quyết định khác hoặc không còn đúng phiên bản.");
            }

            return MapExistingResult(existingHistory);
        }

        if (!string.Equals(demand.Status, PendingStatus, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Chỉ nhu cầu nguyên liệu DRAFT hiện hành mới được quyết định.");
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

    private static ApprovalResultDto MapExistingResult(ApprovalHistory history)
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

public sealed class InventoryReceiptApprovalHandler : ApprovalHandlerBase<InventoryReceipt>
{
    public InventoryReceiptApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryReceipt;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequest request, byte[] actorId)
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

public sealed class InventoryIssueApprovalHandler : ApprovalHandlerBase<InventoryIssue>
{
    public InventoryIssueApprovalHandler(IpcManagementContext context) : base(context) { }

    public override ApprovalTargetType TargetType => ApprovalTargetType.InventoryIssue;

    protected override async Task<ApprovalResultDto?> HandleCoreAsync(byte[] targetId, ApprovalRequest request, byte[] actorId)
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
