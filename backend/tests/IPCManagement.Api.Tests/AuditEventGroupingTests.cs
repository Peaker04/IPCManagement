using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    [Trait("MXE", "MXE-08")]
    public async Task Audit_event_mode_should_project_same_time_reconciliation_issues_by_exact_issue_identity()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var occurredAt = new DateTime(2026, 9, 5, 9, 0, 0, DateTimeKind.Utc);
        var first = BuildReconciliationIssue(fixture, "ISS-EVENT-67", 67, occurredAt);
        var second = BuildReconciliationIssue(fixture, "ISS-EVENT-84", 84, occurredAt);
        context.Inventoryissues.AddRange(first, second);
        await context.SaveChangesAsync();
        (await context.Inventoryissues.CountAsync()).Should().Be(2);
        (await context.Inventoryissuelines.CountAsync()).Should().Be(151);
        (await context.Inventoryissues.CountAsync(item => item.MaterialRequestId == null && item.ReconciliationBatchId != null)).Should().Be(2);
        (await context.Inventoryissues.CountAsync(item => item.Inventoryissuelines.Any() && item.Inventoryissuelines.All(line => line.MaterialRequestLineId == null && line.ReconciliationBatchLineId != null))).Should().Be(2);
        (await context.Inventoryissues.CountAsync(item => item.CreatedAt >= new DateTime(2020, 1, 1) && item.CreatedAt < new DateTime(2031, 1, 1))).Should().Be(2);
        (await context.Inventoryissues.Include(item => item.IssuedByNavigation).Select(item => item.IssuedByNavigation.Username).ToListAsync()).Should().HaveCount(2);

        var rows = await new AuditReportService(context).GetAuditChangesAsync(EventQuery(limit: 10));

        rows.Should().HaveCount(2);
        rows.Select(row => row.EventId).Should().BeEquivalentTo([
            GuidHelper.ToGuidString(first.IssueId), GuidHelper.ToGuidString(second.IssueId)
        ]);
        rows.Select(row => row.EventId).Should().OnlyHaveUniqueItems();
        rows.Select(row => row.AuditId).Should().Equal(rows.Select(row => row.EventId));
        rows.Select(row => row.EventLineCount).Should().BeEquivalentTo([67, 84]);
        rows.Should().OnlyContain(row => row.EventType == nameof(InventoryIssue) && row.EventRole == "UNKNOWN");
        rows.Should().OnlyContain(row => row.NewValue == row.EventCode && row.ReconciliationBatchLineId == null);
    }

    [Fact]
    [Trait("MXE", "MXE-08")]
    public async Task Audit_event_cursor_should_not_duplicate_or_omit_same_time_issue_events()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var occurredAt = new DateTime(2026, 9, 5, 9, 15, 0, DateTimeKind.Utc);
        context.Inventoryissues.AddRange(
            BuildReconciliationIssue(fixture, "ISS-EVENT-A", 67, occurredAt),
            BuildReconciliationIssue(fixture, "ISS-EVENT-B", 84, occurredAt));
        await context.SaveChangesAsync();
        var service = new AuditReportService(context);

        var first = await service.GetAuditChangePageAsync(EventQuery(limit: 1));
        var second = await service.GetAuditChangePageAsync(EventQuery(
            limit: 1,
            cursorDate: first.NextCursorDate,
            cursorId: first.NextCursorId,
            cursorOffset: first.NextCursorOffset));
        var ids = first.Items.Concat(second.Items).Select(row => row.EventId).ToList();

        first.Items.Should().ContainSingle();
        second.Items.Should().ContainSingle();
        ids.Should().OnlyHaveUniqueItems();
        ids.Should().NotContainNulls();
        second.HasNext.Should().BeFalse();
    }

    [Fact]
    [Trait("MXE", "MXE-08")]
    public async Task Audit_event_mode_should_leave_legacy_issue_lines_flat_and_default_csv_line_level()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var reconciliation = BuildReconciliationIssue(fixture, "ISS-EVENT-2", 2, DateTime.UtcNow);
        var legacy = BuildLegacyIssue(fixture, "ISS-LEGACY-FLAT", DateTime.UtcNow.AddSeconds(-1));
        context.Inventoryissues.AddRange(reconciliation, legacy);
        await context.SaveChangesAsync();
        var service = new AuditReportService(context);

        var eventRows = await service.GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "Issue",
            DateFrom = "2020-01-01",
            DateTo = "2030-12-31",
            GroupBy = "event",
            Limit = 20
        });
        var csv = Encoding.UTF8.GetString((await service.ExportAuditChangesCsvAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "Issue",
            SourceFamily = "MATERIAL_RECONCILIATION",
            DateFrom = "2020-01-01",
            DateTo = "2030-12-31",
            GroupBy = "event"
        })).Content);

        eventRows.Should().ContainSingle(row => row.EventId == GuidHelper.ToGuidString(reconciliation.IssueId) && row.EventLineCount == 2);
        eventRows.Should().ContainSingle(row => row.SourceFamily == "LEGACY_UNCLASSIFIED" && row.EventId == null && row.AuditId != row.EntityId);
        csv.Should().Contain("ISS-EVENT-2 - 1");
        csv.Split("ISS-EVENT-2 - ").Should().HaveCount(3, "the detailed CSV keeps one row per issue line even when groupBy=event was supplied");
    }

    [Fact]
    [Trait("MXE", "MXE-08")]
    public async Task Audit_default_mode_should_remain_line_level_and_event_summary_should_not_publish_cross_unit_totals()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var issue = BuildReconciliationIssue(fixture, "ISS-MIXED-UNITS", 2, DateTime.UtcNow);
        issue.Inventoryissuelines.ElementAt(0).IssuedQty = 1.25m;
        issue.Inventoryissuelines.ElementAt(1).IssuedQty = 900m;
        context.Inventoryissues.Add(issue);
        await context.SaveChangesAsync();
        var service = new AuditReportService(context);

        var flat = await service.GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "Issue", DateFrom = "2020-01-01", DateTo = "2030-12-31", Limit = 20
        });
        var grouped = await service.GetAuditChangesAsync(EventQuery(limit: 20));

        flat.Should().HaveCount(2);
        flat.Should().OnlyContain(row => row.EventId == null && row.EventLineCount == null);
        grouped.Should().ContainSingle();
        grouped.Single().EventLineCount.Should().Be(2);
        grouped.Single().NewValue.Should().Be("ISS-MIXED-UNITS");
        grouped.Single().NewValue.Should().NotContain("901.25");
    }

    [Fact]
    [Trait("MXE", "MXE-08")]
    public void Audit_privacy_projection_should_preserve_non_sensitive_event_metadata()
    {
        var row = new IPCManagement.Api.Features.Reports.Contracts.AuditChangeReportDto
        {
            AuditId = "audit",
            BusinessArea = "Issue",
            EntityName = nameof(InventoryIssue),
            FieldName = "MORNING",
            EventId = "event-id",
            EventType = nameof(InventoryIssue),
            EventRole = "UNKNOWN",
            EventCode = "ISS-001",
            EventLineCount = 84,
            EventStatus = "CREATED",
            ReconciliationBatchId = "batch-id"
        };

        var projected = AuditPrivacyProjection.Project(row);

        projected.Should().NotBeSameAs(row);
        projected.EventId.Should().Be("event-id");
        projected.EventType.Should().Be(nameof(InventoryIssue));
        projected.EventRole.Should().Be("UNKNOWN");
        projected.EventCode.Should().Be("ISS-001");
        projected.EventLineCount.Should().Be(84);
        projected.EventStatus.Should().Be("CREATED");
        projected.ReconciliationBatchId.Should().Be("batch-id");
    }

    private static WorkflowReportQueryDto EventQuery(
        int limit,
        string? cursorDate = null,
        string? cursorId = null,
        int? cursorOffset = null) => new()
    {
        BusinessArea = "Issue",
        DateFrom = "2020-01-01",
        DateTo = "2030-12-31",
        GroupBy = "event",
        Limit = limit,
        CursorDate = cursorDate,
        CursorId = cursorId,
        CursorOffset = cursorOffset,
        SortDirection = "desc"
    };

    private static InventoryIssue BuildReconciliationIssue(
        WorkflowFixture fixture,
        string code,
        int lineCount,
        DateTime occurredAt)
    {
        var issueId = GuidHelper.NewId();
        var batchId = GuidHelper.NewId();
        return new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = code,
            IssueDate = DateOnly.FromDateTime(occurredAt),
            WarehouseId = fixture.WarehouseId,
            ReconciliationBatchId = batchId,
            IssuedBy = fixture.UserId,
            CreatedAt = occurredAt,
            Inventoryissuelines = Enumerable.Range(1, lineCount).Select(index => new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issueId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                ReconciliationBatchLineId = GuidHelper.NewId(),
                RequestedQty = index,
                IssuedQty = index
            }).ToList()
        };
    }

    private static InventoryIssue BuildLegacyIssue(WorkflowFixture fixture, string code, DateTime occurredAt)
    {
        var issueId = GuidHelper.NewId();
        return new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = code,
            IssueDate = DateOnly.FromDateTime(occurredAt),
            WarehouseId = fixture.WarehouseId,
            IssuedBy = fixture.UserId,
            CreatedAt = occurredAt,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = GuidHelper.NewId(), IssueId = issueId,
                    IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                    RequestedQty = 1, IssuedQty = 1
                }
            ]
        };
    }
}
