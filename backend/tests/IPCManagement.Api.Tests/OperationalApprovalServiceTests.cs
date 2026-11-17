using IPCManagement.Api.Workflows.OperationalApprovals;
using System.Security.Claims;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class OperationalApprovalServiceTests
{
    [Fact]
    public async Task Processed_history_keeps_late_search_matches_without_loading_all_records_in_one_sql_read()
    {
        var probe = new HistoryReadProbe();
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync(probe);
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);");
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        for (var i = 0; i < 355; i++)
        {
            var id = GuidHelper.NewId();
            db.Purchaserequests.Add(new PurchaseRequest { PurchaseRequestId = id, PurchaseRequestCode = (i < 150 ? "OTHER-" : "MATCH-") + i.ToString("D4"), Status = "APPROVED", CreatedBy = fixture.UserId });
            db.Approvalhistories.Add(new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(), TargetType = "purchase-request", TargetId = id,
                Decision = "APPROVE", NewStatus = "APPROVED", ActionBy = fixture.UserId, ActionAt = new DateTime(2026, 11, 16).AddSeconds(i) });
        }
        await db.SaveChangesAsync();
        var service = new OperationalApprovalService(db, Substitute.For<IApprovalInboxService>(), Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
        var ids = new List<string>(); string? cursor = null;
        var actor = Actor("Manager");
        do
        {
            var page = await service.GetPageAsync(actor, new ApprovalInboxQueryDto { State = "PROCESSED", TargetType = "purchase-request", SearchKeyword = "MATCH-", Limit = 20, Cursor = cursor });
            ids.AddRange(page.Items.Select(x => x.TargetId)); cursor = page.NextCursor;
        } while (cursor is not null);
        Assert.Equal(205, ids.Count); Assert.Equal(205, ids.Distinct().Count());
        Assert.NotEmpty(probe.Commands);
        Assert.All(probe.Commands, command => Assert.Contains("LIMIT", command, StringComparison.Ordinal));
    }

    private sealed class HistoryReadProbe : Microsoft.EntityFrameworkCore.Diagnostics.DbCommandInterceptor
    {
        internal List<string> Commands { get; } = [];
        public override ValueTask<Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader>> ReaderExecutingAsync(
            System.Data.Common.DbCommand command, Microsoft.EntityFrameworkCore.Diagnostics.CommandEventData eventData,
            Microsoft.EntityFrameworkCore.Diagnostics.InterceptionResult<System.Data.Common.DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("FROM \"approvalhistories\"", StringComparison.Ordinal)) Commands.Add(command.CommandText);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    [Fact]
    public async Task Processed_cursor_keeps_distinct_target_types_with_the_same_identity_and_timestamp()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL,
                version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);
            """);
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        await db.SaveChangesAsync();
        var generated = await new MaterialDemandService(db).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" }, fixture.UserIdString);
        var id = GuidHelper.ParseGuidString(generated!.MaterialRequestId)!;
        db.Purchaserequests.Add(new PurchaseRequest { PurchaseRequestId = id, PurchaseRequestCode = "PR-SAME-ID",
            Status = "APPROVED", CreatedBy = fixture.UserId });
        var at = new DateTime(2026, 11, 16, 1, 0, 0, DateTimeKind.Utc);
        foreach (var type in new[] { "material-demand", "purchase-request" })
            db.Approvalhistories.Add(new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(), TargetType = type,
                TargetId = id, Decision = "APPROVE", NewStatus = "APPROVED", ActionAt = at, ActionBy = fixture.UserId });
        await db.SaveChangesAsync();
        var service = new OperationalApprovalService(db, Substitute.For<IApprovalInboxService>(), Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
        var actor = Actor("Manager");
        var first = await service.GetPageAsync(actor, new ApprovalInboxQueryDto { State = "PROCESSED", Limit = 1 });
        var second = await service.GetPageAsync(actor, new ApprovalInboxQueryDto { State = "PROCESSED", Limit = 1, Cursor = first.NextCursor });
        Assert.True(first.HasNext);
        Assert.False(second.HasNext);
        Assert.NotEqual(Assert.Single(first.Items).InboxItemId, Assert.Single(second.Items).InboxItemId);
    }
    [Fact]
    public async Task Required_assignment_explains_why_approve_is_unavailable_while_retaining_domain_reject_authority()
    {
        await using var db = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var actor = Actor("Manager");
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = GuidHelper.NewId() });
        await db.SaveChangesAsync();
        var id = Guid.NewGuid().ToString();
        var routing = Substitute.For<IApprovalRoutingService>();
        var ruleId = GuidHelper.NewId();
        routing.GetMatchingRuleAsync("material-demand", null).Returns(new ApprovalRule { RuleId = ruleId });
        routing.GetAssignmentsForRuleAsync(ruleId).Returns(new[] {
            new ApprovalAssignment { Sequence = 1, IsRequired = true, ApproverUserId = GuidHelper.NewId(), ApproverRole = "Manager" },
            new ApprovalAssignment { Sequence = 2, IsRequired = true, ApproverUserId = GuidHelper.NewId(), ApproverRole = "Manager" } });
        var inbox = Substitute.For<IApprovalInboxService>();
        inbox.GetPendingPageAsync(actor, Arg.Any<ApprovalInboxQueryDto>(), Arg.Any<CancellationToken>()).Returns(
            new ApprovalInboxPageDto { Items = [new ApprovalInboxItemDto { TargetType = "material-demand", TargetId = id, Status = "DRAFT" }] });
        var service = new OperationalApprovalService(db, inbox, Substitute.For<IApprovalWorkflowService>(), Substitute.For<IMenuAmendmentService>(), routing);
        var detail = await service.GetDetailAsync(actor, "material-demand", id);
        Assert.Equal(new[] { "REJECT" }, detail.AllowedActions);
        Assert.Contains(detail.BlockedReasons, reason => reason.Contains("chỉ định"));
    }
    [Fact]
    public async Task Default_command_replays_original_response_after_target_leaves_queue_and_binds_payload_and_actor()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL,
                version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);
            """);
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        await db.SaveChangesAsync();
        var generated = await new MaterialDemandService(db).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" }, fixture.UserIdString);
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Manager"),
            new Claim(ClaimTypes.NameIdentifier, fixture.UserIdString)], "test"));
        var operation = new SystemOperationRequestContext { Mode = "DEFAULT", OperationKey = "approvals.operational", ExpectedModeVersion = 1,
            Disposition = OperationDisposition.Retained };
        var runner = new EfTransactionRunner(db, operation, new SystemOperationModeGuard(db));
        var routing = Substitute.For<IApprovalRoutingService>();
        var workflow = new ApprovalWorkflowService(db, routing, [new MaterialDemandApprovalHandler(db, runner)], runner, operation);
        var service = new OperationalApprovalService(db, new ApprovalInboxService(db, routing), workflow, Substitute.For<IMenuAmendmentService>(), routing);
        var detail = await service.GetDetailAsync(actor, "material-demand", generated!.MaterialRequestId);
        var command = new OperationalApprovalActionRequest { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1,
            ExpectedFingerprint = detail.Fingerprint, Decision = ApprovalDecision.Approve, Reason = "Đã kiểm tra định lượng" };
        await Assert.ThrowsAsync<ArgumentException>(() => service.DecideAsync(actor, "material-demand", generated.MaterialRequestId,
            new OperationalApprovalActionRequest { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1,
                ExpectedFingerprint = detail.Fingerprint, Decision = ApprovalDecision.Approve, Action = "REJECT", Reason = "Quyết định mâu thuẫn" }));
        Assert.Empty(await db.Approvalhistories.ToListAsync());
        var first = await service.DecideAsync(actor, "material-demand", generated.MaterialRequestId, command);
        db.ChangeTracker.Clear();
        var replay = await service.DecideAsync(actor, "material-demand", generated.MaterialRequestId, command);
        Assert.Equal(first.HistoryId, replay.HistoryId);
        Assert.Single(await db.Approvalhistories.Where(row => row.TargetType == "material-demand").ToListAsync());
        Assert.Single(await db.Lifecyclecommandreceipts.Where(row => row.AggregateType.StartsWith("OperationalApproval:")).ToListAsync());
        var completed = await service.GetPageAsync(actor, new ApprovalInboxQueryDto { State = "PROCESSED" });
        Assert.Equal(generated.MaterialRequestId, Assert.Single(completed.Items).TargetId);
        var archived = await service.GetDetailAsync(actor, "material-demand", generated.MaterialRequestId, state: "PROCESSED");
        Assert.Empty(archived.AllowedActions);
        Assert.Equal("MANAGERAPPROVED", archived.Item.Status);
        command.Reason = "Changed payload";
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => service.DecideAsync(actor, "material-demand", generated.MaterialRequestId, command));
        await Assert.ThrowsAsync<SystemOperationConflictException>(() => service.DecideAsync(Actor("Manager"), "material-demand", generated.MaterialRequestId, command));
    }
    private static ClaimsPrincipal Actor(string role) => new(new ClaimsIdentity([
        new Claim(ClaimTypes.Role, role), new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "test"));

    [Theory]
    [InlineData("Manager", true)]
    [InlineData("Admin", false)]
    public async Task Receipt_reader_sees_specific_decision_blocker_without_losing_read_access(string role, bool createdByActor)
    {
        await using var db = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var actor = Actor(role);
        var creator = GuidHelper.ParseGuidString(actor.FindFirstValue(ClaimTypes.NameIdentifier))!;
        var id = GuidHelper.NewId();
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = creator });
        db.Inventoryreceipts.Add(new InventoryReceipt { ReceiptId = id, ReceiptCode = "REC-SELF",
            WarehouseId = GuidHelper.NewId(), SupplierId = GuidHelper.NewId(), CreatedBy = createdByActor ? creator : GuidHelper.NewId(),
            Status = "PENDING_APPROVAL", QualityStatus = "ACCEPTED", ConcurrencyVersion = 1 });
        await db.SaveChangesAsync();
        var inbox = Substitute.For<IApprovalInboxService>();
        inbox.GetPendingPageAsync(actor, Arg.Any<ApprovalInboxQueryDto>(), Arg.Any<CancellationToken>())
            .Returns(new ApprovalInboxPageDto { Items = [new ApprovalInboxItemDto { TargetType = "inventory-receipt", TargetId = GuidHelper.ToGuidString(id) }] });
        var workflow = Substitute.For<IApprovalWorkflowService>();
        var service = new OperationalApprovalService(db, inbox, workflow, Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
        var detail = await service.GetDetailAsync(actor, "inventory-receipt", GuidHelper.ToGuidString(id));
        Assert.Empty(detail.AllowedActions);
        Assert.Contains(detail.BlockedReasons, reason => reason.Contains(createdByActor ? "tự duyệt" : "Chỉ Quản lý"));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.DecideAsync(actor, "inventory-receipt", GuidHelper.ToGuidString(id),
            new OperationalApprovalActionRequest { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1, ExpectedFingerprint = detail.Fingerprint, Reason = "Đã kiểm tra" }));
        Assert.Empty(workflow.ReceivedCalls());
    }

    [Fact]
    public async Task Default_history_rejects_mrx_issue_identity_before_reading_approval_events()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL,
                version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);
            """);
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        var issueId = GuidHelper.NewId();
        db.Inventoryissues.Add(new InventoryIssue { IssueId = issueId, IssueCode = "MRX-PRIVATE", IssueDate = new DateOnly(2026, 11, 16),
            ReconciliationBatchId = GuidHelper.NewId(), WarehouseId = fixture.WarehouseId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = new OperationalApprovalService(db, Substitute.For<IApprovalInboxService>(),
            Substitute.For<IApprovalWorkflowService>(), Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetHistoryAsync(Actor("Manager"), "inventory-issue", GuidHelper.ToGuidString(issueId)));
        Assert.Empty(db.ChangeTracker.Entries<ApprovalHistory>());
        db.Approvalhistories.Add(new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(), TargetType = "inventory-issue",
            TargetId = issueId, Decision = "APPROVE", NewStatus = "APPROVED", ActionBy = fixture.UserId, ActionAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        Assert.Empty((await service.GetPageAsync(Actor("Manager"), new ApprovalInboxQueryDto { State = "PROCESSED" })).Items);
    }

    [Fact]
    public async Task Mrx_inbox_never_queries_default_approvals_and_excludes_default_amendments()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL,
                version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);
            """);
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE reconciliationbatches (BatchId BLOB PRIMARY KEY, MenuVersionId BLOB NOT NULL,
                QuantityImportBatchId BLOB NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedBy BLOB NOT NULL,
                CreatedAt TEXT NOT NULL, ReadyBy BLOB NULL, ReadyAt TEXT NULL, CompletedBy BLOB NULL, CompletedAt TEXT NULL);
            """);
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = SystemOperationEligibility.MaterialReconciliation,
            Version = 3, UpdatedBy = GuidHelper.NewId() });
        var customer = new Customer { CustomerId = GuidHelper.NewId(), CustomerCode = "ANV", CustomerName = "AMANN", IsActive = true };
        var actor = new User { UserId = GuidHelper.NewId(), Username = "test-manager", PasswordHash = "test", FullName = "Quản lý", RoleId = GuidHelper.NewId(), IsActive = true, CreatedAt = DateTime.UtcNow };
        db.Roles.Add(new Role { RoleId = actor.RoleId, RoleCode = "MANAGER", RoleName = "Manager" });
        db.Customers.Add(customer); db.Users.Add(actor);
        var mrxId = GuidHelper.NewId();
        foreach (var isMrx in new[] { true, false })
            db.Menuamendments.Add(new MenuAmendment { MenuAmendmentId = isMrx ? mrxId : GuidHelper.NewId(),
                CustomerId = customer.CustomerId, Customer = customer, BaseMenuVersionId = isMrx ? GuidHelper.NewId() : null,
                WeekStartDate = new DateOnly(2026, 11, 16), Status = "PENDING_REVIEW", Reason = "Đổi món",
                CreatedBy = actor.UserId, CreatedByNavigation = actor, CreatedAt = DateTime.UtcNow,
                ImpactSnapshotJson = JsonSerializer.Serialize(new MenuAmendmentResultDto {
                    AffectedReconciliationBatchIds = isMrx ? [Guid.NewGuid().ToString()] : [] }) });
        await db.SaveChangesAsync();
        var inbox = Substitute.For<IApprovalInboxService>();
        var service = new OperationalApprovalService(db, inbox, Substitute.For<IApprovalWorkflowService>(), Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>());
        var page = await service.GetPageAsync(Actor("Manager"), new ApprovalInboxQueryDto());
        Assert.Equal(GuidHelper.ToGuidString(mrxId), Assert.Single(page.Items).TargetId);
        Assert.Equal("MATERIAL_RECONCILIATION", page.Mode);
        // DEFAULT amendments have no base menu version. MRX requests can precede batch creation.
        // Traverse more than 200 actual MRX source records without dropping late matches.
        for (var i = 0; i < 355; i++) db.Menuamendments.Add(new MenuAmendment {
            MenuAmendmentId = GuidHelper.NewId(), CustomerId = customer.CustomerId, BaseMenuVersionId = i >= 150 ? GuidHelper.NewId() : null,
            WeekStartDate = new DateOnly(2026, 11, 16), Status = "PENDING_REVIEW", Reason = "Đối chiếu phân trang",
            CreatedBy = actor.UserId, CreatedAt = new DateTime(2026, 11, 16).AddSeconds(i),
            ImpactSnapshotJson = JsonSerializer.Serialize(new MenuAmendmentResultDto {
                AffectedReconciliationBatchIds = i >= 150 ? [Guid.NewGuid().ToString()] : [] }) });
        await db.SaveChangesAsync();
        var reader = Actor("Manager"); string? cursor = null; var all = new List<string>();
        do
        {
            var next = await service.GetPageAsync(reader, new ApprovalInboxQueryDto { TargetType = "mrx-source-change", Limit = 20, SearchKeyword = "AMANN", Cursor = cursor });
            all.AddRange(next.Items.Select(x => x.TargetId)); cursor = next.NextCursor;
        } while (cursor is not null);
        Assert.Equal(206, all.Count); Assert.Equal(206, all.Distinct().Count());
        Assert.Contains(GuidHelper.ToGuidString(mrxId), all);
        Assert.Empty(inbox.ReceivedCalls());
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetPageAsync(Actor("Chef"), new ApprovalInboxQueryDto()));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetPageAsync(Actor("Manager"), new ApprovalInboxQueryDto { TargetType = "inventory-issue" }));
    }
}
