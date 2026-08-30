using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Tests.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveApprovalOwnerTests
{
    [Fact]
    public async Task Resume_identical_approval_after_DEFAULT_preserves_multistep_history_and_retry_is_idempotent()
    {
        await using var host = await CustomWebApplicationFactory.CreateApprovalOwnerHostAsync();
        var fixture = await SeedDemandAsync(host, "DRAFT", withTwoStepRule: true);
        await ChangeModeAsync(host, SystemOperationEligibility.MaterialReconciliation, 1, fixture.ActorId);
        using var actorOne = host.CreateClient(fixture.ActorId);
        var rejected = await PostApprovalAsync(actorOne, fixture.RequestId);
        rejected.StatusCode.Should().Be(HttpStatusCode.Conflict);

        await ChangeModeAsync(host, SystemOperationEligibility.Default, 2, fixture.ActorId);
        var firstStep = await PostApprovalAsync(actorOne, fixture.RequestId);
        firstStep.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstPayload = await ReadApprovalPayloadAsync(firstStep);
        firstPayload.Status.Should().Be("PENDING_NEXT_APPROVAL");

        using var actorTwo = host.CreateClient(fixture.SecondActorId!);
        var finalStep = await PostApprovalAsync(actorTwo, fixture.RequestId);
        finalStep.StatusCode.Should().Be(HttpStatusCode.OK);
        var finalPayload = await ReadApprovalPayloadAsync(finalStep);
        finalPayload.Status.Should().Be("APPROVE");
        var terminalLedger = await SnapshotDatabaseAsync(host.Connection);

        var retry = await PostApprovalAsync(actorTwo, fixture.RequestId);
        retry.StatusCode.Should().Be(HttpStatusCode.OK);
        var retryPayload = await ReadApprovalPayloadAsync(retry);
        retryPayload.Should().Be(finalPayload);
        (await SnapshotDatabaseAsync(host.Connection)).Should().Equal(terminalLedger);

        await using var scope = host.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<IpcManagementContext>();
        var requestId = GuidHelper.ParseGuidString(fixture.RequestId)!;
        var request = await context.Materialrequests.AsNoTracking()
            .SingleAsync(item => item.RequestId == requestId);
        request.Status.Should().Be("MANAGERAPPROVED");
        request.ApprovedBy.Should().Equal(GuidHelper.ParseGuidString(fixture.SecondActorId!)!);
        var history = await context.Approvalhistories.AsNoTracking()
            .Where(item => item.TargetType == "material-demand" && item.TargetId == requestId)
            .OrderBy(item => item.ActionAt)
            .ToListAsync();
        history.Select(item => item.Decision).Should().Equal("STEP_APPROVED", "STEP_APPROVED", "APPROVE");
        history.Select(item => GuidHelper.ToGuidString(item.ActionBy)).Should()
            .Equal(fixture.ActorId, fixture.SecondActorId!, fixture.SecondActorId!);
    }

    [Fact]
    public async Task Reject_inactive_material_demand_approval_through_MVC_filter_with_exact_ledger_unchanged()
    {
        await using var host = await CustomWebApplicationFactory.CreateApprovalOwnerHostAsync();
        var fixture = await SeedDemandAsync(host, "DRAFT");
        var inactive = await ChangeModeAsync(
            host,
            SystemOperationEligibility.MaterialReconciliation,
            expectedVersion: 1,
            fixture.ActorId);
        inactive.Version.Should().Be(2);
        var before = await SnapshotDatabaseAsync(host.Connection);

        using var client = host.CreateClient(fixture.ActorId);
        var response = await client.PostAsJsonAsync(
            $"/api/approvals/material-demand/{fixture.RequestId}",
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Nhu cầu hợp lệ" });

        var responseBody = await response.Content.ReadAsStringAsync();
        response.StatusCode.Should().Be(HttpStatusCode.Conflict, responseBody);
        responseBody.Should()
            .Contain("MODE_UNAVAILABLE")
            .And.Contain("Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.");
        var after = await SnapshotDatabaseAsync(host.Connection);
        after.Should().Equal(before);
    }

    private static async Task<DemandFixture> SeedDemandAsync(
        ApprovalOwnerTestHost host,
        string status,
        bool withTwoStepRule = false)
    {
        var actorId = GuidHelper.NewId();
        var secondActorId = withTwoStepRule ? GuidHelper.NewId() : null;
        var requestId = GuidHelper.NewId();
        await using var scope = host.Services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<IpcManagementContext>();
        context.Systemoperationmodes.Add(new SystemOperationMode
        {
            Id = 1,
            Mode = SystemOperationEligibility.Default,
            Version = 1,
            UpdatedBy = actorId,
            UpdatedAt = new DateTime(2026, 8, 30, 0, 0, 0, DateTimeKind.Utc)
        });
        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = requestId,
            RequestCode = $"MR-30-07-{Guid.NewGuid():N}",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 8, 30),
            RequestScope = "FULLDAY",
            Status = status,
            CreatedBy = actorId
        });
        if (withTwoStepRule)
        {
            var ruleId = GuidHelper.NewId();
            context.Approvalrules.Add(new ApprovalRule
            {
                RuleId = ruleId,
                RuleName = "Phase 30 two-step material approval",
                DocumentType = "material-demand",
                IsActive = true,
                CreatedAt = new DateTime(2026, 8, 30, 0, 0, 0, DateTimeKind.Utc)
            });
            context.Approvalassignments.AddRange(
                new ApprovalAssignment
                {
                    AssignmentId = GuidHelper.NewId(), RuleId = ruleId, Sequence = 1,
                    ApproverRole = "Manager", IsRequired = true
                },
                new ApprovalAssignment
                {
                    AssignmentId = GuidHelper.NewId(), RuleId = ruleId, Sequence = 2,
                    ApproverRole = "Manager", IsRequired = true
                });
        }
        await context.SaveChangesAsync();
        return new DemandFixture(
            GuidHelper.ToGuidString(requestId),
            GuidHelper.ToGuidString(actorId),
            secondActorId is null ? null : GuidHelper.ToGuidString(secondActorId));
    }

    private static async Task<SystemOperationModeDto> ChangeModeAsync(
        ApprovalOwnerTestHost host,
        string mode,
        long expectedVersion,
        string actorId)
    {
        await using var scope = host.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<SystemOperationModeService>().ChangeAsync(
            new ChangeSystemOperationModeRequest(
                mode,
                expectedVersion,
                Confirmed: true,
                Reason: "Phase 30 approval owner test"),
            actorId);
    }

    private static Task<HttpResponseMessage> PostApprovalAsync(HttpClient client, string requestId) =>
        client.PostAsJsonAsync(
            $"/api/approvals/material-demand/{requestId}",
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Nhu cầu hợp lệ" });

    private static async Task<ApprovalPayload> ReadApprovalPayloadAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        return new ApprovalPayload(
            data.GetProperty("status").GetString()!,
            data.GetProperty("historyId").GetString()!);
    }

    private static async Task<IReadOnlyList<string>> SnapshotDatabaseAsync(SqliteConnection connection)
    {
        var tables = new List<string>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                tables.Add(reader.GetString(0));
            }
        }

        var ledger = new List<string>();
        foreach (var table in tables)
        {
            var rows = new List<string>();
            await using var command = connection.CreateCommand();
            command.CommandText = $"SELECT * FROM \"{table.Replace("\"", "\"\"")}\"";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var values = Enumerable.Range(0, reader.FieldCount)
                    .Select(index => $"{reader.GetName(index)}={FormatLedgerValue(reader.GetValue(index))}");
                rows.Add(string.Join("|", values));
            }
            rows.Sort(StringComparer.Ordinal);
            ledger.AddRange(rows.Select(row => $"{table}:{row}"));
        }
        return ledger;
    }

    private static string FormatLedgerValue(object value) => value switch
    {
        DBNull => "<null>",
        byte[] bytes => Convert.ToHexString(bytes),
        _ => Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty
    };

    private sealed record DemandFixture(string RequestId, string ActorId, string? SecondActorId);
    private sealed record ApprovalPayload(string Status, string HistoryId);
}
