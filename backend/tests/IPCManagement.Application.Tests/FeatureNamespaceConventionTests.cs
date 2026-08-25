using FluentAssertions;
using IPCManagement.Api.Features.Auth.Services;

namespace IPCManagement.Application.Tests;

public class FeatureNamespaceConventionTests
{
    private static readonly HashSet<string> AllowedFeatures =
    [
        "Admin",
        "Approvals",
        "Auth",
        "Catalog",
        "Coordination",
        "Inventory",
        "Planning",
        "Purchasing",
        "Reconciliation",
        "Reports",
        "SampleData",
        "SystemOperation",
    ];

    private static readonly HashSet<string> AllowedLayers =
    [
        "Contracts",
        "Controllers",
        "Persistence",
        "Services",
        "Validators",
    ];

    [Fact]
    public void ProductionAssembly_Should_NotExposeLegacyLayerNamespaces()
    {
        var legacyPrefixes = new[]
        {
            "IPCManagement.Api.Controllers",
            "IPCManagement.Api.Models.DTOs",
            "IPCManagement.Api.Models.Validators",
            "IPCManagement.Api.Services",
        };

        var legacyTypes = GetProductionTypes()
            .Where(type => legacyPrefixes.Any(prefix =>
                type.Namespace?.Equals(prefix, StringComparison.Ordinal) == true
                || type.Namespace?.StartsWith($"{prefix}.", StringComparison.Ordinal) == true))
            .Select(type => type.FullName)
            .ToArray();

        legacyTypes.Should().BeEmpty();
    }

    [Fact]
    public void FeatureTypes_Should_UseRecognizedFeatureAndLayerNamespaces()
    {
        var invalidTypes = GetProductionTypes()
            .Where(type => type.Namespace?.StartsWith("IPCManagement.Api.Features.", StringComparison.Ordinal) == true)
            .Select(type => new { Type = type, Segments = type.Namespace!.Split('.') })
            .Where(item => item.Segments.Length != 5
                || !AllowedFeatures.Contains(item.Segments[3])
                || !AllowedLayers.Contains(item.Segments[4]))
            .Select(item => item.Type.FullName)
            .ToArray();

        invalidTypes.Should().BeEmpty();
    }

    [Fact]
    public void SharedTypes_Should_RemainContractOnly()
    {
        var invalidTypes = GetProductionTypes()
            .Where(type => type.Namespace?.StartsWith("IPCManagement.Api.Shared", StringComparison.Ordinal) == true)
            .Where(type => type.Namespace != "IPCManagement.Api.Shared.Contracts")
            .Select(type => type.FullName)
            .ToArray();

        invalidTypes.Should().BeEmpty();
    }

    private static Type[] GetProductionTypes() => typeof(AuthService).Assembly.GetTypes();
}
