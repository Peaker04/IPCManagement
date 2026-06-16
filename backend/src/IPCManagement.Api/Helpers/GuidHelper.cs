namespace IPCManagement.Api.Helpers;

/// <summary>
/// Chuyển đổi giữa Guid và byte[] (binary(16)) — định dạng PK trong MySQL.
/// </summary>
public static class GuidHelper
{
    /// <summary>Tạo PK mới dưới dạng byte[16].</summary>
    public static byte[] NewId() => Guid.NewGuid().ToByteArray();

    /// <summary>Chuyển Guid thành byte[16].</summary>
    public static byte[] ToBytes(Guid guid) => guid.ToByteArray();

    /// <summary>Chuyển byte[16] thành Guid.</summary>
    public static Guid ToGuid(byte[] bytes) => new(bytes);

    /// <summary>Chuyển byte[16] thành chuỗi Guid (dùng trong JSON response).</summary>
    public static string ToGuidString(byte[] bytes) => new Guid(bytes).ToString();

    /// <summary>Parse chuỗi Guid thành byte[16].</summary>
    public static byte[]? ParseGuidString(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Guid.TryParse(value, out var guid) ? guid.ToByteArray() : null;
    }
}
