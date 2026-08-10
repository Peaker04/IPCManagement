using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Helpers;

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

    [Fact]
    public async Task DurableBomWorkflow_ReplaysAfterReconstruction_AndLinksExactPackageOutcome()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using (var setup = new IpcManagementContext(options)) await DurableEvidenceTestSchema.CreateAsync(setup);
        var request = Request("PUBLISHED_BOM", null);
        await using var first = new IpcManagementContext(options);
        var service = new BomEvidenceResolutionService(first, new EfTransactionRunner(first), new LifecycleTransitionRecorder(first));
        var preview = service.Preview(request, Context("bom-preview", 0, Guid.NewGuid().ToString(), "Catalog"));
        var reviewed = service.Review(preview.ResolutionId, Context("bom-review", 0, Guid.NewGuid().ToString(), "Manager"));
        var applied = service.Apply(reviewed.ResolutionId, Context("bom-apply", 1, Guid.NewGuid().ToString(), "Admin"), Now);
        applied.Status.Should().Be("APPLIED");
        var persisted = await first.Dataqualitydispositions.SingleAsync();
        persisted.CorrectionEntityType.Should().Be("DomainOutcome");
        GuidHelper.ToGuidString(persisted.CorrectionEntityId!).Should().Be(request.Lines[0].BomLineId);
        service.Review(preview.ResolutionId, Context("bom-review", 0, Guid.NewGuid().ToString(), "Manager")).Should().Be(reviewed);
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
