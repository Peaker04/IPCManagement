using System.Globalization;
using System.Text.RegularExpressions;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed record PresetBomSourceRow(
    string SheetName,
    decimal PriceTier,
    IReadOnlyDictionary<string, string> Row);

internal sealed record PresetBomDeduplicationResult(
    IReadOnlyList<PresetBomSourceRow> Rows,
    IReadOnlyList<string> Warnings);

internal static class PresetBomImportPolicy
{
    internal static PresetBomDeduplicationResult ValidateAndDeduplicate(
        IReadOnlyList<PresetBomSourceRow> sourceRows)
    {
        var warnings = new List<string>();
        var groups = sourceRows
            .Where(item => !string.IsNullOrWhiteSpace(Get(item.Row, "Món")))
            .Where(item => !string.IsNullOrWhiteSpace(Get(item.Row, "Nguyên liệu chính")))
            .GroupBy(
                item => $"{item.PriceTier:0}|{NormalizeName(Get(item.Row, "Món"))}|{NormalizeName(Get(item.Row, "Nguyên liệu chính"))}",
                StringComparer.OrdinalIgnoreCase)
            .ToList();

        var rows = groups.Select(group =>
        {
            var groupedRows = group.ToList();
            var quantities = groupedRows
                .Select(item => ParseGrossQtyPerServing(item.Row))
                .Distinct()
                .ToList();
            if (quantities.Count <= 1)
            {
                return groupedRows[0];
            }

            var weightedQuantity = CalculateWeightedGrossQty(groupedRows.Select(item => item.Row).ToList());
            var first = groupedRows[0];
            var mergedRow = new Dictionary<string, string>(first.Row, StringComparer.OrdinalIgnoreCase)
            {
                ["Định lượng (gram) / khay"] = weightedQuantity.ToString("0.######", CultureInfo.InvariantCulture)
            };
            warnings.Add(
                $"{first.SheetName}: gộp {groupedRows.Count} dòng '{Get(first.Row, "Món")}/{Get(first.Row, "Nguyên liệu chính")}' " +
                $"theo bình quân gia quyền thành {weightedQuantity:0.######} đơn vị BOM/suất.");
            return new PresetBomSourceRow(first.SheetName, first.PriceTier, mergedRow);
        }).ToList();

        return new PresetBomDeduplicationResult(rows, warnings);
    }

    internal static decimal CalculateWeightedGrossQty(
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        var weightedRows = rows
            .Select(row => new
            {
                Quantity = ParseGrossQtyPerServing(row),
                Servings = ParseInt(Get(row, "Số lượng suất ăn"))
            })
            .Where(item => item.Quantity > 0)
            .ToList();
        var totalServings = weightedRows.Where(item => item.Servings > 0).Sum(item => item.Servings);
        if (totalServings > 0)
        {
            var weightedTotal = weightedRows
                .Where(item => item.Servings > 0)
                .Sum(item => item.Quantity * item.Servings);
            return DecimalPolicy.RoundQuantity(weightedTotal / totalServings);
        }

        return weightedRows.Count == 0
            ? 0
            : DecimalPolicy.RoundQuantity(weightedRows.Average(item => item.Quantity));
    }

    internal static decimal ParseGrossQtyPerServing(IReadOnlyDictionary<string, string> row)
    {
        var workbookQuantity = ParseGrossQty(Get(row, "Định lượng (gram) / khay"));
        if (workbookQuantity > 0)
        {
            return workbookQuantity;
        }

        var totalWeight = ParsePresetDecimal(Get(row, "Khối lượng ( kg)"));
        var servings = ParseInt(Get(row, "Số lượng suất ăn"));
        return totalWeight > 0 && servings > 0
            ? DecimalPolicy.RoundQuantity(totalWeight / servings)
            : 0;
    }

    private static decimal ParseGrossQty(string value)
    {
        var parsed = ParsePresetDecimal(value);
        if (parsed <= 0)
        {
            return 0;
        }

        return DecimalPolicy.RoundQuantity(parsed > 5 ? parsed / 1000 : parsed);
    }

    private static decimal ParsePresetDecimal(string value)
    {
        var parsed = ParseDecimal(value);
        if (parsed != 0 || string.IsNullOrWhiteSpace(value))
        {
            return parsed;
        }

        var normalized = value.Trim().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var scientificValue)
            ? scientificValue
            : 0;
    }

    private static int ParseInt(string value)
        => (int)Math.Round(ParseDecimal(value), MidpointRounding.AwayFromZero);

    private static decimal ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var normalized = value.Trim().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }

    private static string Get(IReadOnlyDictionary<string, string> row, string key)
        => row.TryGetValue(key, out var value) ? value.Trim() : string.Empty;

    private static string NormalizeName(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");
}
