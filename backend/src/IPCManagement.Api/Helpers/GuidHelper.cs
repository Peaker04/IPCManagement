using IPCManagement.Api.Exceptions;

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

    /// <summary>
    /// Parse một id dùng làm <b>bộ lọc tùy chọn</b>, phân biệt "không truyền" với "truyền nhưng sai định dạng".
    /// </summary>
    /// <remarks>
    /// <see cref="ParseGuidString"/> trả <c>null</c> cho cả hai trường hợp. Ở mẫu
    /// <c>if (id is not null) query = query.Where(...)</c> điều đó nghĩa là một id sai định dạng
    /// khiến bộ lọc bị bỏ hẳn — người dùng nhìn thấy dữ liệu của <b>toàn bộ</b> phạm vi
    /// như thể đó là phạm vi họ đã chọn. Dùng hàm này cho mọi bộ lọc để lỗi nổi lên thay vì mở rộng dữ liệu.
    /// </remarks>
    /// <returns><c>false</c> khi giá trị có nội dung nhưng không phải Guid hợp lệ.</returns>
    public static bool TryParseFilterId(string? value, out byte[]? id)
    {
        id = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!Guid.TryParse(value, out var guid)) return false;
        id = guid.ToByteArray();
        return true;
    }

    /// <summary>
    /// Như <see cref="TryParseFilterId"/> nhưng ném <see cref="BusinessRuleException"/> (HTTP 400)
    /// khi bộ lọc sai định dạng, để lời gọi không phải lặp lại nhánh kiểm tra.
    /// </summary>
    public static byte[]? ParseFilterIdOrThrow(string? value, string filterLabel)
    {
        if (TryParseFilterId(value, out var id)) return id;
        throw new BusinessRuleException(
            $"Bộ lọc {filterLabel} không đúng định dạng mã định danh. Hệ thống không trả dữ liệu của toàn bộ phạm vi khi bộ lọc sai.");
    }
}
