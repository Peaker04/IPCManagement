using System.Net;
using System.Net.Http.Json;
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

    private static async Task<DemandFixture> SeedDemandAsync(ApprovalOwnerTestHost host, string status)
    {
        var actorId = GuidHelper.NewId();
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
        await context.SaveChangesAsync();
        return new DemandFixture(
            GuidHelper.ToGuidString(requestId),
            GuidHelper.ToGuidString(actorId));
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

    private sealed record DemandFixture(string RequestId, string ActorId);
}
