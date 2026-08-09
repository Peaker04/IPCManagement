using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public sealed class QuotationEvidenceResolutionServiceTests
{
    private static readonly DateTime Now = new(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void EffectiveQuotation_RequiresOneCurrentSupplierSourceForExactIngredientUnitAndDate()
    {
        var request = Request("EFFECTIVE_QUOTATION", expiresAt: null);
        QuotationEvidenceResolutionService.EvaluateCoverage(request, Now).OutcomeId.Should().Be(request.Quotations[0].QuotationId);

        FluentActions.Invoking(() => QuotationEvidenceResolutionService.EvaluateCoverage(
            request with { Quotations = [request.Quotations[0] with { UnitId = Guid.NewGuid().ToString() }] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*exact ingredient/unit*");
        FluentActions.Invoking(() => QuotationEvidenceResolutionService.EvaluateCoverage(
            request with { Quotations = [request.Quotations[0], request.Quotations[0] with { QuotationId = Guid.NewGuid().ToString() }] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*overlapping*");
        FluentActions.Invoking(() => QuotationEvidenceResolutionService.EvaluateCoverage(
            request with { Quotations = [request.Quotations[0] with { EffectiveFrom = new DateOnly(2026, 8, 11) }] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*effective quotation*");
    }

    [Fact]
    public void Exception_ReopensAfterExpiry_AndNeverAcceptsReferencePriceAsEvidence()
    {
        var request = Request("TIME_BOUND_EXCEPTION", Now.AddDays(1));
        QuotationEvidenceResolutionService.EvaluateCoverage(request with { Quotations = [] }, Now).OutcomeId
            .Should().Be(request.Evidence.PackageId);

        FluentActions.Invoking(() => QuotationEvidenceResolutionService.EvaluateCoverage(request with { Quotations = [] }, Now.AddDays(2)))
            .Should().Throw<InvalidOperationException>().WithMessage("*expired*");
        FluentActions.Invoking(() => QuotationEvidenceResolutionService.EvaluateCoverage(
            request with { Evidence = request.Evidence with { SourceTypes = ["INGREDIENT_REFERENCE_PRICE"] }, Quotations = [] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*source quotation line*");
    }

    [Fact]
    public void Workflow_SeparatesActors_EnforcesVersion_AndReplaysWithoutAnotherAudit()
    {
        var service = new QuotationEvidenceResolutionService();
        var request = Request("EFFECTIVE_QUOTATION", null);
        var preview = service.Preview(request, Context("preview", 0, "admin-a", "Admin"));

        FluentActions.Invoking(() => service.Review(preview.ResolutionId, Context("self", 0, "admin-a", "Manager")))
            .Should().Throw<InvalidOperationException>().WithMessage("*different actor*");
        var reviewed = service.Review(preview.ResolutionId, Context("review", 0, "manager-b", "Manager"));
        FluentActions.Invoking(() => service.Apply(reviewed.ResolutionId, Context("stale", 0, "admin-c", "Admin"), Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*version*");

        var applied = service.Apply(reviewed.ResolutionId, Context("apply", 1, "admin-c", "Admin"), Now);
        var replay = service.Apply(reviewed.ResolutionId, Context("apply", 1, "admin-c", "Admin"), Now);
        replay.Should().Be(applied);
        replay.AuditCount.Should().Be(3);
    }

    private static QuotationResolutionRequest Request(string decision, DateTime? expiresAt)
    {
        var ingredient = Guid.NewGuid().ToString();
        var unit = Guid.NewGuid().ToString();
        var supplier = Guid.NewGuid().ToString();
        var quotation = Guid.NewGuid().ToString();
        var manifest = Encoding.UTF8.GetBytes("{\"scope\":\"quotation-line\"}");
        var digest = Convert.ToHexString(SHA256.HashData(manifest));
        var evidence = new EvidencePackageInput(
            Guid.NewGuid().ToString(), "QUOTATION_GAP", ingredient, new string('A', 64), manifest, digest,
            decision, decision == "EFFECTIVE_QUOTATION" ? quotation : null, Now.AddDays(-1), expiresAt,
            ["SUPPLIER_QUOTATION_LINE"],
            [new EvidenceAttestationInput("PURCHASING_SOURCE_OWNER", "owner-p", digest, Now.AddDays(-1), expiresAt)]);
        return new QuotationResolutionRequest(
            ingredient, unit, new DateOnly(2026, 8, 10), new string('A', 64), evidence,
            [new QuotationCoverageCandidate(quotation, ingredient, unit, supplier, true, true,
                new string('B', 64), new DateOnly(2026, 8, 1), new DateOnly(2026, 8, 31))]);
    }

    private static ResolutionCommandContext Context(string command, long version, string actor, string role)
        => new(command, version, actor, role, Now);
}
