using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public sealed class BomEvidenceResolutionServiceTests
{
    private static readonly DateTime Now = new(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void PublishedBom_RequiresExactScopeTierDateSourceAndValidLines()
    {
        var request = Request("PUBLISHED_BOM", null);
        BomEvidenceResolutionService.EvaluateCoverage(request, Now).Diagnostic.Should().Be("PUBLISHED_BOM");

        FluentActions.Invoking(() => BomEvidenceResolutionService.EvaluateCoverage(
            request with { Lines = [request.Lines[0] with { PriceTier = 34000m }] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*scope*");
        FluentActions.Invoking(() => BomEvidenceResolutionService.EvaluateCoverage(
            request with { Lines = [request.Lines[0] with { Quantity = 0 }] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*quantity*");
    }

    [Fact]
    public void DemandDiagnostic_ExposesCurrentExemption_AndBlocksSilentOrExpiredGap()
    {
        var exemption = Request("BOM_EXEMPTION", Now.AddDays(1)) with { Lines = [] };
        BomEvidenceResolutionService.EvaluateCoverage(exemption, Now).ExemptionId.Should().Be(exemption.Evidence.PackageId);
        FluentActions.Invoking(() => BomEvidenceResolutionService.EvaluateCoverage(exemption, Now.AddDays(2)))
            .Should().Throw<InvalidOperationException>().WithMessage("*expired*");

        var silent = Request("PUBLISHED_BOM", null) with { Lines = [] };
        FluentActions.Invoking(() => BomEvidenceResolutionService.EvaluateCoverage(silent, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*blocks demand*");
    }

    [Fact]
    public void CorrectionCreatesNewReviewedVersion_AndReplayDoesNotDuplicateAudit()
    {
        var service = new BomEvidenceResolutionService();
        var request = Request("PUBLISHED_BOM", null);
        var preview = service.Preview(request, Context("preview", 0, "catalog-a", "Catalog"));
        var reviewed = service.Review(preview.ResolutionId, Context("review", 0, "manager-b", "Manager"));
        var applied = service.Apply(reviewed.ResolutionId, Context("apply", 1, "admin-c", "Admin"), Now);
        service.Apply(reviewed.ResolutionId, Context("apply", 1, "admin-c", "Admin"), Now).Should().Be(applied);
        applied.AuditCount.Should().Be(3);
    }

    private static BomResolutionRequest Request(string decision, DateTime? expiry)
    {
        var dish = Guid.NewGuid().ToString();
        var customer = Guid.NewGuid().ToString();
        var manifest = Encoding.UTF8.GetBytes("{\"scope\":\"bom-workbook\"}");
        var digest = Convert.ToHexString(SHA256.HashData(manifest));
        var evidence = new EvidencePackageInput(Guid.NewGuid().ToString(), "BOM_GAP", dish, new string('C', 64),
            manifest, digest, decision, null, Now.AddDays(-1), expiry, ["BOM_WORKBOOK"],
            [new EvidenceAttestationInput("CATALOG_SOURCE_OWNER", "owner-c", digest, Now.AddDays(-1), expiry)]);
        var unit = Guid.NewGuid().ToString();
        return new BomResolutionRequest(dish, customer, 30000m, new DateOnly(2026, 8, 10), new string('C', 64),
            evidence, [new BomCoverageLine(Guid.NewGuid().ToString(), dish, Guid.NewGuid().ToString(),
                unit, unit, customer, 30000m, 1, 0.25m,
                true, new DateOnly(2026, 8, 1), null, new string('D', 64))]);
    }

    private static ResolutionCommandContext Context(string command, long version, string actor, string role)
        => new(command, version, actor, role, Now);
}
