using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace IPCManagement.Api.Security;

public sealed class CurrentUserService : ICurrentUserService
{
    public string? GetUserId(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);
}
