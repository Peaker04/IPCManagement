using System.Data.Common;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore.Diagnostics;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Workflows.OperationalApprovals;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class OperationalMrxBatchReviewTests
{
    [Fact]
    public async Task Ordinary_active_batch_is_not_a_decision_and_stale_detail_is_rejected()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var hub = Hub(fixture.Db);
        var page = await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" });
        Assert.Empty(page.Items);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => hub.GetDetailAsync(fixture.Manager,
            "mrx-batch-review", GuidHelper.ToGuidString(fixture.BatchId)));
        Assert.Equal("IN_PROGRESS", (await fixture.Db.Reconciliationbatches.SingleAsync()).Status);
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("Admin")]
    public async Task Batch_review_queues_only_completion_ready_batches_and_opens_owner_without_generic_approval(string role)
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var db = fixture.Db;
        var actorId = fixture.ManagerId;
        var actor = Actor(actorId, role);
        var active = await db.Reconciliationbatches.SingleAsync();
        await IssueBaselineAsync(fixture);
        AddBatch(db, actorId, "DAV", "TRANSFERRED");
        var completed = AddBatch(db, actorId, "WL", "COMPLETED");
        await db.SaveChangesAsync();
        var hub = Hub(db);
        var page = await hub.GetPageAsync(actor, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" });
        var row = Assert.Single(page.Items);
        Assert.Equal(GuidHelper.ToGuidString(active.BatchId), row.TargetId);
        Assert.Equal($"/reconciliation?batchId={row.TargetId}", row.Route);
        Assert.Equal("COMPLETION_READY", row.Status);
        Assert.Equal(new DateOnly(2026, 11, 30), row.WeekStartDate);
        var detail = await hub.GetDetailAsync(actor, row.TargetType, row.TargetId);
        Assert.Empty(detail.AllowedActions);
        Assert.Contains(detail.BlockedReasons, reason => reason.Contains("đối soát"));
        await Assert.ThrowsAsync<BusinessRuleException>(() => hub.DecideAsync(actor, row.TargetType, row.TargetId,
            new OperationalApprovalActionRequest { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1,
                ExpectedFingerprint = detail.Fingerprint, Reason = "Đã kiểm tra" }));
        Assert.Equal("IN_PROGRESS", active.Status);
        Assert.Empty(db.Lifecyclecommandreceipts);
        var archive = await hub.GetPageAsync(actor, new ApprovalInboxQueryDto { TargetType = row.TargetType, State = "PROCESSED" });
        Assert.Equal(GuidHelper.ToGuidString(completed.BatchId), Assert.Single(archive.Items).TargetId);
    }

    [Theory]
    [InlineData("Thủ kho")]
    [InlineData("Bếp trưởng")]
    [InlineData("Điều phối")]
    public async Task Batch_review_denies_operating_roles(string role)
    {
        await using var db = Context();
        var id = GuidHelper.NewId();
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "MATERIAL_RECONCILIATION", Version = 1, UpdatedBy = id });
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => Hub(db).GetPageAsync(Actor(id, role),
            new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" }));
    }

    [Fact]
    public async Task Mrx_day_filter_keeps_multi_day_source_requests_and_batches_for_the_selected_customer()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var db = fixture.Db;
        var batch = await db.Reconciliationbatches.SingleAsync();
        await IssueBaselineAsync(fixture);
        var menu = await db.Menuversions.SingleAsync();
        var customer = await db.Customers.SingleAsync();
        var amendment = new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = customer.CustomerId,
            BaseMenuVersionId = menu.MenuVersionId, WeekStartDate = menu.WeekStartDate, Status = "PENDING_REVIEW",
            Reason = "Đổi món hai ngày", CreatedBy = fixture.ManagerId, CreatedAt = new DateTime(2026, 11, 16),
            ImpactSnapshotJson = System.Text.Json.JsonSerializer.Serialize(new IPCManagement.Api.Features.SampleData.Contracts.MenuAmendmentResultDto {
                AffectedReconciliationBatchIds = [GuidHelper.ToGuidString(batch.BatchId)],
                ImpactLines = [new() { ServiceDate = new DateOnly(2026, 12, 1) }, new() { ServiceDate = new DateOnly(2026, 12, 2) }]
            }) };
        db.Menuamendments.Add(amendment); await db.SaveChangesAsync();
        var hub = Hub(db);
        var page = await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { Date = "2026-12-01", CustomerCode = "anv" });
        Assert.Contains(page.Items, row => row.TargetType == "mrx-source-change" && row.TargetId == GuidHelper.ToGuidString(amendment.MenuAmendmentId));
        Assert.Contains(page.Items, row => row.TargetType == "mrx-batch-review" && row.TargetId == GuidHelper.ToGuidString(batch.BatchId));
        Assert.All(page.Items, row => Assert.Equal("ANV", row.CustomerCode));
        var sourceDetail = await hub.GetDetailAsync(fixture.Manager, "mrx-source-change", GuidHelper.ToGuidString(amendment.MenuAmendmentId));
        Assert.Equal(2, sourceDetail.SourceChange!.ImpactLines.Count);
        Assert.Empty((await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { Date = "2026-12-01", CustomerCode = "DAV" })).Items);
        Assert.Empty((await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-source-change", Date = "2026-12-03" })).Items);
    }

    [Fact]
    public async Task Broken_source_evidence_reports_partial_queue_and_keeps_other_mrx_work_visible()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var db = fixture.Db;
        var menu = await db.Menuversions.SingleAsync();
        var batch = await db.Reconciliationbatches.SingleAsync();
        await IssueBaselineAsync(fixture);
        batch.CreatedAt = new DateTime(2030, 1, 1);
        for (var i = 0; i < 100; i++)
            db.Menuamendments.Add(new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = menu.CustomerId,
                BaseMenuVersionId = menu.MenuVersionId, WeekStartDate = menu.WeekStartDate, Status = "PENDING_REVIEW",
                Reason = "Earlier valid evidence", CreatedBy = fixture.ManagerId, CreatedAt = new DateTime(2026, 1, 1).AddSeconds(i),
                ImpactSnapshotJson = System.Text.Json.JsonSerializer.Serialize(new IPCManagement.Api.Features.SampleData.Contracts.MenuAmendmentResultDto {
                    AffectedReconciliationBatchIds = [GuidHelper.ToGuidString(batch.BatchId)] }) });
        var brokenId = GuidHelper.NewId();
        db.Menuamendments.Add(new MenuAmendment { MenuAmendmentId = brokenId, CustomerId = menu.CustomerId,
            BaseMenuVersionId = menu.MenuVersionId, WeekStartDate = menu.WeekStartDate, Status = "PENDING_REVIEW",
            Reason = "Invalid historical snapshot", CreatedBy = fixture.ManagerId, CreatedAt = new DateTime(2027, 1, 1),
            ImpactSnapshotJson = "{invalid-json" });
        await db.SaveChangesAsync();
        var hub = Hub(db);
        var page = await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { Limit = 1 });
        Assert.Contains(page.Items, row => row.TargetType == "mrx-batch-review");
        Assert.Equal("mrx-source-change", Assert.Single(page.UnavailableSources).TargetType);
        await Assert.ThrowsAsync<InvalidOperationException>(() => hub.GetDetailAsync(fixture.Manager, "mrx-source-change",
            GuidHelper.ToGuidString(brokenId)));
    }

    [Fact]
    public async Task Source_request_before_batch_lineage_is_still_mrx_and_available_to_the_hub()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var db = fixture.Db; var menu = await db.Menuversions.SingleAsync();
        var item = new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = menu.CustomerId,
            BaseMenuVersionId = menu.MenuVersionId, WeekStartDate = menu.WeekStartDate, Status = "PENDING_REVIEW",
            Reason = "First source request before batch creation", CreatedBy = fixture.WarehouseId,
            CreatedAt = new DateTime(2026, 11, 16), ImpactSnapshotJson = "{}" };
        db.Menuamendments.Add(item); await db.SaveChangesAsync();
        var hub = Hub(db);
        var page = await hub.GetPageAsync(fixture.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-source-change" });
        Assert.Equal(GuidHelper.ToGuidString(item.MenuAmendmentId), Assert.Single(page.Items).TargetId);
        var detail = await hub.GetDetailAsync(fixture.Manager, "mrx-source-change", GuidHelper.ToGuidString(item.MenuAmendmentId));
        Assert.Contains("APPROVE", detail.AllowedActions);
    }

    [Theory]
    [InlineData("mrx-reject-default")]
    [InlineData("default-review-mrx")]
    [InlineData("default-execute-mrx")]
    public async Task Retained_source_decisions_refuse_documents_from_the_other_mode(string action)
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var db = fixture.Db; var menu = await db.Menuversions.SingleAsync();
        var item = new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = menu.CustomerId,
            BaseMenuVersionId = action == "mrx-reject-default" ? null : menu.MenuVersionId,
            WeekStartDate = menu.WeekStartDate, Status = action == "default-execute-mrx" ? "APPROVED_FOR_EXECUTION" : "PENDING_REVIEW",
            Reason = "Mode boundary probe", CreatedBy = fixture.WarehouseId, ReviewedBy = fixture.WarehouseId,
            ReviewedAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow, ImpactSnapshotJson = "{}" };
        db.Menuamendments.Add(item); await db.SaveChangesAsync();
        var owner = new MenuAmendmentService(db);
        var id = GuidHelper.ToGuidString(item.MenuAmendmentId);
        var actorId = GuidHelper.ToGuidString(fixture.ManagerId);
        var decision = new IPCManagement.Api.Features.SampleData.Contracts.ReviewMenuAmendmentRequest { Approved = false, Reason = "Wrong source family" };
        Func<Task> write = action switch {
            "mrx-reject-default" => () => owner.DecideMrxAsync(id, decision, actorId, ["Manager"]),
            "default-review-mrx" => () => owner.ReviewAsync(id, decision, actorId),
            _ => () => owner.ExecuteAsync(id, actorId)
        };
        await Assert.ThrowsAsync<UnauthorizedAccessException>(write);
        Assert.Empty(db.Auditlogs);
    }

    [Fact]
    public async Task Ready_batch_after_one_hundred_ineligible_batches_is_not_lost()
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f);
        (await f.Db.Reconciliationbatches.SingleAsync()).CreatedAt = new DateTime(2030, 1, 1);
        for (var i = 0; i < 101; i++) AddBatch(f.Db, f.ManagerId, $"EARLY-{i}", "IN_PROGRESS");
        await f.Db.SaveChangesAsync();
        var page = await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review", Limit = 1 });
        Assert.Equal(GuidHelper.ToGuidString(f.BatchId), Assert.Single(page.Items).TargetId);
        Assert.False(page.HasNext);
    }

    [Fact]
    public async Task Legacy_ready_batch_uses_linked_weekly_issues_without_inventing_daily_facts()
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f);
        var issueLine = await f.Db.Inventoryissuelines.SingleAsync();
        issueLine.ReconciliationBatchDailyLineId = null;
        issueLine.ReconciliationServiceDate = null;
        f.Db.Reconciliationbatchcontributors.RemoveRange(f.Db.Reconciliationbatchcontributors);
        f.Db.Reconciliationbatchdailylines.RemoveRange(f.Db.Reconciliationbatchdailylines);
        await f.Db.SaveChangesAsync();
        Assert.Single((await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" })).Items);
    }

    [Fact]
    public async Task A_later_unissued_service_day_prevents_completion_even_when_first_day_is_exact()
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f);
        var line = await f.Db.Reconciliationbatchdailylines.SingleAsync();
        f.Db.Reconciliationbatchdailylines.Add(new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(),
            BatchId = line.BatchId, BatchLineId = line.BatchLineId, IngredientId = line.IngredientId,
            CanonicalUnitId = line.CanonicalUnitId, ServiceDate = line.ServiceDate.AddDays(1), RequiredQuantity = 1m });
        await f.Db.SaveChangesAsync();
        Assert.Empty((await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" })).Items);
    }

    private static async Task IssueBaselineAsync(ReconciliationSupplementalDemandTests.Fixture fixture, decimal quantity = 12m)
    {
        var db = fixture.Db;
        var daily = await db.Reconciliationbatchdailylines.SingleAsync();
        var issue = await db.Inventoryissues.SingleAsync();
        db.Inventoryissuelines.Add(new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId,
            IngredientId = daily.IngredientId, UnitId = daily.CanonicalUnitId,
            ReconciliationBatchLineId = daily.BatchLineId, ReconciliationBatchDailyLineId = daily.DailyLineId,
            ReconciliationServiceDate = daily.ServiceDate, RequestedQty = 12m, IssuedQty = quantity });
        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData(11)]
    [InlineData(13)]
    public async Task Shortage_or_unresolved_overage_is_not_completion_ready(int quantity)
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f, quantity);
        Assert.Empty((await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" })).Items);
    }

    [Fact]
    public async Task Pending_supplemental_demand_removes_previously_ready_batch()
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f);
        Assert.Single((await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-batch-review" })).Items);
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        var page = await Hub(f.Db).GetPageAsync(f.Manager, new ApprovalInboxQueryDto());
        Assert.DoesNotContain(page.Items, row => row.TargetType == "mrx-batch-review");
        Assert.Contains(page.Items, row => row.TargetType == "mrx-supplemental-demand");
        var (batches, dashboard) = Reports(f.Db);
        var batch = await batches.GetAsync(GuidHelper.ToGuidString(f.BatchId));
        Assert.False(batch!.CanComplete);
        Assert.Contains("nhu cầu suất phát sinh đang chờ duyệt", batch.CompletionBlocker);
        var summary = await dashboard.GetOperationalSummaryAsync(new(), ["Admin"]);
        Assert.Equal(0, summary.CompletionReadyBatchesCount);
        Assert.DoesNotContain(summary.Items, row => row.QueueType == "COMPLETION_READY");
    }

    [Fact]
    public async Task Dashboard_keeps_the_next_unissued_day_after_the_first_warehouse_issue()
    {
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        await IssueBaselineAsync(f);
        var first = await f.Db.Reconciliationbatchdailylines.SingleAsync();
        var next = new DateOnly(2026, 12, 1);
        f.Db.Reconciliationbatchdailylines.Add(new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(),
            BatchId = first.BatchId, BatchLineId = first.BatchLineId, IngredientId = first.IngredientId,
            CanonicalUnitId = first.CanonicalUnitId, ServiceDate = next, RequiredQuantity = 12m, Version = 1 });
        await f.Db.SaveChangesAsync();
        var (_, dashboard) = Reports(f.Db);
        var summary = await dashboard.GetOperationalSummaryAsync(new(), ["Admin"]);
        Assert.Equal(1, summary.AwaitingWarehouseBatchesCount);
        var task = Assert.Single(summary.Items, row => row.QueueType == "AWAITING_WAREHOUSE");
        Assert.Equal($"/warehouse?view=mrx-daily&batchId={GuidHelper.ToGuidString(f.BatchId)}&date=2026-12-01", task.TargetUrl);
        Assert.Equal(0, summary.CompletionReadyBatchesCount);
    }

    [Fact]
    public async Task Later_mrx_inbox_page_does_not_reread_earlier_source_chunks()
    {
        var reads = new AmendmentSelectCounter();
        await using var f = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync(reads);
        var menu = await f.Db.Menuversions.SingleAsync();
        var start = new DateTime(2026, 11, 1);
        var amendments = Enumerable.Range(0, 151).Select(index => new MenuAmendment {
            MenuAmendmentId = GuidHelper.NewId(), CustomerId = menu.CustomerId, BaseMenuVersionId = menu.MenuVersionId,
            WeekStartDate = menu.WeekStartDate, Status = "PENDING_REVIEW", Reason = "Đổi món",
            CreatedBy = f.ManagerId, CreatedAt = start.AddMinutes(Math.Min(index, 149)), ImpactSnapshotJson = "{}"
        }).ToList();
        f.Db.Menuamendments.AddRange(amendments);
        await f.Db.SaveChangesAsync();
        var query = new ApprovalInboxQueryDto { TargetType = "mrx-source-change", Limit = 50 };
        var hub = Hub(f.Db);
        for (var index = 0; index < 3; index++)
        {
            var earlier = await hub.GetPageAsync(f.Manager, query);
            Assert.Equal(50, earlier.Items.Count);
            Assert.True(earlier.HasNext);
            query.Cursor = Assert.IsType<string>(earlier.NextCursor);
        }
        reads.Count = 0;
        var last = await hub.GetPageAsync(f.Manager, query);
        var lastId = amendments.Skip(149).Select(item => GuidHelper.ToGuidString(item.MenuAmendmentId))
            .Order(StringComparer.Ordinal).Last();
        Assert.Equal(lastId, Assert.Single(last.Items).TargetId);
        Assert.False(last.HasNext);
        Assert.Equal(1, reads.Count);
    }

    private sealed class AmendmentSelectCounter : DbCommandInterceptor
    {
        public int Count { get; set; }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("menuamendments", StringComparison.OrdinalIgnoreCase)) Count++;
            return ValueTask.FromResult(result);
        }
    }

    private static (ReconciliationBatchService Batches, ReconciliationReportsService Reports) Reports(IpcManagementContext db)
    {
        var request = new SystemOperationRequestContext { Mode = "MATERIAL_RECONCILIATION" };
        var batches = new ReconciliationBatchService(db, new ImmediateTransactionRunner(), request);
        return (batches, new(db, batches, request));
    }

    private static IpcManagementContext Context() => new(new DbContextOptionsBuilder<IpcManagementContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static OperationalApprovalService Hub(IpcManagementContext db) => new(db,
        Substitute.For<IApprovalInboxService>(), Substitute.For<IApprovalWorkflowService>(),
        Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
    private static ClaimsPrincipal Actor(byte[] id, string role) => new(new ClaimsIdentity([
        new Claim(ClaimTypes.NameIdentifier, GuidHelper.ToGuidString(id)), new Claim(ClaimTypes.Role, role)], "test"));
    private static ReconciliationBatch AddBatch(IpcManagementContext db, byte[] actor, string code, string status)
    {
        var customer = new Customer { CustomerId = GuidHelper.NewId(), CustomerCode = code, CustomerName = code, IsActive = true };
        var menu = new MenuVersion { MenuVersionId = GuidHelper.NewId(), Customer = customer, CustomerId = customer.CustomerId,
            WeekStartDate = new DateOnly(2026, 11, 30), Status = "PUBLISHED" };
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = menu.MenuVersionId,
            QuantityImportBatchId = GuidHelper.NewId(), Status = status, Version = 2, CreatedBy = actor, CreatedAt = new DateTime(2026, 11, 16) };
        db.Customers.Add(customer); db.Menuversions.Add(menu); db.Reconciliationbatches.Add(batch);
        return batch;
    }
}
