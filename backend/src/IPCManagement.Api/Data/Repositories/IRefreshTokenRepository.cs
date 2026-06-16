using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

/// <summary>
/// Quản lý vòng đời của Refresh Token trong DB.
/// Tách riêng để AuthService không phụ thuộc vào EF Core / DbContext.
/// </summary>
public interface IRefreshTokenRepository
{
    /// <summary>Tìm refresh token hợp lệ theo hash + userId. Bao gồm navigation User.Role.</summary>
    Task<Refreshtoken?> FindValidByHashAsync(string tokenHash, byte[] userId);

    /// <summary>Tìm token chỉ theo hash (dùng cho revoke).</summary>
    Task<Refreshtoken?> FindByHashAsync(string tokenHash);

    /// <summary>Thêm refresh token mới vào change tracker (chưa SaveChanges).</summary>
    void Add(Refreshtoken token);

    /// <summary>Xóa các token đã hết hạn / revoked / used của một user.</summary>
    Task CleanupExpiredForUserAsync(byte[] userId);

    /// <summary>Lưu tất cả thay đổi pending.</summary>
    Task SaveChangesAsync();
}
