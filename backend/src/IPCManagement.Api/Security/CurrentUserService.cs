using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace IPCManagement.Api.Security;

public sealed class CurrentUserService : ICurrentUserService
{
    public string? GetUserId(ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);

    public IReadOnlyList<string> GetRoleNames(ClaimsPrincipal user)
        => user.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

    public string? GetWarehouseId(ClaimsPrincipal user)
        => user.FindFirstValue("warehouseId")
            ?? user.FindFirstValue("warehouse_id")
            ?? user.FindFirstValue("WarehouseId");
}
