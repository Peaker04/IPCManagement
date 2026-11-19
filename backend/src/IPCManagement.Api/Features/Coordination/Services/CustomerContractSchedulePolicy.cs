using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class CustomerContractSchedulePolicy
{
    internal static IReadOnlyList<string> NormalizeWeekDays(
        IReadOnlyList<string>? requestedWeekDays,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedWeekDays is { Count: > 0 }
            ? requestedWeekDays
            : schedules.Select(schedule => ToDayCode(schedule.ServiceDate)).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["t2", "t3", "t4", "t5", "t6", "t7"];
        }

        var normalized = values
            .Select(NormalizeDayCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(DaySortOrder)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ngày làm việc contract không hợp lệ.");
        }

        return normalized;
    }

    internal static IReadOnlyList<string> NormalizeShiftNames(
        IReadOnlyList<string>? requestedShiftNames,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedShiftNames is { Count: > 0 }
            ? requestedShiftNames
            : schedules.Select(schedule => schedule.ShiftName).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["MORNING", "AFTERNOON"];
        }

        return NormalizeKnownShifts(values);
    }

    internal static string? SerializeServiceShifts(IReadOnlyList<string>? shifts)
        => shifts is null ? null : string.Join(",", NormalizeKnownShifts(shifts));

    internal static IReadOnlyList<string> NormalizeKnownShifts(IReadOnlyList<string> values)
    {
        var normalized = values
            .Select(NormalizeShiftName)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ca phục vụ contract không hợp lệ.");
        }

        return normalized
            .Select(shift => shift!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(shift => shift)
            .ToList();
    }

    internal static string NormalizeDayCode(string value)
        => value.Trim().ToLowerInvariant() switch
        {
            "t2" or "mon" or "monday" => "t2",
            "t3" or "tue" or "tuesday" => "t3",
            "t4" or "wed" or "wednesday" => "t4",
            "t5" or "thu" or "thursday" => "t5",
            "t6" or "fri" or "friday" => "t6",
            "t7" or "sat" or "saturday" => "t7",
            "cn" or "sun" or "sunday" => "cn",
            _ => string.Empty
        };

    internal static int DaySortOrder(string dayCode)
        => dayCode switch
        {
            "t2" => 1,
            "t3" => 2,
            "t4" => 3,
            "t5" => 4,
            "t6" => 5,
            "t7" => 6,
            "cn" => 7,
            _ => 99
        };

    internal static DateOnly? ParseDateOnly(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParse(value, out var parsed))
        {
            return parsed;
        }

        throw new ArgumentException($"{fieldName} không hợp lệ.");
    }

    internal static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    internal static string ToDayCode(DateOnly serviceDate)
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
