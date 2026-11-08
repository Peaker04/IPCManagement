using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Security;

public sealed class CurrentUserService(IConfiguration configuration) : ICurrentUserService
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
    {
        var claimValue = user.FindFirstValue("warehouseId")
            ?? user.FindFirstValue("warehouse_id")
            ?? user.FindFirstValue("WarehouseId");
        if (claimValue is null) return null;

        var claimId = GuidHelper.ParseGuidString(claimValue);
        var canonicalValue = configuration["OperationalWarehouse:WarehouseId"];
        var canonicalId = GuidHelper.ParseGuidString(canonicalValue);
        return claimId is not null && canonicalId is not null && claimId.AsSpan().SequenceEqual(canonicalId)
            ? canonicalValue
            : null;
    }
}
