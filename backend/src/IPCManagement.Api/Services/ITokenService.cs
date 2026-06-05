using System.Security.Claims;

namespace IPCManagement.Api.Services;

public interface ITokenService
{
    /// <summary>Tạo JWT access token ngắn hạn (15–60 phút).</summary>
    string GenerateAccessToken(string userId, string username, string fullName, string roleName);

    /// <summary>Tạo raw refresh token (128-bit ngẫu nhiên, URL-safe base64).</summary>
    string GenerateRefreshToken();

    /// <summary>SHA-256 hash raw token trước khi lưu DB.</summary>
    string HashRefreshToken(string rawToken);

    /// <summary>Thời gian sống của access token (giây).</summary>
    int GetAccessTokenExpirySeconds();

    /// <summary>Thời gian sống của refresh token (ngày).</summary>
    int GetRefreshTokenExpiryDays();

    /// <summary>Validate JWT đã hết hạn và trả về ClaimsPrincipal (dùng cho refresh flow).</summary>
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
