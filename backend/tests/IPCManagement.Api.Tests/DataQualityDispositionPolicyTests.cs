using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class DataQualityDispositionPolicyTests
{
    [Theory]
    [InlineData("stock_movement_balance", "STOCK_MOVEMENT_BALANCE")]
    [InlineData("MENU_WEEK_MISMATCH", "MENU_WEEK_MISMATCH")]
    [InlineData(" unit_normalization ", "UNIT_NORMALIZATION")]
    [InlineData("QUOTATION_GAP", "QUOTATION_GAP")]
    [InlineData("BOM_GAP", "BOM_GAP")]
    [InlineData("DUPLICATE_INGREDIENT", "DUPLICATE_INGREDIENT")]
    public void NormalizeIssueType_KnownType_ReturnsCanonical(string input, string expected)
        => Assert.Equal(expected, DataQualityDispositionPolicy.NormalizeIssueType(input));

    [Fact]
    public void NormalizeIssueType_UnknownType_Rejects()
        => Assert.Throws<ArgumentException>(() => DataQualityDispositionPolicy.NormalizeIssueType("AUTO_MERGE_BY_NAME"));

    [Fact]
    public void NormalizeFingerprint_RequiresSha256Hex()
    {
        var fingerprint = new string('a', 64);
        Assert.Equal(fingerprint.ToUpperInvariant(), DataQualityDispositionPolicy.NormalizeFingerprint(fingerprint));
        Assert.Throws<ArgumentException>(() => DataQualityDispositionPolicy.NormalizeFingerprint("abc"));
    }

    [Fact]
    public void RequireJson_RequiresObjectEvidence()
    {
        Assert.Equal("{\"source\":\"audit\"}", DataQualityDispositionPolicy.RequireJson("{\"source\":\"audit\"}"));
        Assert.Throws<ArgumentException>(() => DataQualityDispositionPolicy.RequireJson("[]"));
        Assert.ThrowsAny<System.Text.Json.JsonException>(() => DataQualityDispositionPolicy.RequireJson("not-json"));
    }

    [Fact]
    public void CanConvertUnits_RequiresPositiveRatesAndSameBaseFamily()
    {
        var kilogram = new Unit
        {
            UnitId = Guid.NewGuid().ToByteArray(), UnitCode = "KG", UnitName = "Kilogram",
            BaseUnitCode = "G", ConvertRateToBase = 1000
        };
        var gram = new Unit
        {
            UnitId = Guid.NewGuid().ToByteArray(), UnitCode = "G", UnitName = "Gram",
            BaseUnitCode = "G", ConvertRateToBase = 1
        };
        var litre = new Unit
        {
            UnitId = Guid.NewGuid().ToByteArray(), UnitCode = "L", UnitName = "Litre",
            BaseUnitCode = "ML", ConvertRateToBase = 1000
        };

        Assert.True(DataQualityPolicy.CanConvertUnits(kilogram, gram));
        Assert.False(DataQualityPolicy.CanConvertUnits(kilogram, litre));
        litre.BaseUnitCode = "G";
        litre.ConvertRateToBase = 0;
        Assert.False(DataQualityPolicy.CanConvertUnits(kilogram, litre));
    }

    [Fact]
    public void UnitReviewService_SourceContainsBusinessBlockAndEvidenceGuards()
    {
        var source = File.ReadAllText(FindRepositoryFile(
            "backend", "src", "IPCManagement.Api", "Features", "Reports", "Services",
            "UnitNormalizationReviewService.cs"));

        Assert.Contains("BLOCKED_BUSINESS", source, StringComparison.Ordinal);
        Assert.Contains("SourceToCatalogFactor is null or <= 0", source, StringComparison.Ordinal);
        Assert.Contains("CanConvertUnits", source, StringComparison.Ordinal);
        Assert.Contains("MatchesManagerRole", source, StringComparison.Ordinal);
        Assert.Contains("Auditlogs.Add", source, StringComparison.Ordinal);
    }

    private static string FindRepositoryFile(params string[] segments)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
            directory = directory.Parent;
        return Path.Combine(directory?.FullName ?? throw new InvalidOperationException("Workspace root not found."), Path.Combine(segments));
    }
}
