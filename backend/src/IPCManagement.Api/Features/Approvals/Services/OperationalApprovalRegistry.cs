using System.Security.Claims;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Security;

namespace IPCManagement.Api.Features.Approvals.Services;

/// <summary>Only fully connected inbox sources are published. Domain handlers remain the decision authority.</summary>
public static class OperationalApprovalRegistry
{
    private static readonly OperationalApprovalTarget[] Targets =
    [
        new("material-demand", "Nhu cầu nguyên liệu", SystemOperationEligibility.Default, AuthorizationPolicies.MaterialDemandApprove),
        new("purchase-request", "Đề nghị mua hàng", SystemOperationEligibility.Default, AuthorizationPolicies.PurchaseRequestApprove),
        new("purchase-price-exception", "Ngoại lệ giá mua", SystemOperationEligibility.Default, AuthorizationPolicies.PurchasePriceExceptionApprove),
        new("inventory-issue", "Phiếu xuất kho", SystemOperationEligibility.Default, AuthorizationPolicies.InventoryIssueApprove),
        new("inventory-receipt", "Phiếu nhập kho", SystemOperationEligibility.Default, AuthorizationPolicies.InventoryReceiptApprove),
        new("order-adjustment", "Điều chỉnh suất ăn", SystemOperationEligibility.Default, AuthorizationPolicies.InventoryAdjustmentApprove),
        new("legacy-lineage-disposition", "Liên kết chứng từ cũ", SystemOperationEligibility.Default, AuthorizationPolicies.InventoryIssueApprove),
        new("stocktake", "Chênh lệch kiểm kê", SystemOperationEligibility.Default, AuthorizationPolicies.InventoryIssueApprove),
        new("mrx-batch-review", "Rà soát và chốt lô", SystemOperationEligibility.MaterialReconciliation, ""),
        new("mrx-source-change", "Thay đổi nguồn thực đơn", SystemOperationEligibility.MaterialReconciliation, ""),
        new("mrx-supplemental-demand", "Nhu cầu suất phát sinh", SystemOperationEligibility.MaterialReconciliation, ""),
        new("mrx-historical-purpose", "Phân bổ phiếu lịch sử", SystemOperationEligibility.MaterialReconciliation, "")
    ];

    public static IReadOnlyList<OperationalApprovalTarget> ForActor(ClaimsPrincipal actor, string mode)
    {
        var roles = actor.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToArray();
        if (!roles.Any(role => AuthorizationPolicies.ReconciliationDecisionRoles.Contains(role, StringComparer.OrdinalIgnoreCase)))
            return [];
        var permissions = ApprovalInboxUserPolicy.ResolvePermissions(actor);
        return Targets.Where(target => target.Mode == mode &&
            (target.Permission.Length == 0 || permissions.Contains(target.Permission))).ToArray();
    }

    public static void Require(ClaimsPrincipal actor, string mode, string targetType)
    {
        if (!ForActor(actor, mode).Any(target => target.TargetType == targetType))
            throw new UnauthorizedAccessException("Bạn không có quyền xem hoặc duyệt loại hồ sơ trong chế độ hiện tại.");
    }
}
