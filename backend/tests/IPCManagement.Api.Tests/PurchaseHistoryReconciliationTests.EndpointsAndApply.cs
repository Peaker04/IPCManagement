using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySqlConnector;
using NSubstitute;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api.Tests;

public partial class PurchaseHistoryReconciliationTests
{
    [Fact]
    public async Task PreviewEndpoint_allows_manager_and_uses_server_identity()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        service.PreviewAsync(Arg.Any<CancellationToken>()).Returns(new PurchaseHistoryPreviewDto
        {
            Manifest = new PurchaseHistoryManifestDto
            {
                ManifestId = "manifest-1",
                ManifestHash = new string('C', 64)
            }
        });
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequest());

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<PurchaseHistoryPreviewDto>>();
        payload!.Data!.PreviewedBy.Should().Be("preview-test-user");
        payload.Data.Manifest.ManifestId.Should().Be("manifest-1");
        await service.Received(1).PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Chef", HttpStatusCode.Forbidden)]
    public async Task PreviewEndpoint_rejects_unauthorized_callers_before_source_access(
        string? role,
        HttpStatusCode expectedStatus)
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, role);
        }

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequest());

        response.StatusCode.Should().Be(expectedStatus);
        await service.DidNotReceive().PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PreviewEndpoint_is_hidden_in_production_before_source_access()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Production");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/preview",
            new PurchaseHistoryPreviewRequest());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        await service.DidNotReceive().PreviewAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyEndpoint_allows_manager_uses_server_actor_and_replays_prior_audit()
    {
        var actorId = Guid.Parse("11111111-2222-3333-4444-555555555555");
        var request = EndpointApplyRequest();
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        service.ApplyAsync(
                Arg.Any<PurchaseHistoryApplyRequest>(),
                Arg.Any<byte[]>(),
                Arg.Any<CancellationToken>())
            .Returns(
                new PurchaseHistoryApplyResultDto
                {
                    ManifestId = request.ManifestId,
                    RunId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    AuditReference = "purchase-history-reconciliation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    Applied = true,
                    AppliedActionCount = 1
                },
                new PurchaseHistoryApplyResultDto
                {
                    ManifestId = request.ManifestId,
                    RunId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    AuditReference = "purchase-history-reconciliation/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                    NoOp = true,
                    AppliedActionCount = 1
                });
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.UserHeader, actorId.ToString());

        var first = await client.PostAsJsonAsync("/api/sample-data/purchase-history/apply", request);
        var replay = await client.PostAsJsonAsync("/api/sample-data/purchase-history/apply", request);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        replay.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstPayload = await first.Content.ReadFromJsonAsync<ApiResponse<PurchaseHistoryApplyResultDto>>();
        var replayPayload = await replay.Content.ReadFromJsonAsync<ApiResponse<PurchaseHistoryApplyResultDto>>();
        firstPayload!.Data.Should().Match<PurchaseHistoryApplyResultDto>(result =>
            result.Applied && !result.NoOp && result.RunId == replayPayload!.Data!.RunId);
        replayPayload!.Data.Should().Match<PurchaseHistoryApplyResultDto>(result =>
            !result.Applied && result.NoOp && result.AuditReference == firstPayload.Data!.AuditReference);
        firstPayload.Data!.AuditReference.Should().NotContain("\\").And.NotContain(":\\");
        await service.Received(2).ApplyAsync(
            Arg.Is<PurchaseHistoryApplyRequest>(accepted =>
                accepted.ManifestId == request.ManifestId &&
                accepted.ManifestHash == request.ManifestHash &&
                accepted.AcceptedActionIds.SequenceEqual(request.AcceptedActionIds)),
            Arg.Is<byte[]>(actor => actor.SequenceEqual(actorId.ToByteArray())),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyEndpoint_returns_conflict_when_manifest_changed()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        service.ApplyAsync(
                Arg.Any<PurchaseHistoryApplyRequest>(),
                Arg.Any<byte[]>(),
                Arg.Any<CancellationToken>())
            .Returns<Task<PurchaseHistoryApplyResultDto>>(_ => throw new BusinessRuleException("Manifest drifted."));
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.UserHeader, Guid.NewGuid().ToString());

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/apply",
            EndpointApplyRequest());

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var payload = await response.Content.ReadFromJsonAsync<ApiResponse>();
        payload!.Success.Should().BeFalse();
        payload.Message.Should().Be("Manifest drifted.");
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Chef", HttpStatusCode.Forbidden)]
    public async Task ApplyEndpoint_rejects_unauthorized_callers_before_apply(
        string? role,
        HttpStatusCode expectedStatus)
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Development");
        using var client = app.GetTestClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, role);
        }

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/apply",
            EndpointApplyRequest());

        response.StatusCode.Should().Be(expectedStatus);
        await service.DidNotReceive().ApplyAsync(
            Arg.Any<PurchaseHistoryApplyRequest>(),
            Arg.Any<byte[]>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyEndpoint_is_hidden_in_production_before_apply()
    {
        var service = Substitute.For<IPurchaseHistoryReconciliationService>();
        await using var app = await CreatePreviewEndpointAppAsync(service, "Production");
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(PreviewTestAuthHandler.RoleHeader, "Manager");

        var response = await client.PostAsJsonAsync(
            "/api/sample-data/purchase-history/apply",
            EndpointApplyRequest());

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        await service.DidNotReceive().ApplyAsync(
            Arg.Any<PurchaseHistoryApplyRequest>(),
            Arg.Any<byte[]>(),
            Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("manifest-id")]
    [InlineData("manifest-hash")]
    [InlineData("action-subset")]
    [InlineData("action-superset")]
    [InlineData("backup-identifier")]
    [InlineData("target-fingerprint")]
    [InlineData("restore-fingerprint")]
    [InlineData("restore-not-verified")]
    public async Task ApplyGuard_rejects_request_drift_before_any_write(string drift)
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var service = CreateApplyService(
            context,
            databaseIdentity: "ipc_lane1",
            Candidate("1.Rau", 50, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));
        var preview = await service.PreviewAsync();
        var request = AcceptedApplyRequest(preview);
        switch (drift)
        {
            case "manifest-id":
                request.ManifestId = "stale-manifest";
                break;
            case "manifest-hash":
                request.ManifestHash = new string('D', 64);
                break;
            case "action-subset":
                request.AcceptedActionIds.RemoveAt(0);
                break;
            case "action-superset":
                request.AcceptedActionIds.Add("unexpected-action");
                break;
            case "backup-identifier":
                request.BackupRestoreEvidence!.BackupIdentifier = "another-backup";
                break;
            case "target-fingerprint":
                request.BackupRestoreEvidence!.TargetFingerprint = new string('D', 64);
                break;
            case "restore-fingerprint":
                request.BackupRestoreEvidence!.RestoreFingerprint = new string('D', 64);
                break;
            case "restore-not-verified":
                request.BackupRestoreEvidence!.RestoreVerified = false;
                break;
        }
        var before = await ApplyDatabaseCountsAsync(context);

        var act = () => service.ValidateAcceptedManifestAsync(request, Id(41), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
        (await ApplyDatabaseCountsAsync(context)).Should().Be(before);
    }

    [Theory]
    [InlineData("source")]
    [InlineData("policy")]
    [InlineData("as-of")]
    [InlineData("database")]
    [InlineData("actions")]
    public async Task ApplyGuard_rebuilds_preview_and_rejects_freshness_drift(string drift)
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var baselineCandidate = Candidate(
            "1.Rau",
            60,
            "Rau",
            "Rau muống",
            "KG",
            new DateOnly(2026, 7, 20),
            10,
            25_000);
        var baselineService = CreateApplyService(context, "ipc_lane1", baselineCandidate);
        var request = AcceptedApplyRequest(await baselineService.PreviewAsync());
        var driftedService = CreateApplyService(
            context,
            drift == "database" ? "ipc_lane2" : "ipc_lane1",
            drift == "source" ? new string('D', 64) : new string('A', 64),
            drift == "as-of" ? new DateOnly(2026, 7, 21) : new DateOnly(2026, 7, 20),
            drift == "policy" ? "purchase-history-normalization/test-drift" : PurchaseHistoryPolicyVersion.Current,
            drift == "actions"
                ?
                [
                    baselineCandidate,
                    Candidate("1.Rau", 61, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 21), 12, 27_000)
                ]
                : [baselineCandidate]);
        var before = await ApplyDatabaseCountsAsync(context);

        var act = () => driftedService.ValidateAcceptedManifestAsync(request, Id(41), CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
        (await ApplyDatabaseCountsAsync(context)).Should().Be(before);
    }

    [Theory]
    [InlineData("ipcmanagement", false, false)]
    [InlineData("ipc_e2e_template", false, false)]
    [InlineData("ipc_lane1", true, false)]
    [InlineData("ipc_lane1", false, true)]
    public async Task ApplyGuard_rejects_unsafe_target_blockers_and_missing_server_actor(
        string databaseIdentity,
        bool includeBlocker,
        bool omitActor)
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var candidate = Candidate(
            "1.Rau",
            70,
            includeBlocker ? "Không tồn tại" : "Rau",
            "Rau muống",
            "KG",
            new DateOnly(2026, 7, 20),
            10,
            25_000);
        var service = CreateApplyService(context, databaseIdentity, candidate);
        var request = AcceptedApplyRequest(await service.PreviewAsync());
        var before = await ApplyDatabaseCountsAsync(context);

        var act = () => service.ValidateAcceptedManifestAsync(
            request,
            omitActor ? [] : Id(41),
            CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>();
        (await ApplyDatabaseCountsAsync(context)).Should().Be(before);
    }

    [Fact]
    public async Task ApplyGuard_accepts_only_the_exact_server_rebuilt_preview()
    {
        await using var context = CreateContext();
        await SeedCatalogAsync(context);
        var service = CreateApplyService(
            context,
            "ipc_lane1",
            Candidate("1.Rau", 80, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));
        var preview = await service.PreviewAsync();
        var request = AcceptedApplyRequest(preview);
        var before = await ApplyDatabaseCountsAsync(context);

        var accepted = await service.ValidateAcceptedManifestAsync(request, Id(41), CancellationToken.None);

        accepted.Preview.Manifest.ManifestHash.Should().Be(preview.Manifest.ManifestHash);
        accepted.DatabaseIdentity.Should().Be("ipc_lane1");
        accepted.AppliedBy.Should().Equal(Id(41));
        accepted.Actions.Select(action => action.ActionId).Should().Equal(request.AcceptedActionIds);
        (await ApplyDatabaseCountsAsync(context)).Should().Be(before);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Apply_rolls_back_all_business_and_audit_rows_at_each_action_boundary(int failureIndex)
    {
        await using var fixture = await ApplyFixture.CreateAsync();
        var service = CreateApplyServiceWithFailure(
            fixture.Context,
            failureIndex,
            Candidate("1.Rau", 90, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000),
            Candidate("1.Rau", 91, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 21), 11, 26_000),
            Candidate("1.Rau", 92, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 22), 12, 27_000));
        var request = AcceptedApplyRequest(await service.PreviewAsync());
        var before = await ApplyDatabaseCountsAsync(fixture.Context);

        var act = () => service.ApplyAsync(request, Id(41), CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
        fixture.Context.ChangeTracker.Clear();
        (await ApplyDatabaseCountsAsync(fixture.Context)).Should().Be(before);
    }

    [Fact]
    public async Task Apply_preserves_immutable_history_and_second_apply_and_post_preview_are_no_op()
    {
        await using var fixture = await ApplyFixture.CreateAsync();
        var immutable = await SeedReceiptAsync(
            fixture.Context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            Id(30),
            Id(20),
            Id(10),
            8,
            22_000,
            "SAMPLE-LINKED",
            purchaseRequestId: Id(92));
        fixture.Context.ChangeTracker.Clear();
        var original = await ReceiptLineSnapshotAsync(fixture.Context, immutable.ReceiptLineId);
        var service = CreateApplyService(
            fixture.Context,
            "ipc_lane1",
            Candidate("1.Rau", 100, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));
        var preview = await service.PreviewAsync();
        var request = AcceptedApplyRequest(preview);

        var first = await service.ApplyAsync(request, Id(41), CancellationToken.None);
        fixture.Context.ChangeTracker.Clear();
        var afterFirst = await ApplyDatabaseCountsAsync(fixture.Context);
        var replay = await service.ApplyAsync(request, Id(41), CancellationToken.None);
        fixture.Context.ChangeTracker.Clear();
        var postPreview = await service.PreviewAsync();

        first.Applied.Should().BeTrue();
        first.NoOp.Should().BeFalse();
        replay.Applied.Should().BeFalse();
        replay.NoOp.Should().BeTrue();
        replay.AppliedActionCount.Should().Be(first.AppliedActionCount);
        (await ApplyDatabaseCountsAsync(fixture.Context)).Should().Be(afterFirst);
        (await ReceiptLineSnapshotAsync(fixture.Context, immutable.ReceiptLineId)).Should().Be(original);
        (await fixture.Context.Inventoryreceiptlines.CountAsync()).Should().Be(2);
        (await fixture.Context.Purchasehistoryreconciliationruns.CountAsync()).Should().Be(1);
        var audits = await fixture.Context.Purchasehistoryreconciliationactions.AsNoTracking().ToListAsync();
        audits.Should().ContainSingle();
        audits[0].BeforeHash.Should().Be(preview.Actions.Single().BeforeHash);
        audits[0].AfterHash.Should().Be(preview.Actions.Single().AfterHash);
        postPreview.Actions.Should().BeEmpty();
        postPreview.Blockers.Should().BeEmpty();
    }

    [Fact]
    public async Task Apply_deletes_only_proven_orphans_and_audits_referenced_duplicate_deactivation()
    {
        await using var fixture = await ApplyFixture.CreateAsync();
        await SeedReceiptAsync(
            fixture.Context,
            "RCP-SAMPLE-20260720-RAU",
            new DateOnly(2026, 7, 20),
            Id(30), Id(20), Id(10), 10, 25_000, "SAMPLE-CANONICAL");
        var referencedDuplicate = await SeedReceiptAsync(
            fixture.Context,
            "RCP-SAMPLE-20260720-RAU-2",
            new DateOnly(2026, 7, 20),
            Id(30), Id(20), Id(10), 10, 25_000, "SAMPLE-REFERENCED", Id(93));
        var orphan = await SeedReceiptAsync(
            fixture.Context,
            "RCP-SAMPLE-20260719-RAU",
            new DateOnly(2026, 7, 19),
            Id(30), Id(20), Id(10), 4, 20_000, "SAMPLE-ORPHAN");
        fixture.Context.ChangeTracker.Clear();
        var service = CreateApplyService(
            fixture.Context,
            "ipc_lane1",
            Candidate("1.Rau", 110, "Rau", "Rau muống", "KG", new DateOnly(2026, 7, 20), 10, 25_000));
        var preview = await service.PreviewAsync();
        var request = AcceptedApplyRequest(preview);

        await service.ApplyAsync(request, Id(41), CancellationToken.None);
        fixture.Context.ChangeTracker.Clear();
        var postPreview = await service.PreviewAsync();

        (await fixture.Context.Inventoryreceiptlines.FindAsync(orphan.ReceiptLineId)).Should().BeNull();
        (await fixture.Context.Inventoryreceiptlines.FindAsync(referencedDuplicate.ReceiptLineId)).Should().NotBeNull();
        (await fixture.Context.Purchasehistoryreconciliationactions.AsNoTracking()
            .CountAsync(action => action.ActionType == "delete")).Should().Be(1);
        (await fixture.Context.Purchasehistoryreconciliationactions.AsNoTracking()
            .CountAsync(action => action.ActionType == "deactivate")).Should().Be(1);
        postPreview.Actions.Should().BeEmpty();
    }

}
