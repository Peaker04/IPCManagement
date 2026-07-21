using System.Globalization;
using FluentAssertions;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Api.Tests;

public class CanonicalBomWorkbookTests
{
    private static readonly string[] RequiredHeaders =
    [
        "Món",
        "Nguyên liệu chính",
        "Khối lượng ( kg)",
        "Giá nhập (kg)",
        "Số lượng suất ăn",
        "Định lượng (gram) / khay"
    ];

    [Fact]
    public void CurrentCanonicalBomWorkbook_ShouldContainThreeIndependentTierDatasets()
    {
        var fixturePath = Path.Combine(
            AppContext.BaseDirectory,
            "Fixtures",
            "IPC. Định lượng 07.2026.xlsx");
        var reader = new XlsxWorkbookReader();
        var tier25 = reader.ReadTable(fixturePath, "định lượng suất 25k", RequiredHeaders);
        var tier30 = reader.ReadTable(fixturePath, "định lượng suất 30k", RequiredHeaders);
        var tier34 = reader.ReadTable(fixturePath, "định lượng suất 34k", RequiredHeaders);

        (tier25.Count + tier30.Count + tier34.Count).Should().Be(1999);
        tier25.Should().NotBeEmpty();
        tier30.Should().NotBeEmpty();
        tier34.Should().NotBeEmpty();

        var quantities25 = BuildAverageQuantities(tier25);
        var quantities30 = BuildAverageQuantities(tier30);
        var quantities34 = BuildAverageQuantities(tier34);
        var commonKeys = quantities25.Keys
            .Intersect(quantities30.Keys, StringComparer.OrdinalIgnoreCase)
            .Intersect(quantities34.Keys, StringComparer.OrdinalIgnoreCase)
            .ToList();

        commonKeys.Should().NotBeEmpty();
        commonKeys.Any(key => quantities25[key] != quantities30[key]).Should().BeTrue();
        commonKeys.Any(key => quantities30[key] != quantities34[key]).Should().BeTrue();

        var ratios30To25 = commonKeys
            .Where(key => quantities25[key] > 0)
            .Select(key => decimal.Round(quantities30[key] / quantities25[key], 6))
            .Distinct()
            .ToList();
        var ratios34To30 = commonKeys
            .Where(key => quantities30[key] > 0)
            .Select(key => decimal.Round(quantities34[key] / quantities30[key], 6))
            .Distinct()
            .ToList();

        ratios30To25.Should().HaveCountGreaterThan(1, "30k must not be derived from 25k by one fixed multiplier");
        ratios34To30.Should().HaveCountGreaterThan(1, "34k must not be derived from 30k by one fixed multiplier");
    }

    private static Dictionary<string, decimal> BuildAverageQuantities(
        IEnumerable<IReadOnlyDictionary<string, string>> rows)
        => rows
            .Select(row => new
            {
                Key = $"{Read(row, "Món").Trim()}|{Read(row, "Nguyên liệu chính").Trim()}",
                Quantity = ParseDecimal(Read(row, "Định lượng (gram) / khay"))
            })
            .Where(row => row.Key != "|" && row.Quantity > 0)
            .GroupBy(row => row.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.Average(row => row.Quantity),
                StringComparer.OrdinalIgnoreCase);

    private static string Read(IReadOnlyDictionary<string, string> row, string header)
        => row.TryGetValue(header, out var value) ? value : string.Empty;

    private static decimal ParseDecimal(string value)
        => decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var invariant)
            ? invariant
            : decimal.TryParse(value, NumberStyles.Any, CultureInfo.GetCultureInfo("vi-VN"), out var localized)
                ? localized
                : 0m;
}
