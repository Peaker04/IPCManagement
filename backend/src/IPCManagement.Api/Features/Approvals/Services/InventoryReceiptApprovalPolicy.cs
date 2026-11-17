using IPCManagement.Api.Security;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class InventoryReceiptApprovalPolicy
{
    public static string? RoleBlockedReason(IEnumerable<string> roles) => roles.Any(AuthorizationPolicies.MatchesManagerRole)
        ? null : "Chỉ Quản lý được duyệt phiếu nhập kho sau khi kiểm tra chất lượng.";

    public static string? BlockedReason(string status, string qualityStatus, byte[] createdBy, byte[] actorId)
    {
        if (status != "PENDING_APPROVAL" || qualityStatus is not ("ACCEPTED" or "PARTIALLY_ACCEPTED"))
            return "Chỉ phiếu nhập đã kiểm tra chất lượng và chờ duyệt mới được Quản lý quyết định.";
        return createdBy.SequenceEqual(actorId) ? "Người tạo phiếu nhập không được tự duyệt." : null;
    }
}
