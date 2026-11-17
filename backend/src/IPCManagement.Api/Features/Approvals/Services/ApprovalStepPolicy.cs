using System.Security.Claims;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalStepPolicy
{
    public static string? ApprovalBlocker(IReadOnlyList<ApprovalAssignment> assignments,
        IEnumerable<byte[]> previousActors, int approvedSteps, ClaimsPrincipal actor)
    {
        if (assignments.Count < 2) return null;
        var next = assignments.Skip(approvedSteps).FirstOrDefault();
        if (next is null) return null;
        var actorId = GuidHelper.ParseGuidString(actor.FindFirstValue(ClaimTypes.NameIdentifier));
        if (actorId is null) return "Không xác định được người duyệt.";
        if (previousActors.Any(previous => previous.SequenceEqual(actorId))) return "Một người không được hoàn thành hai bước phê duyệt.";
        if (next.ApproverUserId is not null && !next.ApproverUserId.SequenceEqual(actorId)) return "Bạn không phải người được chỉ định cho bước duyệt này.";
        if (next.ApproverUserId is null && !actor.FindAll(ClaimTypes.Role).Any(role =>
                string.Equals(role.Value, next.ApproverRole, StringComparison.OrdinalIgnoreCase)))
            return "Vai trò hiện tại không được phép thực hiện bước duyệt này.";
        return null;
    }
}
