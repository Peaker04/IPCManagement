using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class PortionRulePolicy
{
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

    internal static bool SamePortionRuleScope(PortionRule left, PortionRule right)
        => SameOptionalBytes(left.DishId, right.DishId) &&
           string.Equals(NormalizeNullableCode(left.MenuVariant), NormalizeNullableCode(right.MenuVariant), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableText(left.MenuSectionName), NormalizeNullableText(right.MenuSectionName), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableCode(left.SlotName), NormalizeNullableCode(right.SlotName), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableText(left.DishCategory), NormalizeNullableText(right.DishCategory), StringComparison.Ordinal);

    internal static bool SameOptionalBytes(byte[]? left, byte[]? right)
        => left is null
            ? right is null
            : right is not null && left.SequenceEqual(right);

    internal static bool CsvScopesOverlap(string? left, string? right)
    {
        var leftValues = SplitOptionalCsv(left);
        var rightValues = SplitOptionalCsv(right);
        return leftValues.Count == 0 ||
               rightValues.Count == 0 ||
               leftValues.Any(item => rightValues.Contains(item, StringComparer.OrdinalIgnoreCase));
    }

    internal static bool MatchesCsv(string? csv, string? value)
    {
        var values = SplitOptionalCsv(csv);
        if (values.Count == 0)
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(value) &&
               values.Contains(value, StringComparer.OrdinalIgnoreCase);
    }

    internal static bool MatchesNullableScope(
        string? ruleValue,
        string? requestValue,
        Func<string?, string?> normalize)
    {
        var normalizedRuleValue = normalize(ruleValue);
        if (string.IsNullOrWhiteSpace(normalizedRuleValue))
        {
            return true;
        }

        return string.Equals(normalizedRuleValue, normalize(requestValue), StringComparison.Ordinal);
    }

    internal static int PortionRuleMatchScore(PortionRule rule)
    {
        var source = ResolvePortionRuleSource(rule);
        var baseScore = source switch
        {
            "DISH_OVERRIDE" => 400,
            "CATEGORY_SLOT" => 300,
            "CUSTOMER_SHIFT" => 200,
            _ => 100
        };

        return baseScore + rule.Priority;
    }

    internal static string ResolvePortionRuleSource(PortionRule rule)
    {
        if (rule.DishId is not null)
        {
            return "DISH_OVERRIDE";
        }

        if (!string.IsNullOrWhiteSpace(rule.MenuVariant) ||
            !string.IsNullOrWhiteSpace(rule.MenuSectionName) ||
            !string.IsNullOrWhiteSpace(rule.SlotName) ||
            !string.IsNullOrWhiteSpace(rule.DishCategory))
        {
            return "CATEGORY_SLOT";
        }

        if (!string.IsNullOrWhiteSpace(rule.ActiveWeekDays) ||
            !string.IsNullOrWhiteSpace(rule.ShiftNames))
        {
            return "CUSTOMER_SHIFT";
        }

        return "CUSTOMER_DEFAULT";
    }

    internal static string? NormalizePortionRuleStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToUpperInvariant() switch
        {
            "ACTIVE" or "PUBLISHED" => "ACTIVE",
            "DRAFT" => "DRAFT",
            "INACTIVE" or "DISABLED" => "INACTIVE",
            _ => null
        };
    }

    internal static string? NormalizeNullableCode(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim().ToUpperInvariant();

    internal static string? NormalizeNullableText(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();

    internal static string? NormalizeOptionalWeekDays(IReadOnlyList<string>? values)
    {
        if (values is null || values.Count == 0)
        {
            return null;
        }

        var normalized = values
            .Select(NormalizeDayCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(DaySortOrder)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ngày áp dụng portion rule không hợp lệ.");
        }

        return string.Join(",", normalized);
    }

    internal static string? NormalizeOptionalShiftNames(IReadOnlyList<string>? values)
    {
        if (values is null || values.Count == 0)
        {
            return null;
        }

        var normalized = values
            .Select(NormalizeShiftName)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ca áp dụng portion rule không hợp lệ.");
        }

        return string.Join(",", normalized.Select(item => item!).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(item => item));
    }

    internal static IReadOnlyList<string> SplitOptionalCsv(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    internal static string BuildPortionRuleAuditValue(PortionRule rule)
        => $"{ResolvePortionRuleSource(rule)}; portion={rule.PortionRatePercent}; bom={rule.BomRatePercent?.ToString() ?? "-"}; status={rule.Status}";

    internal static PortionRuleDto MapPortionRule(PortionRule rule)
        => new()
        {
            PortionRuleId = GuidHelper.ToGuidString(rule.PortionRuleId),
            CustomerId = GuidHelper.ToGuidString(rule.CustomerId),
            CustomerCode = rule.Customer.CustomerCode,
            CustomerName = rule.Customer.CustomerName,
            DishId = rule.DishId is null ? null : GuidHelper.ToGuidString(rule.DishId),
            DishCode = rule.Dish?.DishCode,
            DishName = rule.Dish?.DishName,
            EffectiveFrom = rule.EffectiveFrom.ToString("yyyy-MM-dd"),
            EffectiveTo = rule.EffectiveTo?.ToString("yyyy-MM-dd"),
            ActiveWeekDays = SplitOptionalCsv(rule.ActiveWeekDays),
            ShiftNames = SplitOptionalCsv(rule.ShiftNames),
            MenuVariant = rule.MenuVariant,
            MenuSectionName = rule.MenuSectionName,
            SlotName = rule.SlotName,
            DishCategory = rule.DishCategory,
            PortionRatePercent = rule.PortionRatePercent,
            BomRatePercent = rule.BomRatePercent,
            YieldLossPercent = rule.YieldLossPercent,
            Priority = rule.Priority,
            Status = rule.Status,
            Reason = rule.Reason,
            RuleSource = ResolvePortionRuleSource(rule)
        };

}
