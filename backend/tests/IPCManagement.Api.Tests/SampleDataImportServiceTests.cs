using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Api.Tests;

public class SampleDataImportServiceTests
{
    [Theory]
    [InlineData("Kg", "KG")]
    [InlineData("Ký", "KG")]
    [InlineData("Thùng", "THUNG")]
    [InlineData("Bịch", "BICH")]
    public void NormalizeUnitCode_Should_Handle_CommonVietnameseUnits(string input, string expected)
    {
        var result = InvokePrivateStatic<string>("NormalizeUnitCode", input);

        result.Should().Be(expected);
    }

    [Fact]
    public void ParseDate_Should_Handle_ExcelSerial_AndVietnameseDateText()
    {
        var serialResult = InvokePrivateStatic<DateOnly?>("ParseDate", "45823");
        var textResult = InvokePrivateStatic<DateOnly?>("ParseDate", "Từ ngày 15/06/2026 đến ngày 20/06/2026");

        serialResult.Should().Be(new DateOnly(2025, 6, 15));
        textResult.Should().Be(new DateOnly(2026, 6, 15));
    }

    [Theory]
    [InlineData("MENU MẶN - CA SÁNG", "Mặn", "MORNING")]
    [InlineData("MENU CHAY- CA CHIỀU", "Chay", "AFTERNOON")]
    public void TryParseMenuSection_Should_Detect_VariantAndShift(string label, string variant, string shift)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            "TryParseMenuSection",
            BindingFlags.NonPublic | BindingFlags.Static);
        var args = new object?[] { label, null, null };

        var parsed = (bool)method!.Invoke(null, args)!;

        parsed.Should().BeTrue();
        args[1].Should().Be(variant);
        args[2].Should().Be(shift);
    }

    private static T InvokePrivateStatic<T>(string methodName, params object?[] args)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            methodName,
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();
        return (T)method!.Invoke(null, args)!;
    }
}
