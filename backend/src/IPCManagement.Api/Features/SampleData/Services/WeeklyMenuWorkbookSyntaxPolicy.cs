using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class WeeklyMenuWorkbookSyntaxPolicy
{
    private static readonly (string Slot, string[] Keywords)[] SlotRules =
    [
        ("main", ["MON MAN 1", "MON MAN CHINH", "MON CHAY CHINH", "MON CHINH"]),
        ("sub1", ["MON MAN 2", "PHU 1"]),
        ("sub2", ["PHU 2"]),
        ("sub1", ["PHU"]),
        ("rau", ["RAU"]),
        ("canh", ["CANH", "MON NUOC", "SUA CANH"]),
        ("fruit", ["TRAI CAY"]),
        ("dessert", ["SUA CHUA", "SUA", "TRANG MIENG"])
    ];

    internal static bool TryParseSection(string value, out WeeklyMenuSection section)
    {
        section = default!;
        if (!IsSection(value))
        {
            return false;
        }

        var normalized = NormalizeText(value);
        var sourceShift = normalized.Contains("CHIEU", StringComparison.OrdinalIgnoreCase)
            ? "AFTERNOON"
            : normalized.Contains("TOI", StringComparison.OrdinalIgnoreCase)
                ? "DINNER"
                : normalized.Contains("TRUA", StringComparison.OrdinalIgnoreCase)
                    ? "LUNCH"
                    : "MORNING";
        var dbShift = sourceShift is "AFTERNOON" or "DINNER" ? "AFTERNOON" : "MORNING";
        var variantKey = normalized.Contains("CHAY", StringComparison.OrdinalIgnoreCase) ? "vegetarian" : "savory";
        var variantLabel = variantKey == "vegetarian" ? "Chay" : "Mặn";
        var shiftLabel = sourceShift switch
        {
            "AFTERNOON" => "Ca chiều",
            "DINNER" => "Ca tối",
            "LUNCH" => "Ca trưa",
            _ => "Ca sáng"
        };

        section = new WeeklyMenuSection(
            value.Trim(),
            $"{variantKey}-{sourceShift.ToLowerInvariant()}",
            sourceShift,
            shiftLabel,
            dbShift,
            variantKey,
            variantLabel);
        return true;
    }

    internal static bool IsSection(string? value)
    {
        var normalized = NormalizeText(value);
        return normalized.Contains("MENU", StringComparison.OrdinalIgnoreCase) &&
               (normalized.Contains("MAN", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("CHAY", StringComparison.OrdinalIgnoreCase)) &&
               (normalized.Contains("SANG", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("CHIEU", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("TRUA", StringComparison.OrdinalIgnoreCase) ||
                normalized.Contains("TOI", StringComparison.OrdinalIgnoreCase));
    }

    internal static string? ResolveSlot(string? value)
    {
        var normalized = NormalizeText(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        foreach (var (slot, keywords) in SlotRules)
        {
            if (keywords.Any(keyword => normalized.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
            {
                return slot;
            }
        }

        return string.Equals(normalized, "MON", StringComparison.OrdinalIgnoreCase) ? "main" : null;
    }

    internal static string NormalizeDishCell(string value)
    {
        var normalized = Regex.Replace(value.Trim(), @"\s+", " ");
        normalized = Regex.Replace(normalized, @"\b\d+\s*(g|gram)\b", " ", RegexOptions.IgnoreCase);
        return Regex.Replace(normalized, @"\s+", " ").Trim();
    }

    internal static string NormalizeText(string? value)
        => Regex.Replace(RemoveDiacritics(value ?? string.Empty).Trim().ToUpperInvariant(), @"\s+", " ");

    internal static bool IsHolidayCell(string value)
    {
        var normalized = NormalizeText(value);
        return normalized.Contains("NGHI LE", StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains("NGHI", StringComparison.OrdinalIgnoreCase);
    }

    internal static string ToVietnameseShift(string shiftName)
        => string.Equals(shiftName, "MORNING", StringComparison.OrdinalIgnoreCase) ? "Ca sáng" : "Ca chiều";

    internal static string GetColumnValue(IReadOnlyDictionary<string, string> row, string column)
        => row.TryGetValue(column, out var value) ? value.Trim() : string.Empty;

    private static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(capacity: normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
