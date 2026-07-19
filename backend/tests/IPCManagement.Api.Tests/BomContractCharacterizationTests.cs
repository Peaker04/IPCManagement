using System.Collections;
using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Api.Tests;

public class BomContractCharacterizationTests
{
    [Fact]
    public void LegacyPresetContract_Should_ExposeExactlyThreeKnownPriceTierSheets()
    {
        var field = typeof(SampleDataImportService).GetField("PresetBomSheets", BindingFlags.NonPublic | BindingFlags.Static);
        var sheets = ((IEnumerable)field!.GetValue(null)!).Cast<object>()
            .Select(item => ((string, decimal))item)
            .ToList();

        sheets.Should().Equal(
            ("định lượng suất 25k", 25000m),
            ("định lượng suất 30k", 30000m),
            ("định lượng suất 34k", 34000m));
    }

    [Fact]
    public void LegacyPresetContract_Should_RequireCurrentWorkbookHeaders()
    {
        var field = typeof(SampleDataImportService).GetField("BomRequiredHeaders", BindingFlags.NonPublic | BindingFlags.Static);
        var headers = ((IEnumerable<string>)field!.GetValue(null)!).ToList();

        headers.Should().ContainInOrder(
            "Món",
            "Nguyên liệu chính",
            "Khối lượng ( kg)",
            "Giá nhập (kg)",
            "Số lượng suất ăn",
            "Định lượng (gram) / khay");
    }

    [Fact]
    public void LegacyDuplicateMerge_Should_UseServingWeightedQuantityWhenBasisExists()
    {
        var rows = new List<IReadOnlyDictionary<string, string>>
        {
            Row("0.1", "100"),
            Row("0.2", "300")
        };

        InvokeSampleDataStatic<decimal>("CalculateWeightedGrossQty", rows).Should().Be(0.175m);
    }

    [Fact]
    [Trait("ReplacementTarget", "FailClosed")]
    public void LegacyDuplicateMerge_WithoutServingBasis_CurrentlyUsesUnweightedAverage()
    {
        var rows = new List<IReadOnlyDictionary<string, string>>
        {
            Row("0.1", "0"),
            Row("0.2", "")
        };

        // Characterization only. D-03-03 requires the canonical replacement to BLOCK this input.
        InvokeSampleDataStatic<decimal>("CalculateWeightedGrossQty", rows).Should().Be(0.15m);
    }

    [Theory]
    [InlineData("Trứng gà", "CAI")]
    [InlineData("Sữa chua", "HOP")]
    [InlineData("Chuối", "QUA")]
    [InlineData("Bánh mì", "O")]
    [InlineData("Chả cá", "MIENG")]
    [InlineData("Căn cuộn", "CAY")]
    [InlineData("Đậu khuôn", "LAT")]
    public void LegacyTechnicalUnitMap_Should_ResolveKnownCountedIngredients(string ingredientName, string expectedCode)
    {
        ResolveLegacyUnit(ingredientName).UnitCode.Should().Be(expectedCode);
    }

    [Fact]
    [Trait("ReplacementTarget", "FailClosed")]
    public void LegacyTechnicalUnitMap_UnknownIngredient_CurrentlyFallsBackToKg()
    {
        // Characterization only. D-03-04 requires the canonical replacement to return Unknown/BLOCK.
        ResolveLegacyUnit("Nguyên liệu chưa khai báo").UnitCode.Should().Be("KG");
    }

    [Theory]
    [InlineData(25000)]
    [InlineData(30000)]
    [InlineData(34000)]
    public void ManualBomTierPolicy_Should_AcceptOnlyCurrentCanonicalTiers(decimal tier)
    {
        InvokeDishStatic<decimal>("NormalizePriceTier", tier).Should().Be(tier);
    }

    [Fact]
    public void ManualBomIntervalPolicy_Should_TreatEffectiveDatesAsInclusive()
    {
        InvokeDishStatic<bool>(
            "DateRangesOverlap",
            new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31),
            new DateOnly(2026, 1, 31), null).Should().BeTrue();
    }

    [Fact]
    public void ManualBomCustomerScope_Should_DistinguishGlobalAndCustomerOverlay()
    {
        var customerA = GuidHelper.NewId();
        var customerB = GuidHelper.NewId();

        InvokeDishStatic<bool>("MatchesBomCustomerScope", null, null).Should().BeTrue();
        InvokeDishStatic<bool>("MatchesBomCustomerScope", customerA, customerA.ToArray()).Should().BeTrue();
        InvokeDishStatic<bool>("MatchesBomCustomerScope", null, customerA).Should().BeFalse();
        InvokeDishStatic<bool>("MatchesBomCustomerScope", customerA, customerB).Should().BeFalse();
    }

    private static IReadOnlyDictionary<string, string> Row(string quantity, string servings) =>
        new Dictionary<string, string>
        {
            ["Định lượng (gram) / khay"] = quantity,
            ["Số lượng suất ăn"] = servings
        };

    private static Unit ResolveLegacyUnit(string ingredientName)
    {
        var kg = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram" };
        var units = new[] { "CAI", "HOP", "QUA", "O", "MIENG", "CAY", "LAT" }
            .ToDictionary(
                code => code,
                code => new Unit { UnitId = GuidHelper.NewId(), UnitCode = code, UnitName = code },
                StringComparer.OrdinalIgnoreCase);

        return InvokeSampleDataStatic<Unit>("ResolvePresetBomUnit", ingredientName, kg, units);
    }

    private static T InvokeSampleDataStatic<T>(string methodName, params object?[] args) =>
        InvokeStatic<T>(typeof(SampleDataImportService), methodName, args);

    private static T InvokeDishStatic<T>(string methodName, params object?[] args) =>
        InvokeStatic<T>(typeof(DishService), methodName, args);

    private static T InvokeStatic<T>(Type owner, string methodName, object?[] args)
    {
        var method = owner.GetMethod(methodName, BindingFlags.NonPublic | BindingFlags.Static);
        method.Should().NotBeNull($"{owner.Name}.{methodName} is part of the pre-v1.1 behavior baseline");
        return (T)method!.Invoke(null, args)!;
    }
}
