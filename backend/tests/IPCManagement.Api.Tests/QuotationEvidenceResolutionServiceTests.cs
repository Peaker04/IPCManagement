using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Infrastructure.Lifecycle;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

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

    [Fact]
    public async Task DurableWorkflow_ReplaysAfterServiceReconstruction_AndRollsBackExpiredApply()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using (var setup = new IpcManagementContext(options)) await CreateDurableSchemaAsync(setup);
        var request = Request("EFFECTIVE_QUOTATION", null);
        var actor = new IpcManagementContext(options);
        var service1 = new QuotationEvidenceResolutionService(actor, new EfTransactionRunner(actor), new LifecycleTransitionRecorder(actor));
        var preview = service1.Preview(request, Context("durable-preview", 0, Guid.NewGuid().ToString(), "Admin"));
        await actor.DisposeAsync();

        await using var reviewContext = new IpcManagementContext(options);
        var service2 = new QuotationEvidenceResolutionService(reviewContext, new EfTransactionRunner(reviewContext), new LifecycleTransitionRecorder(reviewContext));
        FluentActions.Invoking(() => service2.Review(preview.ResolutionId, Context("durable-self", 0, "owner-p", "Manager")))
            .Should().Throw<InvalidOperationException>().WithMessage("*source-owner*");
        var reviewed = service2.Review(preview.ResolutionId, Context("durable-review", 0, Guid.NewGuid().ToString(), "Manager"));
        FluentActions.Invoking(() => service2.Apply(preview.ResolutionId, Context("durable-apply-stale", 0, Guid.NewGuid().ToString(), "Admin"), Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*stale*");
        (await reviewContext.Dataqualitydispositions.SingleAsync()).Status.Should().Be("APPROVED");
        (await reviewContext.Lifecycletransitions.CountAsync()).Should().Be(2);

        var replay = service2.Review(preview.ResolutionId, Context("durable-review", 0, Guid.NewGuid().ToString(), "Manager"));
        replay.Should().Be(reviewed);
    }

    private static async Task CreateDurableSchemaAsync(IpcManagementContext context)
    {
        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            CREATE TABLE businessevidencepackages (packageId BLOB PRIMARY KEY, schemaVersion INTEGER NOT NULL, issueType TEXT NOT NULL, subjectId BLOB NOT NULL, sourceFingerprint TEXT NOT NULL, manifestUtf8 BLOB NOT NULL, manifestSha256 TEXT NOT NULL, sourceDatabase TEXT NOT NULL, migrationHead TEXT NOT NULL, decision TEXT NOT NULL, outcomeEntityType TEXT NULL, outcomeEntityId BLOB NULL, commandId TEXT NOT NULL, createdAtUtc TEXT NOT NULL, expiresAtUtc TEXT NULL, version INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE businessevidenceattestations (attestationId BLOB PRIMARY KEY, packageId BLOB NOT NULL, authoritySlot TEXT NOT NULL, actorId BLOB NOT NULL, authorityReference TEXT NOT NULL, authoritySha256 TEXT NOT NULL, manifestSha256 TEXT NOT NULL, attestedAtUtc TEXT NOT NULL, expiresAtUtc TEXT NULL);
            CREATE TABLE dataqualitydispositions (dispositionId BLOB PRIMARY KEY, issueType TEXT NOT NULL, sourceEntityId BLOB NOT NULL, sourceFingerprint TEXT NOT NULL, proposedAction TEXT NOT NULL, evidenceJson TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, reviewReason TEXT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, reviewedBy BLOB NULL, reviewedAt TEXT NULL, appliedBy BLOB NULL, appliedAt TEXT NULL, correctionEntityType TEXT NULL, correctionEntityId BLOB NULL, version INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE lifecycletransitions (transitionId BLOB PRIMARY KEY, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, commandId TEXT NOT NULL, aggregateSequence INTEGER NOT NULL, fromState TEXT NULL, toState TEXT NOT NULL, actorId BLOB NULL, expectedVersion INTEGER NOT NULL, reason TEXT NULL, correlationId TEXT NULL, causationId TEXT NULL, payloadJson TEXT NOT NULL, schemaVersion INTEGER NOT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE lifecyclecommandreceipts (commandReceiptId BLOB PRIMARY KEY, commandId TEXT NOT NULL, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, responseJson TEXT NOT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE lifecycleoutboxmessages (outboxMessageId BLOB PRIMARY KEY, eventType TEXT NOT NULL, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, aggregateSequence INTEGER NOT NULL, commandId TEXT NOT NULL, payloadJson TEXT NOT NULL, status TEXT NOT NULL, attemptCount INTEGER NOT NULL DEFAULT 0, nextAttemptAt TEXT NULL, lockedAt TEXT NULL, processedAt TEXT NULL, lastError TEXT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE auditlogs (auditId BLOB PRIMARY KEY, businessArea TEXT NOT NULL, changedAt TEXT NOT NULL, changedBy BLOB NOT NULL, entityName TEXT NOT NULL, entityId BLOB NOT NULL, fieldName TEXT NOT NULL, newValue TEXT NULL, oldValue TEXT NULL, reason TEXT NULL, correlationId TEXT NULL);
            """;
        await command.Connection!.OpenAsync();
        await command.ExecuteNonQueryAsync();
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
