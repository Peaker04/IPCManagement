using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Security;
using System.Security.Claims;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalWorkflowService
{
    Task<ApprovalResultDto?> ExecuteAsync(
        string targetType,
        string targetId,
        ApprovalRequestDto request,
        string? actorUserId,
        ClaimsPrincipal? actor = null);
}

public class ApprovalWorkflowService : IApprovalWorkflowService
{
    private readonly IReadOnlyDictionary<ApprovalTargetType, IApprovalTargetHandler> _handlers;

    public ApprovalWorkflowService(IEnumerable<IApprovalTargetHandler> handlers)
    {
        _handlers = handlers.ToDictionary(handler => handler.TargetType);
    }

    public async Task<ApprovalResultDto?> ExecuteAsync(
        string targetType,
        string targetId,
        ApprovalRequestDto request,
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

        return await handler.HandleAsync(targetId, request, actorId);
    }

    private static bool HasPermission(ClaimsPrincipal actor, ApprovalTargetType targetType)
    {
        var requiredPermission = targetType switch
        {
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
            "purchase" or "purchase-request" or "purchaserequest" => ApprovalTargetType.PurchaseRequest,
            "receipt" or "inventory-receipt" or "inventoryreceipt" => ApprovalTargetType.InventoryReceipt,
            "issue" or "inventory-issue" or "inventoryissue" => ApprovalTargetType.InventoryIssue,
            "adjustment" or "order-adjustment" or "orderadjustment" or
            "inventory-adjustment" or "inventoryadjustment" => ApprovalTargetType.InventoryAdjustment,
            _ => null
        };
}
}
