using System.Security.Claims;

namespace IPCManagement.Api.Security;

public interface ICurrentUserService
{
    string? GetUserId(ClaimsPrincipal user);
    IReadOnlyList<string> GetRoleNames(ClaimsPrincipal user);
    string? GetWarehouseId(ClaimsPrincipal user);
}
