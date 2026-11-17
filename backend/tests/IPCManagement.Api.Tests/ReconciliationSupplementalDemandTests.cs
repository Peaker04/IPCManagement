using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Workflows.OperationalApprovals;
using System.Security.Claims;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSupplementalDemandTests
{
    [Fact]
    public async Task Preparation_and_variance_register_keep_shortage_when_net_matches_demand()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        await f.Service.ApproveAsync(draft.DemandId, f.Command(2), f.Manager);
        var daily = await f.Db.Reconciliationbatchdailylines.SingleAsync();
        var issue = await f.Db.Inventoryissues.SingleAsync();
        foreach (var (quantity, purpose) in new[] { (12m, "BASELINE_SHORTAGE"), (2m, "UNPLANNED_EXTRA") })
        {
            var lineId = GuidHelper.NewId();
            f.Db.Inventoryissuelines.Add(new InventoryIssueLine { IssueLineId = lineId, IssueId = issue.IssueId,
                IngredientId = daily.IngredientId, UnitId = daily.CanonicalUnitId, ReconciliationBatchLineId = daily.BatchLineId,
                ReconciliationBatchDailyLineId = daily.DailyLineId, ReconciliationServiceDate = daily.ServiceDate,
                IssuedQty = quantity, RequestedQty = quantity });
            f.Db.Reconciliationissueallocations.Add(new ReconciliationIssueAllocation { AllocationId = GuidHelper.NewId(),
                IssueLineId = lineId, DailyLineId = daily.DailyLineId, Purpose = purpose, Quantity = quantity });
        }
        await f.Db.SaveChangesAsync();
        var scope = new SystemOperationRequestContext { Mode = "MATERIAL_RECONCILIATION", ExpectedModeVersion = 1 };
        var runner = new EfTransactionRunner(f.Db);
        var preparation = new ReconciliationPreparationService(f.Db, runner, Substitute.For<IOperationalWarehouseResolver>(), scope);
        var allocation = Assert.Single(Assert.Single((await preparation.GetPreparationAsync(daily.ServiceDate)).AggregatedLines).Allocations);
        Assert.Equal(14m, allocation.RequiredQuantity);
        Assert.Equal(14m, allocation.IssuedQuantity);
        Assert.Equal(2m, allocation.RemainingQuantity);
        Assert.Equal("PURPOSE_SHORTAGE", allocation.Status);
        var batchService = new ReconciliationBatchService(f.Db, runner, scope);
        var report = new ReconciliationReportsService(f.Db, batchService, scope);
        var variance = Assert.Single((await report.GetVarianceRegisterAsync(GuidHelper.ToGuidString(f.BatchId), daily.ServiceDate)).Rows);
        Assert.Equal(0m, variance.Difference);
        Assert.Equal("PURPOSE_SHORTAGE", variance.VarianceType);
        Assert.Equal(2m, variance.RemainingByPurpose);
        Assert.Equal(2m, variance.UnplannedIssuedQuantity);

        var exporter = new ReconciliationPreparationWorkbookExporter(f.Db, scope);
        var workbook = await exporter.GetWorkbookAsync(new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = daily.ServiceDate, BatchIds = [GuidHelper.ToGuidString(f.BatchId)]
        });
        var material = Assert.Single(workbook.SummaryRows);
        Assert.Equal(14m, material.TotalQuantity);
        Assert.Equal(2m, material.RemainingQuantity);
        Assert.Equal(2m, material.UnplannedIssuedQuantity);
    }

    [Fact]
    public async Task Admin_direct_confirmation_skips_pending_but_records_admin_and_replays_exactly_once()
    {
        await using var f = await Fixture.CreateAsync();
        var admin = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, GuidHelper.ToGuidString(f.ManagerId)),
            new Claim(ClaimTypes.Role, "Admin")], "test"));
        var originalLine = await f.Db.Reconciliationbatchdailylines.AsNoTracking().SingleAsync();
        var options = await f.Service.GetDishOptionsAsync(GuidHelper.ToGuidString(f.BatchId), f.Request().ServiceDate, admin);
        Assert.False(options.RequiresApproval);
        Assert.True((await f.Service.GetDishOptionsAsync(GuidHelper.ToGuidString(f.BatchId), f.Request().ServiceDate, f.Warehouse)).RequiresApproval);
        var draft = await f.Service.CreateAsync(f.Request(), admin);
        Assert.Equal("DRAFT", draft.Status);
        var command = f.Command(draft.Version);
        var confirmed = await f.Service.SubmitAsync(draft.DemandId, command, admin);
        Assert.Equal("APPROVED", confirmed.Status);
        Assert.Equal(GuidHelper.ToGuidString(f.ManagerId), confirmed.DecidedBy);
        Assert.Equal(3, confirmed.BatchVersion);
        Assert.NotNull(confirmed.DecidedAt);
        var decision = await f.Db.Approvalhistories.SingleAsync();
        Assert.Equal("ADMIN_DIRECT", decision.Decision);
        Assert.Equal(f.ManagerId, decision.ActionBy);
        var audit = await f.Db.Auditlogs.SingleAsync(x => x.NewValue == "APPROVED" && x.FieldName == "Status"
            && x.BusinessArea == "MATERIAL_RECONCILIATION" && x.EntityName == nameof(ReconciliationSupplementalDemand)
            && x.CorrelationId == command.CommandId);
        Assert.Equal(f.ManagerId, audit.ChangedBy);
        Assert.Equal(command.Reason, audit.Reason);
        var hub = new OperationalApprovalService(f.Db, Substitute.For<IApprovalInboxService>(),
            Substitute.For<IApprovalWorkflowService>(), Substitute.For<IMenuAmendmentService>(),
            Substitute.For<IApprovalRoutingService>(), f.Service);
        var history = await hub.GetHistoryAsync(admin, "mrx-supplemental-demand", draft.DemandId);
        Assert.Equal(GuidHelper.ToGuidString(f.ManagerId), Assert.Single(history.Where(x => x.Decision == "ADMIN_DIRECT")).ActionBy);
        var replay = await f.Service.SubmitAsync(draft.DemandId, command, admin);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(confirmed), System.Text.Json.JsonSerializer.Serialize(replay));
        Assert.Single(await f.Db.Approvalhistories.ToListAsync());
        Assert.False(await f.Db.Reconciliationsupplementaldemands.AnyAsync(x => x.Status == "PENDING"));
        Assert.Equal(originalLine.RequiredQuantity, (await f.Db.Reconciliationbatchdailylines.AsNoTracking().SingleAsync()).RequiredQuantity);
    }

    [Theory]
    [InlineData("PENDING", "PENDING")]
    [InlineData("PROCESSED", "APPROVED")]
    public async Task Hub_supplemental_pages_keep_material_search_matches_after_two_hundred_and_batch_material_reads(string state, string status)
    {
        var probe = new SupplementalInboxReadProbe();
        await using var f = await Fixture.CreateAsync(probe);
        var daily = await f.Db.Reconciliationbatchdailylines.SingleAsync();
        for (var i = 0; i < 355; i++)
        {
            var id = GuidHelper.NewId();
            f.Db.Reconciliationsupplementaldemands.Add(new ReconciliationSupplementalDemand { DemandId = id, BatchId = f.BatchId,
                ServiceDate = daily.ServiceDate, Status = status, Reason = "Tăng suất", CreatedBy = f.WarehouseId,
                CreatedAt = new DateTime(2026, 11, 16).AddSeconds(i), SnapshotBatchVersion = 2, SnapshotFingerprint = "fixture-snapshot" });
            if (i >= 150) f.Db.Reconciliationsupplementaldemandmaterials.Add(new ReconciliationSupplementalDemandMaterial {
                DemandMaterialId = GuidHelper.NewId(), DemandId = id, BatchId = f.BatchId, DailyLineId = daily.DailyLineId,
                IngredientId = daily.IngredientId, CanonicalUnitId = daily.CanonicalUnitId, RequiredQuantity = 1 });
        }
        await f.Db.SaveChangesAsync(); probe.RootCommands.Clear(); probe.MaterialReads = 0;
        var hub = new OperationalApprovalService(f.Db, Substitute.For<IApprovalInboxService>(), Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>(), f.Service);
        var ids = new List<string>(); string? cursor = null; var actor = f.Manager;
        do
        {
            var page = await hub.GetPageAsync(actor, new ApprovalInboxQueryDto { State = state, TargetType = "mrx-supplemental-demand",
                SearchKeyword = "Bầu", Limit = 20, Cursor = cursor });
            ids.AddRange(page.Items.Select(x => x.TargetId)); cursor = page.NextCursor;
            Assert.All(page.Items, item => Assert.Equal(1, Assert.Single(item.Materials).Quantity));
        } while (cursor is not null);
        Assert.Equal(205, ids.Count); Assert.Equal(205, ids.Distinct().Count());
        Assert.NotEmpty(probe.RootCommands);
        Assert.All(probe.RootCommands, sql => Assert.Contains("LIMIT", sql, StringComparison.Ordinal));
        Assert.InRange(probe.MaterialReads, 1, probe.RootCommands.Count);
    }

    private sealed class SupplementalInboxReadProbe : Microsoft.EntityFrameworkCore.Diagnostics.DbCommandInterceptor
    {
        internal List<string> RootCommands { get; } = [];
        internal int MaterialReads;
        public override ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader>> ReaderExecutingAsync(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("FROM \"reconciliationsupplementaldemands\"", StringComparison.Ordinal)) RootCommands.Add(command.CommandText);
            if (command.CommandText.Contains("FROM \"reconciliationsupplementaldemandmaterials\"", StringComparison.Ordinal)) MaterialReads++;
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    [Fact]
    public async Task Dish_options_use_exact_frozen_scope_keep_tiny_rates_and_surface_missing_conversion()
    {
        await using var f = await Fixture.CreateAsync();
        var day = new DateOnly(2026, 11, 30);
        var fact = await f.Db.Reconciliationbatchcontributors.SingleAsync();
        fact.FrozenBomQuantityPerServing = 0.0000004m;
        await f.Db.SaveChangesAsync();
        var options = await f.Service.GetDishOptionsAsync(GuidHelper.ToGuidString(f.BatchId), day, f.Warehouse);
        Assert.True(options.CanCreate);
        Assert.Equal(2, options.BatchVersion);
        var dish = Assert.Single(options.Dishes);
        Assert.Equal(GuidHelper.ToGuidString(f.DishId), dish.DishId);
        Assert.Equal("MORNING", dish.ShiftName);
        Assert.Equal("savory", dish.MenuVariant);
        Assert.Null(dish.BlockedReason);
        Assert.Empty((await f.Service.GetDishOptionsAsync(options.BatchId, day.AddDays(1), f.Warehouse)).Dishes);
        fact.FrozenBomUnitToBaseRate = null; await f.Db.SaveChangesAsync();
        var blocked = Assert.Single((await f.Service.GetDishOptionsAsync(options.BatchId, day, f.Warehouse)).Dishes);
        Assert.Contains("quy đổi", blocked.BlockedReason);
        Assert.Empty(await f.Db.Reconciliationsupplementaldemands.ToListAsync());
        var initial = await f.Db.Inventoryissues.SingleAsync();
        initial.ReconciliationBatchId = null;
        initial.MaterialRequestId = GuidHelper.NewId();
        fact.FrozenBomUnitToBaseRate = 1m;
        await f.Db.SaveChangesAsync();
        var defaultOnly = await f.Service.GetDishOptionsAsync(options.BatchId, day, f.Warehouse);
        Assert.False(defaultOnly.CanCreate);
        Assert.Contains("chưa có phiếu xuất ban đầu", defaultOnly.BlockedReason);
        (await f.Db.Systemoperationmodes.SingleAsync()).Mode = "DEFAULT"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => f.Service.GetDishOptionsAsync(options.BatchId, day, f.Warehouse));
    }
    [Fact]
    public async Task Mrx_audit_scope_includes_demand_history_only_for_its_exact_batch_and_entity_type()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        await f.Service.ApproveAsync(draft.DemandId, f.Command(2), f.Manager);
        f.Db.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), EntityName = nameof(ReconciliationSupplementalDemand),
            EntityId = f.BatchId, BusinessArea = "MATERIAL_RECONCILIATION", FieldName = "Status", NewValue = "APPROVED",
            ChangedBy = f.ManagerId, ChangedAt = DateTime.UtcNow, Reason = "Unrelated entity identity collision" });
        await f.Db.SaveChangesAsync();
        var scope = new MrxAuditScopeQuery(f.Db);
        var own = await (await scope.ApplyScopedAsync(f.Db.Auditlogs.AsNoTracking(), f.BatchId)).ToListAsync();
        Assert.Equal(6, own.Count);
        Assert.All(own, row => Assert.Equal(draft.DemandId, GuidHelper.ToGuidString(row.EntityId!)));
        Assert.Empty(await (await scope.ApplyScopedAsync(f.Db.Auditlogs.AsNoTracking(), GuidHelper.NewId())).ToListAsync());
        var all = await scope.Apply(f.Db.Auditlogs.AsNoTracking(), null).ToListAsync();
        Assert.Equal(6, all.Count);
    }
    [Fact]
    public async Task Demand_page_and_fulfillment_read_respect_status_batch_scope_and_authoritative_mode()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        var query = new ReconciliationSupplementalDemandPageQuery { BatchId = GuidHelper.ToGuidString(f.BatchId), Status = "DRAFT", PageSize = 1 };
        var page = await f.Service.GetPageAsync(query, f.Warehouse);
        Assert.Equal(draft.DemandId, Assert.Single(page.Items).DemandId);
        Assert.Equal(1, page.TotalCount);
        query.Status = "PENDING";
        Assert.Empty((await f.Service.GetPageAsync(query, f.Manager)).Items);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        Assert.Equal(draft.DemandId, Assert.Single((await f.Service.GetPageAsync(query, f.Manager)).Items).DemandId);
        var balance = await f.Service.GetFulfillmentAsync(GuidHelper.ToGuidString(f.BatchId), draft.ServiceDate, f.Warehouse);
        Assert.Equal(1, balance.PendingDemandCount);
        query.BatchId = Guid.NewGuid().ToString();
        Assert.Empty((await f.Service.GetPageAsync(query, f.Manager)).Items);
        (await f.Db.Systemoperationmodes.SingleAsync()).Mode = "DEFAULT"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => f.Service.GetPageAsync(query, f.Manager));
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => f.Service.GetFulfillmentAsync(draft.BatchId, draft.ServiceDate, f.Manager));
    }
    [Fact]
    public async Task Fulfillment_read_keeps_default_issue_rows_out_of_mrx_balances()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        await f.Service.ApproveAsync(draft.DemandId, f.Command(2), f.Manager);
        var daily = await f.Db.Reconciliationbatchdailylines.SingleAsync();
        var initial = await f.Db.Inventoryissues.SingleAsync();
        var lineId = GuidHelper.NewId();
        f.Db.Inventoryissuelines.Add(new InventoryIssueLine { IssueLineId = lineId, IssueId = initial.IssueId,
            IngredientId = daily.IngredientId, UnitId = daily.CanonicalUnitId, ReconciliationBatchLineId = daily.BatchLineId,
            ReconciliationBatchDailyLineId = daily.DailyLineId, ReconciliationServiceDate = daily.ServiceDate, IssuedQty = 10m, RequestedQty = 12m });
        f.Db.Reconciliationissueallocations.Add(new ReconciliationIssueAllocation { AllocationId = GuidHelper.NewId(), IssueLineId = lineId,
            DailyLineId = daily.DailyLineId, Purpose = "BASELINE_SHORTAGE", Quantity = 10m });
        var defaultIssueId = GuidHelper.NewId();
        f.Db.Inventoryissues.Add(new InventoryIssue { IssueId = defaultIssueId, IssueCode = "DEFAULT-PRIVATE", IssueDate = daily.ServiceDate,
            MaterialRequestId = GuidHelper.NewId(), WarehouseId = GuidHelper.NewId(), IssuedBy = f.WarehouseId });
        f.Db.Inventoryissuelines.Add(new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = defaultIssueId,
            IngredientId = daily.IngredientId, UnitId = daily.CanonicalUnitId,
            MaterialRequestLineId = GuidHelper.NewId(), IssuedQty = 999m, RequestedQty = 999m });
        await f.Db.SaveChangesAsync();
        var read = await ReconciliationSupplementalFulfillmentQuery.GetAsync(f.Db, f.BatchId, daily.ServiceDate);
        var balance = Assert.Single(read.Lines);
        Assert.Equal(10m, balance.NetIssuedQuantity);
        Assert.Equal(2m, balance.BaselineRemainingQuantity);
        Assert.Equal(2m, Assert.Single(balance.ExtraDemands).RemainingQuantity);
        Assert.False(balance.IsDemandFulfilled);
    }
    [Fact]
    public async Task Submitted_demand_is_reviewed_in_mode_scoped_hub_and_historical_decision_is_read_only()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        var inbox = Substitute.For<IApprovalInboxService>();
        var hub = new OperationalApprovalService(f.Db, inbox, Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>(), f.Service);
        var queue = await hub.GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-supplemental-demand" });
        Assert.Equal(draft.DemandId, Assert.Single(queue.Items).TargetId);
        Assert.Equal("Bầu", Assert.Single(queue.Items[0].Materials).Name);
        Assert.Equal("Kilogram", queue.Items[0].Materials[0].Unit);
        Assert.Equal(2m, queue.Items[0].Materials[0].Quantity);
        var detail = await hub.GetDetailAsync(f.Manager, "mrx-supplemental-demand", draft.DemandId);
        Assert.Equal(10, Assert.Single(detail.SupplementalDemand!.Dishes).ExtraServings);
        Assert.Contains("APPROVE", detail.AllowedActions);
        var result = await hub.DecideAsync(f.Manager, "mrx-supplemental-demand", draft.DemandId,
            new() { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1, ExpectedFingerprint = detail.Fingerprint,
                Decision = ApprovalDecision.Approve, Reason = "Đã xác nhận khách tăng suất" });
        Assert.Equal("APPROVED", result.Status);
        Assert.Empty((await hub.GetPageAsync(f.Manager, new ApprovalInboxQueryDto { TargetType = "mrx-supplemental-demand" })).Items);
        var archived = await hub.GetDetailAsync(f.Manager, "mrx-supplemental-demand", draft.DemandId, state: "PROCESSED");
        Assert.Empty(archived.AllowedActions);
        Assert.Contains(await hub.GetHistoryAsync(f.Manager, "mrx-supplemental-demand", draft.DemandId), row => row.NewStatus == "APPROVED");
        Assert.Empty(inbox.ReceivedCalls());
    }
    [Fact]
    public async Task Warehouse_proposes_manager_approves_snapshot_and_replay_never_edits_frozen_source_or_stock()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        Assert.Equal("DRAFT", draft.Status);
        Assert.Equal(2m, Assert.Single(draft.Materials).RequiredQuantity);
        var submitted = await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        Assert.Equal("PENDING", submitted.Status);
        var decision = f.Command(2);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Service.ApproveAsync(draft.DemandId, decision, f.Warehouse));
        var approved = await f.Service.ApproveAsync(draft.DemandId, decision, f.Manager);
        Assert.Equal("APPROVED", approved.Status);
        Assert.Equal(3, approved.Version);
        Assert.Equal(3, approved.BatchVersion);
        var replay = await f.Service.ApproveAsync(draft.DemandId, decision, f.Manager);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(approved), System.Text.Json.JsonSerializer.Serialize(replay));
        Assert.Equal("Khách tăng suất", approved.Reason);
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => f.Service.ApproveAsync(draft.DemandId,
            decision with { Reason = "Khác" }, f.Manager));
        f.Db.ChangeTracker.Clear();
        Assert.Equal(12m, (await f.Db.Reconciliationbatchdailylines.SingleAsync()).RequiredQuantity);
        Assert.Equal(60, (await f.Db.Reconciliationbatchcontributors.SingleAsync()).FrozenServings);
        Assert.Empty(await f.Db.Stockmovements.ToListAsync());
        Assert.Empty(await f.Db.Reconciliationissueallocations.ToListAsync());
        Assert.Equal(3, await f.Db.Lifecyclecommandreceipts.CountAsync());
        Assert.Equal(3, await f.Db.Lifecycletransitions.CountAsync());
        Assert.Equal(3, await f.Db.Lifecycleoutboxmessages.CountAsync());
        Assert.Equal(3, await f.Db.Auditlogs.CountAsync(x => x.EntityName == nameof(ReconciliationSupplementalDemand) && x.FieldName == "Status"));
    }

    [Fact]
    public async Task Stale_snapshot_cannot_be_approved_and_pending_request_can_be_rejected_with_trace()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        f.Db.ChangeTracker.Clear();
        (await f.Db.Reconciliationbatchcontributors.SingleAsync()).FrozenBomQuantityPerServing = 0.3m;
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => f.Service.ApproveAsync(draft.DemandId, f.Command(2), f.Manager));
        Assert.Equal("PENDING", (await f.Service.GetAsync(draft.DemandId, f.Manager)).Status);
        var rejected = await f.Service.RejectAsync(draft.DemandId, f.Command(2), f.Manager);
        Assert.Equal("REJECTED", rejected.Status);
        Assert.NotNull(rejected.DecidedAt);
        Assert.Equal(GuidHelper.ToGuidString(f.ManagerId), rejected.DecidedBy);
    }

    [Theory]
    [InlineData("version")]
    [InlineData("completed")]
    [InlineData("default-mode")]
    [InlineData("no-initial-issue")]
    [InlineData("chef")]
    public async Task Invalid_operation_leaves_no_demand_or_audit(string scenario)
    {
        await using var f = await Fixture.CreateAsync();
        var request = f.Request();
        var actor = f.Warehouse;
        if (scenario == "version") request = request with { ExpectedBatchVersion = 1 };
        if (scenario == "completed") (await f.Db.Reconciliationbatches.SingleAsync()).Status = "COMPLETED";
        if (scenario == "default-mode") (await f.Db.Systemoperationmodes.SingleAsync()).Mode = "DEFAULT";
        if (scenario == "no-initial-issue") f.Db.Inventoryissues.RemoveRange(await f.Db.Inventoryissues.ToListAsync());
        if (scenario == "chef") actor = new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString()), new Claim(ClaimTypes.Role, "Chef")], "test"));
        await f.Db.SaveChangesAsync();
        var failure = await Record.ExceptionAsync(() => f.Service.CreateAsync(request, actor));
        switch (scenario)
        {
            case "version": Assert.IsType<DbUpdateConcurrencyException>(failure); break;
            case "default-mode": Assert.IsType<SystemOperationConflictException>(failure); break;
            case "chef": Assert.IsType<UnauthorizedAccessException>(failure); break;
            default: Assert.IsType<BusinessRuleException>(failure); break;
        }
        Assert.Empty(await f.Db.Reconciliationsupplementaldemands.ToListAsync());
        Assert.Empty(await f.Db.Lifecyclecommandreceipts.ToListAsync());
        Assert.Empty(await f.Db.Auditlogs.ToListAsync());
    }

    [Fact]
    public async Task Approved_request_cannot_be_edited_and_cannot_be_cancelled_after_any_allocation()
    {
        await using var f = await Fixture.CreateAsync();
        var draft = await f.Service.CreateAsync(f.Request(), f.Warehouse);
        await f.Service.SubmitAsync(draft.DemandId, f.Command(1), f.Warehouse);
        var approved = await f.Service.ApproveAsync(draft.DemandId, f.Command(2), f.Manager);
        await Assert.ThrowsAsync<BusinessRuleException>(() => f.Service.UpdateDraftAsync(draft.DemandId,
            f.Request() with { ExpectedVersion = 3, ExpectedBatchVersion = 3 }, f.Warehouse));
        f.Db.ChangeTracker.Clear();
        var material = await f.Db.Reconciliationsupplementaldemandmaterials.SingleAsync();
        f.Db.Reconciliationissueallocations.Add(new ReconciliationIssueAllocation { AllocationId = GuidHelper.NewId(),
            IssueLineId = GuidHelper.NewId(), DailyLineId = material.DailyLineId, DemandMaterialId = material.DemandMaterialId,
            Purpose = "APPROVED_EXTRA_DEMAND", Quantity = 0.5m });
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => f.Service.CancelAsync(draft.DemandId,
            f.Command(3) with { ExpectedBatchVersion = 3 }, f.Manager));
        Assert.Equal("APPROVED", (await f.Service.GetAsync(draft.DemandId, f.Manager)).Status);
    }

    internal sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public readonly IpcManagementContext Db;
        public readonly byte[] ManagerId = GuidHelper.NewId();
        public readonly byte[] WarehouseId = GuidHelper.NewId();
        public readonly byte[] BatchId = GuidHelper.NewId();
        public readonly byte[] DishId = GuidHelper.NewId();
        public readonly ReconciliationSupplementalDemandService Service;
        public ClaimsPrincipal Warehouse => Actor(WarehouseId, "WarehouseStaff");
        public ClaimsPrincipal Manager => Actor(ManagerId, "Manager");
        private Fixture(SqliteConnection connection, IpcManagementContext db)
        {
            this.connection = connection; Db = db;
            var requestContext = new SystemOperationRequestContext { Mode = "MATERIAL_RECONCILIATION", ExpectedModeVersion = 1,
                OperationKey = "reconciliation.supplemental-demands", Disposition = OperationDisposition.ReconciliationOnly };
            Service = new(db, new EfTransactionRunner(db, requestContext, new SystemOperationModeGuard(db)), requestContext);
        }
        public static async Task<Fixture> CreateAsync(Microsoft.EntityFrameworkCore.Diagnostics.IInterceptor? probe = null)
        {
            var connection = new SqliteConnection("Data Source=:memory:;Foreign Keys=False");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection);
            if (probe is not null) options.AddInterceptors(probe);
            var db = new SupplementalContext(options.Options);
            await db.Database.EnsureCreatedAsync();
            var f = new Fixture(connection, db);
            db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "MATERIAL_RECONCILIATION", Version = 1, UpdatedBy = f.ManagerId });
            var customerId = GuidHelper.NewId(); var menuVersionId = GuidHelper.NewId();
            db.Customers.Add(new Customer { CustomerId = customerId, CustomerCode = "ANV", CustomerName = "AMANN", IsActive = true });
            db.Menuversions.Add(new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 11, 30) });
            foreach (var userId in new[] { f.ManagerId, f.WarehouseId }) db.Users.Add(new User { UserId = userId,
                FullName = userId.SequenceEqual(f.ManagerId) ? "Quản lý" : "Thủ kho", Username = GuidHelper.ToGuidString(userId),
                PasswordHash = "fixture-only", RoleId = GuidHelper.NewId(), IsActive = true });
            db.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = f.BatchId, Status = "IN_PROGRESS", Version = 2,
                MenuVersionId = menuVersionId, QuantityImportBatchId = GuidHelper.NewId(), CreatedBy = f.ManagerId });
            var line = new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = GuidHelper.NewId(),
                BatchId = f.BatchId, IngredientId = GuidHelper.NewId(), CanonicalUnitId = GuidHelper.NewId(),
                ServiceDate = new DateOnly(2026, 11, 30), RequiredQuantity = 12m };
            db.Units.Add(new Unit { UnitId = line.CanonicalUnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
            db.Ingredients.Add(new Ingredient { IngredientId = line.IngredientId, IngredientCode = "ING-BAU", IngredientName = "Bầu",
                UnitId = line.CanonicalUnitId, WarehouseId = GuidHelper.NewId(), IsActive = true });
            db.Reconciliationbatchlines.Add(new ReconciliationBatchLine { BatchLineId = line.BatchLineId, BatchId = f.BatchId,
                IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId, RequiredQuantity = 12m,
                ToleranceSourceKind = "DEFAULT", ToleranceSourceVersion = "fixture", Version = 1 });
            db.Reconciliationbatchdailylines.Add(line);
            db.Reconciliationbatchcontributors.Add(new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(),
                BatchLineId = line.BatchLineId, DailyLineId = line.DailyLineId, DishId = f.DishId, FrozenDishCode = "DISH-1", FrozenDishName = "Bầu nấu tôm",
                FrozenShiftName = "MORNING", FrozenMenuVariant = "savory", FrozenServings = 60, FrozenBomQuantityPerServing = 0.2m,
                FrozenBomUnitToBaseRate = 1, FrozenCanonicalUnitToBaseRate = 1,
                MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId() });
            db.Inventoryissues.Add(new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "MRX-INITIAL", IssueDate = line.ServiceDate,
                ReconciliationBatchId = f.BatchId, IssuedBy = f.WarehouseId, WarehouseId = GuidHelper.NewId() });
            await db.SaveChangesAsync(); db.ChangeTracker.Clear(); return f;
        }
        public ReconciliationSupplementalDemandWriteRequest Request() => new(Guid.NewGuid().ToString(), 0, 2,
            GuidHelper.ToGuidString(BatchId), new DateOnly(2026, 11, 30), "Khách tăng suất",
            [new(GuidHelper.ToGuidString(DishId), "MORNING", "savory", 10)]);
        public ReconciliationSupplementalDemandCommand Command(long version) => new(Guid.NewGuid().ToString(), version, 2, "Đã đối chiếu nhu cầu");
        private static ClaimsPrincipal Actor(byte[] id, string role) => new(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, GuidHelper.ToGuidString(id)), new Claim(ClaimTypes.Role, role)], "test"));
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
    }

    private sealed class SupplementalContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder model)
        {
            base.OnModelCreating(model); model.UseCollation("BINARY");
            foreach (var entity in model.Model.GetEntityTypes())
                foreach (var index in entity.GetIndexes()) index.SetDatabaseName($"{entity.GetTableName()}_{index.GetDatabaseName()}");
            foreach (var property in model.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
            {
                if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true) property.SetColumnType("TEXT");
                if (property.GetCollation()?.Contains("utf8mb4", StringComparison.OrdinalIgnoreCase) == true) property.SetCollation("BINARY");
                if (property.GetDefaultValueSql()?.Contains("CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase) == true) property.SetDefaultValueSql("CURRENT_TIMESTAMP");
            }
        }
    }
}
