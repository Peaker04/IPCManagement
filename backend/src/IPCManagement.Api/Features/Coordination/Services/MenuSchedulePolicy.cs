using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class MenuSchedulePolicy
{
    private const decimal FixedBomRatePercent = 100m;

    internal static DateOnly ResolveServiceDate(string? serviceDate, string? dayOfWeek)
    {
        if (!string.IsNullOrWhiteSpace(serviceDate) &&
            DateOnly.TryParse(serviceDate, out var parsedServiceDate))
        {
            return parsedServiceDate;
        }

        var monday = ServiceCalendar.StartOfWeek(ServiceCalendar.Today());
        var dayOffset = (dayOfWeek ?? string.Empty).ToLowerInvariant() switch
        {
            "t2" => 0,
            "t3" => 1,
            "t4" => 2,
            "t5" => 3,
            "t6" => 4,
            "t7" => 5,
            "cn" => 6,
            _ => throw new ArgumentException("Ngày trong tuần không hợp lệ.")
        };

        return monday.AddDays(dayOffset);
    }

    internal static DateOnly ResolveWeekStartDate(string? weekStartDate)
    {
        if (!string.IsNullOrWhiteSpace(weekStartDate) &&
            DateOnly.TryParse(weekStartDate, out var parsedWeekStart))
        {
            return parsedWeekStart;
        }

        return ServiceCalendar.StartOfWeek(ServiceCalendar.Today());
    }

    internal static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    internal static string? NormalizeMenuScheduleStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToUpperInvariant() switch
        {
            "DRAFT" => "DRAFT",
            "ACTIVE" or "PUBLISHED" => "ACTIVE",
            "SUPERSEDED" or "ARCHIVED" => "SUPERSEDED",
            "LOCKED" => "LOCKED",
            _ => null
        };
    }

    internal static bool IsPublishedMenuVersionStatus(string? status)
        => MenuVersionStatusPolicy.IsPublishedCompatible(status);

    internal static MenuVersion? ResolveMenuVersion(IEnumerable<MenuVersion> versions, MenuSchedule schedule)
        => versions
            .Where(version =>
                version.WeekStartDate == schedule.WeekStartDate &&
                version.CustomerId.SequenceEqual(schedule.CustomerId))
            .OrderByDescending(version => version.VersionNo)
            .FirstOrDefault();

    internal static MenuVersion? ResolveRollbackTarget(
        IReadOnlyList<MenuVersion> versions,
        MenuVersion current,
        RollbackMenuVersionRequest request)
    {
        var requestedTargetId = GuidHelper.ParseFilterIdOrThrow(
            request.TargetMenuVersionId,
            "phiên bản thực đơn đích");
        if (requestedTargetId is not null)
        {
            return versions.FirstOrDefault(version => version.MenuVersionId.SequenceEqual(requestedTargetId));
        }

        if (request.TargetVersionNo is not null)
        {
            return versions.FirstOrDefault(version => version.VersionNo == request.TargetVersionNo.Value);
        }

        return versions
            .Where(version => version.VersionNo < current.VersionNo)
            .OrderByDescending(version => version.PublishedAt.HasValue)
            .ThenByDescending(version => version.VersionNo)
            .FirstOrDefault();
    }

    internal static MenuScheduleDto MapMenuSchedule(MenuSchedule schedule, MenuVersion? version = null)
        => new()
        {
            MenuScheduleId = GuidHelper.ToGuidString(schedule.MenuScheduleId),
            CustomerId = GuidHelper.ToGuidString(schedule.CustomerId),
            CustomerCode = schedule.Customer.CustomerCode,
            CustomerName = schedule.Customer.CustomerName,
            MenuId = GuidHelper.ToGuidString(schedule.MenuId),
            MenuCode = schedule.Menu.MenuCode,
            MenuName = schedule.Menu.MenuName,
            ServiceDate = schedule.ServiceDate.ToString("yyyy-MM-dd"),
            WeekStartDate = schedule.WeekStartDate.ToString("yyyy-MM-dd"),
            ShiftName = schedule.ShiftName,
            Shift = ToDisplayShift(schedule.ShiftName),
            DayOfWeek = ToDayCode(schedule.ServiceDate),
            MenuPrice = DecimalPolicy.RoundMoney(schedule.MenuPrice),
            BomRatePercent = FixedBomRatePercent,
            Status = schedule.Status,
            MenuVersionId = version is null ? null : GuidHelper.ToGuidString(version.MenuVersionId),
            MenuVersionNo = version?.VersionNo,
            MenuVersionStatus = version?.Status,
            PublishedBy = version?.PublishedBy is null ? null : GuidHelper.ToGuidString(version.PublishedBy),
            PublishedAt = version?.PublishedAt?.ToString("O"),
            SourceImportBatch = version?.SourceImportBatch,
            Dishes = schedule.Menu.Menuitems
                .OrderBy(item => item.DisplayOrder)
                .Select(item => new MenuScheduleDishDto
                {
                    DishId = GuidHelper.ToGuidString(item.DishId),
                    DishCode = item.Dish.DishCode,
                    DishName = item.Dish.DishName,
                    DishGroup = item.Dish.DishGroup,
                    DishType = item.Dish.DishType,
                    DisplayOrder = item.DisplayOrder
                })
                .ToList()
        };

    private static string ToDisplayShift(string shiftName)
        => string.Equals(shiftName, "MORNING", StringComparison.OrdinalIgnoreCase)
            ? "Ca Sáng"
            : "Ca Chiều";

    private static string ToDayCode(DateOnly serviceDate)
        => serviceDate.DayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            _ => "cn"
        };
}
