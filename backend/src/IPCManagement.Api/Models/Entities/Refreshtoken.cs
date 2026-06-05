using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Lưu refresh token của user. Mỗi lần login tạo 1 token mới.
/// Token bị vô hiệu hoá khi: đã dùng (IsUsed), bị thu hồi (IsRevoked), hoặc quá hạn (ExpiresAt).
/// </summary>
public class Refreshtoken
{
    public byte[]    TokenId   { get; set; } = null!;
    public byte[]    UserId    { get; set; } = null!;
    /// <summary>SHA-256 hash của token thực (không lưu raw).</summary>
    public string    TokenHash { get; set; } = null!;
    public string    DeviceInfo { get; set; } = string.Empty;
    public DateTime  CreatedAt  { get; set; }
    public DateTime  ExpiresAt  { get; set; }
    public bool      IsUsed     { get; set; }
    public bool      IsRevoked  { get; set; }
    public DateTime? RevokedAt  { get; set; }
    public string?   ReplacedByToken { get; set; }

    public virtual User User { get; set; } = null!;
}
