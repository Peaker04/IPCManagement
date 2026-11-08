using IPCManagement.Api.Security;
using System.Security.Claims;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Exceptions;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Features.Approvals.Services;

public interface IApprovalWorkflowService
{
    Task<ApprovalResultDto?> ExecuteAsync(
        string targetType,
        string targetId,
        ApprovalRequest request,
        string? actorUserId,
        ClaimsPrincipal? actor = null);
}

public class ApprovalWorkflowService : IApprovalWorkflowService
{
    private readonly IReadOnlyDictionary<ApprovalTargetType, IApprovalTargetHandler> _handlers;
    private readonly IpcManagementContext? _context;
    private readonly IApprovalRoutingService? _routingService;
    private readonly IEfTransactionRunner? _transactionRunner;
    private readonly SystemOperationRequestContext? _systemOperationRequestContext;

    public ApprovalWorkflowService(IEnumerable<IApprovalTargetHandler> handlers)
    {
        _handlers = handlers.ToDictionary(handler => handler.TargetType);
    }

    public ApprovalWorkflowService(IpcManagementContext context, IApprovalRoutingService routingService, IEnumerable<IApprovalTargetHandler> handlers)
        : this(handlers)
    {
        _context = context;
        _routingService = routingService;
    }

    public ApprovalWorkflowService(
        IpcManagementContext context,
        IApprovalRoutingService routingService,
        IEnumerable<IApprovalTargetHandler> handlers,
        IEfTransactionRunner transactionRunner,
        SystemOperationRequestContext systemOperationRequestContext)
        : this(context, routingService, handlers)
    {
        _transactionRunner = transactionRunner;
        _systemOperationRequestContext = systemOperationRequestContext;
    }

    public async Task<ApprovalResultDto?> ExecuteAsync(
        string targetType,
        string targetId,
        ApprovalRequest request,
        string? actorUserId,
        ClaimsPrincipal? actor = null)
    {
        var actorId = IPCManagement.Api.Helpers.GuidHelper.ParseGuidString(actorUserId);
        if (actorId is null)
        {
            return null;
        }

        request.Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (request.Status == ApprovalDecision.Reject && string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ArgumentException("Lý do từ chối không được để trống.");
        }

        var normalizedTargetType = ApprovalTargetTypeParser.Parse(targetType);
        if (normalizedTargetType is null || !_handlers.TryGetValue(normalizedTargetType.Value, out var handler))
        {
            throw new ArgumentException("TargetType không hợp lệ.");
        }

        if (actor is not null && !HasPermission(actor, normalizedTargetType.Value))
        {
            throw new UnauthorizedAccessException("Không có quyền phê duyệt chứng từ này.");
        }

        if (actor is not null && normalizedTargetType == ApprovalTargetType.InventoryReceipt &&
            !actor.FindAll(ClaimTypes.Role).Any(claim => AuthorizationPolicies.MatchesManagerRole(claim.Value)))
        {
            throw new UnauthorizedAccessException("Chỉ Quản lý được duyệt phiếu nhập kho sau khi kiểm tra chất lượng.");
        }

        if (normalizedTargetType == ApprovalTargetType.MaterialDemand &&
            handler is IApprovalTargetPersistenceHandler persistenceHandler &&
            _context is not null &&
            _transactionRunner is not null &&
            _systemOperationRequestContext is
                { OperationKey: { } operationKey, ExpectedModeVersion: { } expectedModeVersion })
        {
            ApprovalResultDto? transactionResult = null;
            return await _transactionRunner.ExecuteProtectedAsync(
                operationKey,
                expectedModeVersion,
                async _ =>
                {
                    transactionResult = await RecordRequiredApprovalStepAsync(
                        normalizedTargetType.Value, targetId, request, actorId, actor, saveChanges: false);
                    transactionResult ??= await persistenceHandler.StageAsync(targetId, request, actorId);
                    if (transactionResult is not null)
                    {
                        await _context.SaveChangesAsync();
                    }
                    return transactionResult;
                },
                async cancellationToken =>
                {
                    var historyId = GuidHelper.ParseGuidString(transactionResult?.HistoryId);
                    return historyId is not null &&
                           await _context.Approvalhistories.AsNoTracking().AnyAsync(
                               history => history.ApprovalHistoryId == historyId,
                               cancellationToken);
                });
        }

        var stepResult = await RecordRequiredApprovalStepAsync(
            normalizedTargetType.Value, targetId, request, actorId, actor, saveChanges: true);
        if (stepResult is not null)
        {
            return stepResult;
        }

        return await handler.HandleAsync(targetId, request, actorId);
    }

    private async Task<ApprovalResultDto?> RecordRequiredApprovalStepAsync(
        ApprovalTargetType targetType,
        string targetId,
        ApprovalRequest request,
        byte[] actorId,
        ClaimsPrincipal? actor,
        bool saveChanges)
    {
        if (_context is null || _routingService is null || actor is null || request.Status != ApprovalDecision.Approve)
        {
            return null;
        }

        var targetIdBytes = GuidHelper.ParseGuidString(targetId);
        if (targetIdBytes is null) return null;
        var targetTypeName = targetType switch
        {
            ApprovalTargetType.MaterialDemand => "material-demand",
            ApprovalTargetType.PurchaseRequest => "purchase-request",
            _ => string.Empty
        };
        if (string.IsNullOrEmpty(targetTypeName)) return null;

        var rule = await _routingService.GetMatchingRuleAsync(targetTypeName, null);
        if (rule is null) return null;
        var assignments = (await _routingService.GetAssignmentsForRuleAsync(rule.RuleId))
            .Where(item => item.IsRequired).OrderBy(item => item.Sequence).ToList();
        if (assignments.Count < 2) return null;

        var history = await _context.Approvalhistories
            .Where(item => item.TargetType == targetTypeName && item.TargetId == targetIdBytes && item.Decision == "STEP_APPROVED")
            .OrderBy(item => item.ActionAt).ToListAsync();
        var next = assignments.Skip(history.Count).FirstOrDefault();
        if (next is null) return null;
        if (history.Any(item => item.ActionBy.SequenceEqual(actorId)))
            throw new BusinessRuleException("Một người không được hoàn thành hai bước phê duyệt.");
        if (next.ApproverUserId is not null && !next.ApproverUserId.SequenceEqual(actorId))
            throw new UnauthorizedAccessException("Bạn không phải người được chỉ định cho bước duyệt này.");
        var actorRoles = actor.FindAll(ClaimTypes.Role).Select(item => item.Value);
        if (next.ApproverUserId is null && !actorRoles.Any(role => string.Equals(role, next.ApproverRole, StringComparison.OrdinalIgnoreCase)))
            throw new UnauthorizedAccessException("Vai trò hiện tại không được phép thực hiện bước duyệt này.");

        var now = DateTime.UtcNow;
        var step = new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(), TargetType = targetTypeName, TargetId = targetIdBytes, Decision = "STEP_APPROVED", OldStatus = next.Sequence.ToString(), NewStatus = "PENDING", Reason = request.Reason, ActionBy = actorId, ActionAt = now };
        _context.Approvalhistories.Add(step);
        if (saveChanges)
        {
            await _context.SaveChangesAsync();
        }
        return history.Count + 1 < assignments.Count
            ? new ApprovalResultDto { TargetType = targetTypeName, TargetId = targetId, Status = "PENDING_NEXT_APPROVAL", OldStatus = next.Sequence.ToString(), NewStatus = "PENDING", HistoryId = GuidHelper.ToGuidString(step.ApprovalHistoryId), ActionAt = now }
            : null;
    }

    private static bool HasPermission(ClaimsPrincipal actor, ApprovalTargetType targetType)
    {
        var requiredPermission = targetType switch
        {
            ApprovalTargetType.MaterialDemand => AuthorizationPolicies.MaterialDemandApprove,
            ApprovalTargetType.PurchasePriceException => AuthorizationPolicies.PurchasePriceExceptionApprove,
            ApprovalTargetType.PurchaseRequest => AuthorizationPolicies.PurchaseRequestApprove,
            ApprovalTargetType.InventoryReceipt => AuthorizationPolicies.InventoryReceiptApprove,
            ApprovalTargetType.InventoryIssue => AuthorizationPolicies.InventoryIssueApprove,
            ApprovalTargetType.InventoryAdjustment => AuthorizationPolicies.InventoryAdjustmentApprove,
            _ => string.Empty
        };

        return actor.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .SelectMany(AuthorizationPolicies.ResolvePermissions)
            .Any(permission => string.Equals(permission, requiredPermission, StringComparison.OrdinalIgnoreCase));
    }
}

internal static class ApprovalTargetTypeParser
{
    public static ApprovalTargetType? Parse(string targetType)
    {
        var normalized = (targetType ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "demand" or "material-demand" or "materialdemand" => ApprovalTargetType.MaterialDemand,
            "price-exception" or "purchase-price-exception" or "purchasepriceexception" =>
                ApprovalTargetType.PurchasePriceException,
            "purchase" or "purchase-request" or "purchaserequest" => ApprovalTargetType.PurchaseRequest,
            "receipt" or "inventory-receipt" or "inventoryreceipt" => ApprovalTargetType.InventoryReceipt,
            "issue" or "inventory-issue" or "inventoryissue" => ApprovalTargetType.InventoryIssue,
            "adjustment" or "order-adjustment" or "orderadjustment" or
            "inventory-adjustment" or "inventoryadjustment" => ApprovalTargetType.InventoryAdjustment,
            _ => null
        };
}
}
