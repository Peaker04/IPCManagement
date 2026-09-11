using System.Security.Claims;
using IPCManagement.Api.Security;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalInboxUserPolicy
{
    public static HashSet<string> ResolvePermissions(ClaimsPrincipal user)
    {
        var roleNames = user.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .ToList();

        return roleNames
            .SelectMany(AuthorizationPolicies.ResolvePermissions)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }
}
