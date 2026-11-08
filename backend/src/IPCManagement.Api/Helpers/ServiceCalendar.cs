namespace IPCManagement.Api.Helpers;

/// <summary>
/// Ngày nghiệp vụ của bếp ăn neo theo múi giờ Việt Nam (UTC+7), không theo UTC —
/// dùng UtcNow.Date sẽ lùi 1 ngày trong khung 00:00–07:00 giờ Việt Nam.
/// </summary>
public static class ServiceCalendar
{
    public const int ServiceDaysPerWeek = 6;

    public static bool IsServiceDay(DateOnly date) => date.DayOfWeek != DayOfWeek.Sunday;

    public static void EnsureServiceDay(DateOnly date)
    {
        if (!IsServiceDay(date))
            throw new IPCManagement.Api.Exceptions.BusinessRuleException("Tuần nghiệp vụ chỉ từ Thứ Hai đến Thứ Bảy; Chủ nhật chỉ được xem lịch sử.");
    }

    private static readonly TimeZoneInfo VietnamTimeZone = ResolveVietnamTimeZone();

    /// <summary>Ngày hôm nay theo giờ Việt Nam.</summary>
    public static DateOnly Today()
        => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, VietnamTimeZone));

    /// <summary>Ngày thứ Hai của tuần chứa <paramref name="date"/>.</summary>
    public static DateOnly StartOfWeek(DateOnly date)
        => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));

    private static TimeZoneInfo ResolveVietnamTimeZone()
    {
        foreach (var timeZoneId in new[] { "SE Asia Standard Time", "Asia/Ho_Chi_Minh" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
                // Thử id tiếp theo (Windows dùng id khác Linux/macOS).
            }
        }

        return TimeZoneInfo.CreateCustomTimeZone("IPC-ICT", TimeSpan.FromHours(7), "ICT", "ICT");
    }
}
