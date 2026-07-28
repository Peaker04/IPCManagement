using System.Globalization;
using System.Text.RegularExpressions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class WeeklyMenuWorkbookLayoutPolicy
{
    private static readonly string[] MenuDayKeys = ["t2", "t3", "t4", "t5", "t6", "t7", "cn"];

    internal static List<WeeklyMenuImportDayColumn> DetectDayColumns(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string labelColumn,
        DateOnly? detectedWeekStart,
        DateOnly? weekStartFallback)
    {
        var labelIndex = ColumnLetterToIndex(labelColumn);
        var datedRows = rows
            .Take(60)
            .Select((row, rowIndex) => new
            {
                RowIndex = rowIndex,
                Dates = row
                    .Where(item => ColumnLetterToIndex(item.Key) > labelIndex)
                    .Select(item => new { item.Key, Date = ParseDayColumnDate(item.Value) })
                    .Where(item => item.Date is not null)
                    .GroupBy(item => item.Key, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(group => group.Key, group => group.First().Date!.Value, StringComparer.OrdinalIgnoreCase)
            })
            .Where(item => item.Dates.Count > 0)
            .OrderByDescending(item => item.Dates.Count)
            .ThenBy(item => item.RowIndex)
            .ToList();

        var datedColumns = datedRows.FirstOrDefault()?.Dates;
        if (datedColumns is not null && datedColumns.Count > 0)
        {
            return datedColumns
                .OrderBy(item => ColumnLetterToIndex(item.Key))
                .Select((item, index) =>
                {
                    var serviceDate = ResolveDayColumnDate(
                        rows,
                        item.Key,
                        item.Value,
                        index,
                        detectedWeekStart ?? weekStartFallback);
                    return new WeeklyMenuImportDayColumn(
                        item.Key,
                        serviceDate,
                        ResolveDayKeyForColumn(rows, item.Key, index),
                        FormatDayColumnLabel(item.Key, serviceDate),
                        datedRows.First().RowIndex + 1);
                })
                .ToList();
        }

        var start = detectedWeekStart ?? weekStartFallback;
        if (start is null)
        {
            return [];
        }

        var weekdayColumns = rows
            .Take(60)
            .SelectMany(row => row)
            .Where(item => ColumnLetterToIndex(item.Key) > labelIndex && ContainsWeekdayLabel(item.Value))
            .Select(item => item.Key)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(ColumnLetterToIndex)
            .ToList();
        var candidateColumns = weekdayColumns.Count > 0
            ? weekdayColumns
            : DetectDishValueColumns(rows, labelColumn);

        return candidateColumns
            .Take(7)
            .Select((column, index) => new WeeklyMenuImportDayColumn(
                column,
                start.Value.AddDays(index),
                ResolveDayKeyForColumn(rows, column, index),
                FormatDayColumnLabel(column, start.Value.AddDays(index)),
                null))
            .ToList();
    }

    internal static DateOnly? ExtractWeekStart(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string fileName,
        DateOnly? weekStartFallback)
    {
        foreach (var value in rows.Take(30).SelectMany(row => row.Values).Concat([fileName]))
        {
            var parsed = ParseDateRangeStart(value, weekStartFallback?.Year);
            if (parsed is not null)
            {
                return parsed;
            }
        }

        return weekStartFallback;
    }

    internal static int ColumnLetterToIndex(string column)
    {
        var result = 0;
        foreach (var character in column.ToUpperInvariant())
        {
            result = (result * 26) + character - 'A' + 1;
        }

        return result;
    }

    internal static DateOnly? ParseImportDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (double.TryParse(value.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        return ParseDateRangeStart(value, null) ?? ParseDate(value);
    }

    private static string ResolveDayKeyForColumn(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string column,
        int fallbackIndex)
    {
        foreach (var row in rows.Take(60))
        {
            var dayKey = ParseWeekdayDayKey(WeeklyMenuWorkbookSyntaxPolicy.GetColumnValue(row, column));
            if (dayKey is not null)
            {
                return dayKey;
            }
        }

        return fallbackIndex >= 0 && fallbackIndex < MenuDayKeys.Length
            ? MenuDayKeys[fallbackIndex]
            : "t2";
    }

    private static DateOnly ResolveDayColumnDate(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string column,
        DateOnly parsedDate,
        int fallbackIndex,
        DateOnly? weekStart)
    {
        var dayKey = ResolveDayKeyForColumn(rows, column, fallbackIndex);
        if (weekStart is null || DayOfWeekForKey(dayKey) == parsedDate.DayOfWeek)
        {
            return parsedDate;
        }

        return weekStart.Value.AddDays(fallbackIndex);
    }

    private static DayOfWeek? DayOfWeekForKey(string dayKey)
        => dayKey switch
        {
            "t2" => DayOfWeek.Monday,
            "t3" => DayOfWeek.Tuesday,
            "t4" => DayOfWeek.Wednesday,
            "t5" => DayOfWeek.Thursday,
            "t6" => DayOfWeek.Friday,
            "t7" => DayOfWeek.Saturday,
            "cn" => DayOfWeek.Sunday,
            _ => null
        };

    private static List<string> DetectDishValueColumns(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows,
        string labelColumn)
    {
        var labelIndex = ColumnLetterToIndex(labelColumn);
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var inSection = false;
        foreach (var row in rows.Take(100))
        {
            var label = WeeklyMenuWorkbookSyntaxPolicy.GetColumnValue(row, labelColumn);
            if (WeeklyMenuWorkbookSyntaxPolicy.IsSection(label))
            {
                inSection = true;
                continue;
            }

            if (!inSection || WeeklyMenuWorkbookSyntaxPolicy.ResolveSlot(label) is null)
            {
                continue;
            }

            foreach (var (column, value) in row)
            {
                if (ColumnLetterToIndex(column) > labelIndex && !string.IsNullOrWhiteSpace(value))
                {
                    columns.Add(column);
                }
            }
        }

        return columns.OrderBy(ColumnLetterToIndex).ToList();
    }

    private static DateOnly? ParseDayColumnDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (double.TryParse(trimmed, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (Regex.IsMatch(WeeklyMenuWorkbookSyntaxPolicy.NormalizeText(trimmed), @"[A-Z]", RegexOptions.IgnoreCase))
        {
            return null;
        }

        return ParseDate(trimmed);
    }

    private static DateOnly? ParseDateRangeStart(string? value, int? fallbackYear)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var match = Regex.Match(value, @"(?<!\d)(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?(?!\d)");
        if (!match.Success)
        {
            return null;
        }

        var year = fallbackYear ?? DateTime.UtcNow.Year;
        if (match.Groups[3].Success)
        {
            year = int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture);
            if (year < 100)
            {
                year += 2000;
            }
        }

        var day = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
        var month = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        return month is >= 1 and <= 12 && day is >= 1 and <= 31
            ? new DateOnly(year, month, day)
            : null;
    }

    internal static bool ContainsWeekdayLabel(string? value)
        => ParseWeekdayDayKey(value) is not null;

    private static string? ParseWeekdayDayKey(string? value)
    {
        var normalized = WeeklyMenuWorkbookSyntaxPolicy.NormalizeText(value);
        if (normalized.Contains("CHU NHAT", StringComparison.OrdinalIgnoreCase))
        {
            return "cn";
        }

        var match = Regex.Match(normalized, @"\bTHU\s*([2-7])\b", RegexOptions.IgnoreCase);
        return match.Success ? $"t{match.Groups[1].Value}" : null;
    }

    private static DateOnly? ParseDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (double.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out var viDate) ||
            DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out viDate))
        {
            return DateOnly.FromDateTime(viDate);
        }

        var match = Regex.Match(value, @"(\d{1,2})/(\d{1,2})/(\d{4})");
        return match.Success
            ? new DateOnly(
                int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture))
            : null;
    }

    private static string FormatDayColumnLabel(string column, DateOnly serviceDate)
        => $"{column} - {serviceDate:dd/MM/yyyy}";
}
