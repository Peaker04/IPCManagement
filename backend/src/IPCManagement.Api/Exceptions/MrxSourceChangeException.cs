namespace IPCManagement.Api.Exceptions;

/// <summary>
/// Mã lỗi ổn định cho thay đổi nguồn của chế độ MATERIAL_RECONCILIATION.
/// </summary>
public static class MrxErrorCodes
{
    public const string DayLocked = "MRX_DAY_LOCKED";
    public const string SourceStale = "MRX_SOURCE_STALE";
    public const string BatchCompleted = "MRX_BATCH_COMPLETED";
    public const string ServingsSplitRequired = "MRX_SERVINGS_SPLIT_REQUIRED";
    public const string BomMissing = "MRX_BOM_MISSING";
}

/// <summary>
/// Lỗi có mã khi áp dụng thay đổi nguồn MRX; middleware trả đúng <see cref="StatusCode"/>
/// cùng <see cref="Code"/> và danh sách ngày bị khóa (nếu có).
/// </summary>
public sealed class MrxSourceChangeException(
    string code,
    int statusCode,
    string message,
    IReadOnlyList<DateOnly>? lockedDates = null) : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
    public IReadOnlyList<DateOnly>? LockedDates { get; } = lockedDates;
}
