using System.Security.Claims;

namespace IPCManagement.Api.Security;

public interface ICurrentUserService
{
    string? GetUserId(ClaimsPrincipal user);
}
