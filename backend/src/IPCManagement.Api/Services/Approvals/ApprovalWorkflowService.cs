using IPCManagement.Api.Models.DTOs.Approvals;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalWorkflowService
{
    Task<ApprovalResultDto?> ExecuteAsync(string targetType, string targetId, ApprovalRequestDto request, string? actorUserId);
}

public class ApprovalWorkflowService : IApprovalWorkflowService
{
    private readonly IReadOnlyDictionary<ApprovalTargetType, IApprovalTargetHandler> _handlers;

    public ApprovalWorkflowService(IEnumerable<IApprovalTargetHandler> handlers)
    {
        _handlers = handlers.ToDictionary(handler => handler.TargetType);
    }

    public async Task<ApprovalResultDto?> ExecuteAsync(string targetType, string targetId, ApprovalRequestDto request, string? actorUserId)
    {
        var actorId = IPCManagement.Api.Helpers.GuidHelper.ParseGuidString(actorUserId);
        if (actorId is null)
        {
            return null;
        }

        var normalizedTargetType = ApprovalTargetTypeParser.Parse(targetType);
        if (normalizedTargetType is null || !_handlers.TryGetValue(normalizedTargetType.Value, out var handler))
        {
            throw new ArgumentException("TargetType không hợp lệ.");
        }

        return await handler.HandleAsync(targetId, request, actorId);
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
            "adjustment" or "inventory-adjustment" or "inventoryadjustment" => ApprovalTargetType.InventoryAdjustment,
            _ => null
        };
    }
}