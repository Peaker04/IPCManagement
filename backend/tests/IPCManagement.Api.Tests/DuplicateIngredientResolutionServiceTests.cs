using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.DatabaseTool;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Infrastructure.Lifecycle;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class DuplicateIngredientResolutionServiceTests
{
    private static readonly DateTime Now = new(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void KeepDistinct_IsTerminalOnlyWithStableMembersAndOwnerEvidence()
    {
        var request = Request("KEEP_DISTINCT");
        DuplicateIngredientResolutionService.ValidatePlan(request, Now).Should().Be("KEEP_DISTINCT");
        FluentActions.Invoking(() => DuplicateIngredientResolutionService.ValidatePlan(
            request with { MemberIds = [request.MemberIds[0], request.MemberIds[0]] }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*stable member*");
    }

    [Fact]
    public void MergePlan_RequiresAllFifteenConsumersAndForwardRollbackClosure()
    {
        var request = Request("MERGE_PLAN");
        DuplicateIngredientResolutionService.ValidatePlan(request, Now).Should().Be("MERGE_PLAN");
        FluentActions.Invoking(() => DuplicateIngredientResolutionService.ValidatePlan(
            request with { ConsumerSurfaces = request.ConsumerSurfaces.Skip(1).ToArray() }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*15 consumer*");
        FluentActions.Invoking(() => DuplicateIngredientResolutionService.ValidatePlan(
            request with { RollbackMapSha256 = "reference-count-winner" }, Now))
            .Should().Throw<InvalidOperationException>().WithMessage("*rollback digest*");
    }

    [Fact]
    public void Workflow_RechecksMapBeforeApply_AndReplaysCommand()
    {
        var service = new DuplicateIngredientResolutionService();
        var request = Request("MERGE_PLAN");
        var preview = service.Preview(request, Context("preview", 0, "catalog-a", "Catalog"));
        var reviewed = service.Review(preview.ResolutionId, Context("review", 0, "manager-b", "Manager"));
        var applied = service.Apply(reviewed.ResolutionId, request, Context("apply", 1, "admin-c", "Admin"), Now);
        service.Apply(reviewed.ResolutionId, request, Context("apply", 1, "admin-c", "Admin"), Now).Should().Be(applied);
        applied.AuditCount.Should().Be(3);
    }

    [Fact]
    public void AggregateOracle_FailsClosedForStaleExpiredOrIncompleteCatalogEvidence()
    {
        var good = new CatalogEvidenceClosureRow("id", new string('A', 64), new string('A', 64),
            "KEEP_DISTINCT", true, Now.AddDays(1), true, true, true);
        BusinessEvidenceClosureCommand.ValidateCatalogRows("duplicate", [good], Now).Should().BeEmpty();
        BusinessEvidenceClosureCommand.ValidateCatalogRows("duplicate", [good with { CurrentFingerprint = new string('B', 64) }], Now)
            .Should().ContainSingle(message => message.Contains("stale"));
        BusinessEvidenceClosureCommand.ValidateCatalogRows("duplicate", [good with { ExpiresAtUtc = Now.AddDays(-1) }], Now)
            .Should().ContainSingle(message => message.Contains("expired"));
        BusinessEvidenceClosureCommand.ValidateCatalogRows("duplicate", [good with { HasCompleteReferenceMap = false }], Now)
            .Should().ContainSingle(message => message.Contains("reference map"));
    }

    [Fact]
    public async Task DurableDuplicateWorkflow_ReplaysAfterReconstruction_AndPersistsAllAuditSurfaces()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using (var setup = new IpcManagementContext(options)) await DurableEvidenceTestSchema.CreateAsync(setup);
        var request = Request("MERGE_PLAN");
        await using var context = new IpcManagementContext(options);
        var service = new DuplicateIngredientResolutionService(context, new EfTransactionRunner(context), new LifecycleTransitionRecorder(context));
        var preview = service.Preview(request, Context("duplicate-preview", 0, Guid.NewGuid().ToString(), "Catalog"));
        var reviewed = service.Review(preview.ResolutionId, Context("duplicate-review", 0, Guid.NewGuid().ToString(), "Manager"));
        var applied = service.Apply(reviewed.ResolutionId, request, Context("duplicate-apply", 1, Guid.NewGuid().ToString(), "Admin"), Now);
        applied.Status.Should().Be("APPLIED");
        (await context.Dataqualitydispositions.SingleAsync()).CorrectionEntityId.Should().NotBeNull();
        (await context.Lifecycletransitions.CountAsync()).Should().Be(3);
        (await context.Lifecycleoutboxmessages.CountAsync()).Should().Be(3);
        service.Review(preview.ResolutionId, Context("duplicate-review", 0, Guid.NewGuid().ToString(), "Manager")).Should().Be(reviewed);
    }

    private static DuplicateIngredientResolutionRequest Request(string decision)
    {
        var group = Guid.NewGuid().ToString();
        var members = new[] { Guid.NewGuid().ToString(), Guid.NewGuid().ToString() };
        var manifest = Encoding.UTF8.GetBytes("{\"identity\":\"stable-ids-only\"}");
        var digest = Convert.ToHexString(SHA256.HashData(manifest));
        var evidence = new EvidencePackageInput(Guid.NewGuid().ToString(), "DUPLICATE_INGREDIENT", group,
            new string('E', 64), manifest, digest, decision, null, Now.AddDays(-1), null,
            ["FULL_REFERENCE_MAP", "ROLLBACK_PLAN"],
            [new EvidenceAttestationInput("CATALOG_SOURCE_OWNER", "owner-c", digest, Now.AddDays(-1), null)]);
        return new DuplicateIngredientResolutionRequest(group, members, new string('E', 64), evidence,
            decision == "MERGE_PLAN" ? members[0] : null,
            DuplicateIngredientResolutionService.RequiredConsumerSurfaces,
            members.ToDictionary(id => id, _ => Guid.NewGuid().ToString()),
            new string('F', 64), new string('1', 64), true, true);
    }

    private static ResolutionCommandContext Context(string command, long version, string actor, string role)
        => new(command, version, actor, role, Now);
}
