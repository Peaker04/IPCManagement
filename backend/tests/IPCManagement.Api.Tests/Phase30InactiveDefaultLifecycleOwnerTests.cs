using System.Reflection;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveDefaultLifecycleOwnerTests
{
    [Theory]
    [InlineData("create")]
    [InlineData("fulfill")]
    [InlineData("route")]
    [InlineData("reject")]
    public async Task Supplemental_PublicOwner_FreezesAndResumesSameAggregateWithFiveCompleteLedgers(string owner)
    {
        await using var fixture = await Fixture.CreateAsync();
        var commandId = $"phase30-supplemental-{owner}";
        SupplementalMaterialRequestDto? existing = null;
        if (owner != "create")
        {
            existing = await fixture.CreateSupplementalAsync($"phase30-{owner}-fixture");
        }

        var staleDefaultAuthority = fixture.CaptureAuthority($"supplementalmaterialrequests.{owner}");
        await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, $"freeze supplemental {owner}");
        fixture.SetAuthority(staleDefaultAuthority);
        var preInactive = await fixture.CaptureCompleteCommonLedgerAsync();

        var rejected = () => fixture.InvokeSupplementalAsync(owner, existing, commandId);
        await rejected.Should().ThrowAsync<SystemOperationConflictException>();
        var postRejection = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertExactLedger(preInactive, postRejection);

        var resumed = await fixture.SwitchAsync(SystemOperationEligibility.Default, $"resume supplemental {owner}");
        fixture.SetAuthority(resumed, $"supplementalmaterialrequests.{owner}");
        var postSwitchBack = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertExactLedger(postRejection with { Mode = postSwitchBack.Mode }, postSwitchBack);

        var result = await fixture.InvokeSupplementalAsync(owner, existing, commandId);
        var postSuccess = await fixture.CaptureCompleteCommonLedgerAsync();
        await fixture.AssertSupplementalIntendedDeltaAsync(owner, preInactive, postSuccess, postSwitchBack.Mode, existing, result, commandId);

        var replay = await fixture.InvokeSupplementalAsync(owner, existing, commandId);
        JsonSerializer.Serialize(replay).Should().Be(JsonSerializer.Serialize(result));
        var postReplay = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertExactLedger(postSuccess, postReplay);
    }

    [Fact]
    public async Task LegacyApprovedDisposition_ApplyAsync_FreezesThenResumesSameReviewedCommandAndReplaysCanonically()
    {
        await using var fixture = await Fixture.CreateAsync();
        var approved = await fixture.CreateApprovedLegacyDispositionAsync();
        var commandId = "phase30-legacy-apply-same-command";

        var staleDefaultAuthority = fixture.CaptureAuthority("legacylineagedispositions.apply");
        await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "freeze approved legacy apply");
        fixture.SetAuthority(staleDefaultAuthority);
        var preInactive = await fixture.CaptureCompleteCommonLedgerAsync();
        var rejected = () => fixture.LegacyService.ApplyAsync(approved.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = commandId,
            ExpectedVersion = approved.Version,
            Reason = "Apply the exact Manager-reviewed target."
        }, fixture.AdminId);
        await rejected.Should().ThrowAsync<SystemOperationConflictException>();
        var postRejection = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertExactLedger(preInactive, postRejection);

        var resumed = await fixture.SwitchAsync(SystemOperationEligibility.Default, "resume approved legacy apply");
        fixture.SetAuthority(resumed, "legacylineagedispositions.apply");
        var postSwitchBack = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertExactLedger(postRejection with { Mode = postSwitchBack.Mode }, postSwitchBack);

        var applied = await fixture.LegacyService.ApplyAsync(approved.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = commandId,
            ExpectedVersion = approved.Version,
            Reason = "Apply the exact Manager-reviewed target."
        }, fixture.AdminId);
        applied.DispositionId.Should().Be(approved.DispositionId);
        applied.Status.Should().Be("APPLIED");
        applied.Version.Should().Be(approved.Version + 1);
        applied.ReviewedBy.Should().Be(fixture.ManagerId);
        applied.AppliedBy.Should().Be(fixture.AdminId);
        fixture.ManagerId.Should().NotBe(fixture.AdminId);
        (await fixture.Context.Inventoryissuelines.AsNoTracking().SingleAsync(item => item.IssueLineId == fixture.LegacyIssueLineBytes))
            .MaterialRequestLineId.Should().Equal(fixture.MaterialRequestLineBytes);
        var postSuccess = await fixture.CaptureCompleteCommonLedgerAsync();
        await fixture.AssertLegacyIntendedDeltaAsync(preInactive, postSuccess, postSwitchBack.Mode, approved, applied, commandId);

        var replay = await fixture.LegacyService.ApplyAsync(approved.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = commandId,
            ExpectedVersion = approved.Version,
            Reason = "Apply the exact Manager-reviewed target."
        }, fixture.AdminId);
        JsonSerializer.Serialize(replay).Should().Be(JsonSerializer.Serialize(applied));
        fixture.AssertExactLedger(postSuccess, await fixture.CaptureCompleteCommonLedgerAsync());
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private long _modeVersion;
        private Fixture(SqliteConnection connection, IpcManagementContext context)
        {
            _connection = connection;
            Context = context;
            RequestContext = new SystemOperationRequestContext();
            Guard = new SystemOperationModeGuard(context);
            ModeService = new SystemOperationModeService(context, Guard, new EfTransactionRunner(context));
            var resolver = Substitute.For<IOperationalWarehouseResolver>();
            resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(WarehouseBytes);
            var runner = new EfTransactionRunner(context, RequestContext, Guard);
            var stock = new StockLedgerService(new CurrentStockRepository(context), new StockMovementRepository(context));
            SupplementalService = new SupplementalMaterialRequestService(context, new UnitOfWork(context), stock, runner, resolver, RequestContext);
            LegacyService = new LegacyLineageDispositionService(context, runner, new LifecycleTransitionRecorder(context), RequestContext);
        }

        public IpcManagementContext Context { get; }
        public SystemOperationRequestContext RequestContext { get; }
        public SystemOperationModeGuard Guard { get; }
        public SystemOperationModeService ModeService { get; }
        public ISupplementalMaterialRequestService SupplementalService { get; }
        public ILegacyLineageDispositionService LegacyService { get; }
        public byte[] AdminBytes { get; } = GuidHelper.NewId();
        public byte[] ManagerBytes { get; } = GuidHelper.NewId();
        public byte[] WarehouseBytes { get; } = GuidHelper.NewId();
        public byte[] IngredientBytes { get; } = GuidHelper.NewId();
        public byte[] UnitBytes { get; } = GuidHelper.NewId();
        public byte[] MaterialRequestBytes { get; } = GuidHelper.NewId();
        public byte[] MaterialRequestLineBytes { get; } = GuidHelper.NewId();
        public byte[] SourceIssueBytes { get; } = GuidHelper.NewId();
        public byte[] SourceIssueLineBytes { get; } = GuidHelper.NewId();
        public byte[] LegacyIssueBytes { get; } = GuidHelper.NewId();
        public byte[] LegacyIssueLineBytes { get; } = GuidHelper.NewId();
        public string AdminId => GuidHelper.ToGuidString(AdminBytes);
        public string ManagerId => GuidHelper.ToGuidString(ManagerBytes);
        public string WarehouseId => GuidHelper.ToGuidString(WarehouseBytes);

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var workflowFixtureType = typeof(WorkflowGenerationTests).GetNestedType("WorkflowFixture", BindingFlags.NonPublic)!;
            var createSchema = workflowFixtureType.GetMethod("CreateMinimalWorkflowSchemaAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            await (Task)createSchema.Invoke(null, [connection])!;
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedAt TEXT NOT NULL, updatedBy BLOB NOT NULL, reason TEXT NULL);
                    CREATE TABLE reconciliationbatches (batchId BLOB PRIMARY KEY, status TEXT NOT NULL);
                    CREATE TABLE lifecycleoutboxdeliveries (deliveryId BLOB PRIMARY KEY, outboxMessageId BLOB NOT NULL, consumerName TEXT NOT NULL, processedAt TEXT NOT NULL);
                    CREATE TABLE reconciliationactuals (actualId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, side TEXT NOT NULL, quantity TEXT NOT NULL, version INTEGER NOT NULL, enteredBy BLOB NOT NULL, enteredAt TEXT NOT NULL);
                    CREATE TABLE reconciliationactualrevisions (revisionId BLOB PRIMARY KEY, actualId BLOB NOT NULL, oldQuantity TEXT NOT NULL, newQuantity TEXT NOT NULL, reason TEXT NOT NULL, changedBy BLOB NOT NULL, changedAt TEXT NOT NULL);
                    CREATE TABLE reconciliationdispositions (dispositionId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL);
                    """;
                await command.ExecuteNonQueryAsync();
            }
            var context = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
            var fixture = new Fixture(connection, context);
            await fixture.SeedAsync();
            return fixture;
        }

        private async Task SeedAsync()
        {
            var adminRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
            var managerRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "MANAGER", RoleName = "Manager" };
            Context.AddRange(adminRole, managerRole,
                User(AdminBytes, adminRole.RoleId, "phase30-admin"), User(ManagerBytes, managerRole.RoleId, "phase30-manager"),
                new Unit { UnitId = UnitBytes, UnitCode = "KG", UnitName = "kg", ConvertRateToBase = 1 },
                new Warehouse { WarehouseId = WarehouseBytes, WarehouseCode = "P30L", WarehouseName = "Phase 30 lifecycle", WarehouseType = "MAIN", IsOperationalActive = true },
                new Ingredient { IngredientId = IngredientBytes, IngredientCode = "P30-LIFE", IngredientName = "Phase 30 lifecycle ingredient", UnitId = UnitBytes, WarehouseId = WarehouseBytes, ReferencePrice = 1, IsActive = true },
                new MaterialRequest
                {
                    RequestId = MaterialRequestBytes, RequestCode = "MR-P30-LIFE", PlanId = GuidHelper.NewId(), RequestDate = new DateOnly(2026, 8, 30), RequestScope = "FULLDAY", Status = "APPROVED", CreatedBy = AdminBytes,
                    Materialrequestlines = [new MaterialRequestLine { RequestLineId = MaterialRequestLineBytes, PlanLineId = GuidHelper.NewId(), IngredientId = IngredientBytes, UnitId = UnitBytes, TotalServings = 1, GrossQtyPerServing = 10, BomRatePercent = 100, AppliedPortionRuleSource = "TEST", AppliedPortionRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 5, SuggestedPurchaseQty = 5, Ingredient = null!, Unit = null! }]
                },
                Issue(SourceIssueBytes, SourceIssueLineBytes, "ISS-P30-SOURCE", MaterialRequestLineBytes, received: true),
                Issue(LegacyIssueBytes, LegacyIssueLineBytes, "ISS-P30-LEGACY", null, received: true),
                new CurrentStock { WarehouseId = WarehouseBytes, IngredientId = IngredientBytes, UnitId = UnitBytes, CurrentQty = 5, LastUpdated = DateTime.UtcNow },
                new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = AdminBytes });
            await Context.SaveChangesAsync();
            _modeVersion = 1;
        }

        private User User(byte[] id, byte[] roleId, string username) => new() { UserId = id, RoleId = roleId, Username = username, FullName = username, PasswordHash = "test-only", IsActive = true, CreatedAt = DateTime.UtcNow };
        private InventoryIssue Issue(byte[] id, byte[] lineId, string code, byte[]? sourceLine, bool received) => new()
        {
            IssueId = id, IssueCode = code, IssueDate = new DateOnly(2026, 8, 30), ShiftName = "MORNING", WarehouseId = WarehouseBytes, MaterialRequestId = MaterialRequestBytes, IssuedBy = AdminBytes, ReceivedBy = received ? AdminBytes : null, ReceivedAt = received ? DateTime.UtcNow : null, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = [new InventoryIssueLine { IssueLineId = lineId, IngredientId = IngredientBytes, UnitId = UnitBytes, MaterialRequestLineId = sourceLine, RequestedQty = 10, IssuedQty = 10 }]
        };

        public async Task<SystemOperationModeDto> SwitchAsync(string mode, string reason)
        {
            var result = await ModeService.ChangeAsync(new ChangeSystemOperationModeRequest(mode, _modeVersion, true, reason), AdminId);
            _modeVersion = result.Version;
            return result;
        }
        public OperationAuthority CaptureAuthority(string operationKey) => new(SystemOperationEligibility.Default, _modeVersion, operationKey);
        public void SetAuthority(OperationAuthority authority) => SetAuthority(authority.Mode, authority.Version, authority.OperationKey);
        public void SetAuthority(SystemOperationModeDto mode, string operationKey) => SetAuthority(mode.Mode, mode.Version, operationKey);

        public async Task<SupplementalMaterialRequestDto> CreateSupplementalAsync(string commandId)
        {
            SetAuthority(SystemOperationEligibility.Default, _modeVersion, "supplementalmaterialrequests.create");
            return await SupplementalService.CreateAsync(new CreateSupplementalMaterialRequest { CommandId = commandId, IssueId = GuidHelper.ToGuidString(SourceIssueBytes), IssueLineId = GuidHelper.ToGuidString(SourceIssueLineBytes), RequestedQty = 8, Reason = "Exact DEFAULT shortage" }, AdminId, WarehouseId);
        }
        private void SetAuthority(string mode, long version, string operationKey)
        {
            RequestContext.Mode = mode; RequestContext.ExpectedModeVersion = version; RequestContext.OperationKey = operationKey; RequestContext.Disposition = OperationDisposition.Retained;
        }

        public Task<SupplementalMaterialRequestDto> InvokeSupplementalAsync(string owner, SupplementalMaterialRequestDto? existing, string commandId) => owner switch
        {
            "create" => SupplementalService.CreateAsync(new CreateSupplementalMaterialRequest { CommandId = commandId, IssueId = GuidHelper.ToGuidString(SourceIssueBytes), IssueLineId = GuidHelper.ToGuidString(SourceIssueLineBytes), RequestedQty = 8, Reason = "Exact DEFAULT shortage" }, AdminId, WarehouseId),
            "fulfill" => SupplementalService.FulfillAsync(existing!.RequestId, new FulfillSupplementalMaterialRequest { CommandId = commandId, ExpectedVersion = existing.ConcurrencyVersion, Quantity = 3 }, AdminId, WarehouseId),
            "route" => SupplementalService.RouteToPurchasingAsync(existing!.RequestId, new RouteSupplementalMaterialRequestToPurchasing { CommandId = commandId, ExpectedVersion = existing.ConcurrencyVersion }, AdminId, WarehouseId),
            "reject" => SupplementalService.RejectAsync(existing!.RequestId, new RejectSupplementalMaterialRequest { CommandId = commandId, ExpectedVersion = existing.ConcurrencyVersion, Reason = "Warehouse rejects exact request" }, AdminId, WarehouseId),
            _ => throw new ArgumentOutOfRangeException(nameof(owner))
        };

        public async Task<LegacyLineageDispositionDto> CreateApprovedLegacyDispositionAsync()
        {
            SetAuthority(SystemOperationEligibility.Default, _modeVersion, "legacylineagedispositions.create");
            var created = await LegacyService.CreateAsync(new CreateLegacyLineageDispositionRequest { CommandId = "phase30-legacy-create", LegacyLineType = "ISSUE_LINE", LegacyLineId = GuidHelper.ToGuidString(LegacyIssueLineBytes), TargetLineId = GuidHelper.ToGuidString(MaterialRequestLineBytes), Reason = "Exact legacy source target" }, AdminId);
            SetAuthority(SystemOperationEligibility.Default, _modeVersion, "legacylineagedispositions.review");
            return await LegacyService.ReviewAsync(created.DispositionId, new ReviewLegacyLineageDispositionRequest { CommandId = "phase30-legacy-review", ExpectedVersion = created.Version, Approve = true, Reason = "Independent Manager reviewed exact source and target" }, ManagerId);
        }

        private async Task<SupplementalGeneratedScalars> CaptureSupplementalGeneratedScalarsAsync(string owner, SupplementalMaterialRequestDto result, string commandId)
        {
            Context.ChangeTracker.Clear();
            var requestId = GuidHelper.ParseGuidString(result.RequestId)!;
            var supplementalRequestedAt = await Context.Supplementalmaterialrequests.AsNoTracking()
                .Where(item => item.RequestId == requestId)
                .Select(item => item.RequestedAt)
                .SingleAsync();
            var businessAuditField = owner switch
            {
                "create" => "Create",
                "fulfill" => SupplementalMaterialRequestService.FulfillmentIssueAuditField,
                "route" => "PurchaseRequestId",
                "reject" => "Reject",
                _ => throw new ArgumentOutOfRangeException(nameof(owner))
            };
            var businessAudit = await Context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "SupplementalMaterial" && item.EntityId == requestId && item.FieldName == businessAuditField)
                .Select(item => new { item.AuditId, item.ChangedAt })
                .SingleAsync();
            var lifecycle = await CaptureLifecycleGeneratedScalarsAsync(commandId, "SupplementalMaterialRequest", result.RequestId);

            string? issueId = null;
            string? issueCode = null;
            string? issueLineId = null;
            string? issueCreatedAt = null;
            string? movementId = null;
            string? movementDate = null;
            string? stockLastUpdated = null;
            string? stockRowVersion = null;
            string? purchaseLineId = null;
            string? purchaseRequestDate = null;
            if (owner == "fulfill")
            {
                issueId = await Context.Auditlogs.AsNoTracking()
                    .Where(item => item.BusinessArea == "SupplementalMaterial" && item.EntityId == requestId && item.FieldName == SupplementalMaterialRequestService.FulfillmentIssueAuditField)
                    .Select(item => item.NewValue)
                    .SingleAsync();
                var issueBytes = GuidHelper.ParseGuidString(issueId!)!;
                var issue = await Context.Inventoryissues.AsNoTracking().Where(item => item.IssueId == issueBytes).Select(item => new { item.IssueCode, item.CreatedAt }).SingleAsync();
                issueCode = issue.IssueCode;
                issueCreatedAt = issue.CreatedAt.ToString("O");
                issueLineId = GuidHelper.ToGuidString(await Context.Inventoryissuelines.AsNoTracking().Where(item => item.IssueId == issueBytes).Select(item => item.IssueLineId).SingleAsync());
                var movement = await Context.Stockmovements.AsNoTracking()
                    .Where(item => item.RefTable == "supplementalmaterialrequests" && item.RefId == requestId && item.MovementType == "ISSUE")
                    .Select(item => new { item.MovementId, item.MovementDate })
                    .SingleAsync();
                movementId = GuidHelper.ToGuidString(movement.MovementId);
                movementDate = movement.MovementDate.ToString("O");
                var stock = await Context.Currentstocks.AsNoTracking()
                    .Where(item => item.WarehouseId == WarehouseBytes && item.IngredientId == IngredientBytes && item.UnitId == UnitBytes)
                    .Select(item => new { item.LastUpdated, item.RowVersion })
                    .SingleAsync();
                stockLastUpdated = stock.LastUpdated.ToString("O");
                stockRowVersion = stock.RowVersion.ToString("O");
            }
            else if (owner == "route")
            {
                var purchaseId = GuidHelper.ParseGuidString(result.PurchaseRequestId!)!;
                purchaseRequestDate = (await Context.Purchaserequests.AsNoTracking().Where(item => item.PurchaseRequestId == purchaseId).Select(item => item.RequestDate).SingleAsync()).ToString();
                purchaseLineId = GuidHelper.ToGuidString(await Context.Purchaserequestlines.AsNoTracking().Where(item => item.PurchaseRequestId == purchaseId).Select(item => item.PurchaseRequestLineId).SingleAsync());
            }

            return new SupplementalGeneratedScalars(
                supplementalRequestedAt.ToString("O"), GuidHelper.ToGuidString(businessAudit.AuditId), businessAudit.ChangedAt.ToString("O"), lifecycle,
                issueId, issueCode, issueLineId, issueCreatedAt, movementId, movementDate, stockLastUpdated, stockRowVersion, purchaseLineId, purchaseRequestDate);
        }

        private async Task<LifecycleGeneratedScalars> CaptureLifecycleGeneratedScalarsAsync(string commandId, string aggregateType, string aggregateId)
        {
            var aggregateBytes = GuidHelper.ParseGuidString(aggregateId)!;
            var transition = await Context.Lifecycletransitions.AsNoTracking().Where(item => item.CommandId == commandId && item.AggregateType == aggregateType && item.AggregateId == aggregateBytes)
                .Select(item => new { item.TransitionId, item.CreatedAt }).SingleAsync();
            var outbox = await Context.Lifecycleoutboxmessages.AsNoTracking().Where(item => item.CommandId == commandId && item.AggregateType == aggregateType && item.AggregateId == aggregateBytes)
                .Select(item => new { item.OutboxMessageId, item.CreatedAt }).SingleAsync();
            var receipt = await Context.Lifecyclecommandreceipts.AsNoTracking().Where(item => item.CommandId == commandId && item.AggregateType == aggregateType && item.AggregateId == aggregateBytes)
                .Select(item => new { item.CommandReceiptId, item.CreatedAt }).SingleAsync();
            var audit = await Context.Auditlogs.AsNoTracking().Where(item => item.BusinessArea == "Lifecycle" && item.EntityName == aggregateType && item.EntityId == aggregateBytes && item.CorrelationId == commandId)
                .Select(item => new { item.AuditId, item.ChangedAt }).SingleAsync();
            return new LifecycleGeneratedScalars(
                GuidHelper.ToGuidString(transition.TransitionId), transition.CreatedAt.ToString("O"),
                GuidHelper.ToGuidString(outbox.OutboxMessageId), outbox.CreatedAt.ToString("O"),
                GuidHelper.ToGuidString(receipt.CommandReceiptId), receipt.CreatedAt.ToString("O"),
                GuidHelper.ToGuidString(audit.AuditId), audit.ChangedAt.ToString("O"));
        }

        public async Task AssertSupplementalIntendedDeltaAsync(string owner, CompleteLedger before, CompleteLedger after, string expectedMode, SupplementalMaterialRequestDto? existing, SupplementalMaterialRequestDto result, string commandId)
        {
            var generated = await CaptureSupplementalGeneratedScalarsAsync(owner, result, commandId);
            result.ConcurrencyVersion.Should().Be(owner == "create" ? 1 : existing!.ConcurrencyVersion + 1);
            after.Mode.Should().Be(expectedMode, "the persisted operation mode must remain the exact resumed DEFAULT row");
            AssertUnchangedCommon(before, after);

            var requestId = result.RequestId;
            var oldStatus = owner == "create" ? null : existing!.Status;
            var newStatus = owner switch
            {
                "create" => "PENDING_WAREHOUSE_REVIEW",
                "fulfill" => "PARTIALLY_FULFILLED",
                "route" => "NEEDS_PURCHASE",
                "reject" => "REJECTED",
                _ => throw new ArgumentOutOfRangeException(nameof(owner))
            };
            result.Status.Should().Be(newStatus);
            if (owner != "create") result.RequestId.Should().Be(existing!.RequestId);

            var expectedSupplementals = owner == "create"
                ? AddExact(before.Supplementals, $"{requestId}|{result.RequestCode}|{result.IssueId}|{result.IssueLineId}|{result.WarehouseId}|{result.IngredientId}|{result.UnitId}|8.0|Exact DEFAULT shortage|PENDING_WAREHOUSE_REVIEW|{AdminId}|{generated.SupplementalRequestedAt}")
                : ReplaceField(before.Supplementals, requestId, 9, newStatus);
            AssertExactRows(expectedSupplementals, after.Supplementals, "supplemental requests");

            string reason;
            string field;
            string? auditNewValue;
            if (owner == "fulfill")
            {
                var issueId = generated.IssueId!;
                var issueCode = generated.IssueCode!;
                var issueRow = $"{issueId}|{issueCode}|8/30/2026|MORNING|{WarehouseId}|{GuidHelper.ToGuidString(MaterialRequestBytes)}|-|{AdminId}|-||{generated.IssueCreatedAt}";
                var lineRow = $"{generated.IssueLineId}|{issueId}|{GuidHelper.ToGuidString(IngredientBytes)}|{GuidHelper.ToGuidString(UnitBytes)}|{GuidHelper.ToGuidString(MaterialRequestLineBytes)}|-|3.0|3.0";
                AssertExactRows(AddExact(before.Issues, issueRow), after.Issues, "issues");
                AssertExactRows(AddExact(before.IssueLines, lineRow), after.IssueLines, "issue lines");
                AssertExactRows([$"{WarehouseId}|{GuidHelper.ToGuidString(IngredientBytes)}|{GuidHelper.ToGuidString(UnitBytes)}|2.0|{generated.StockLastUpdated}|{generated.StockRowVersion}"], after.Stocks, "stock");
                var movementRow = $"{generated.MovementId}|{generated.MovementDate}|{WarehouseId}|{GuidHelper.ToGuidString(IngredientBytes)}|{GuidHelper.ToGuidString(UnitBytes)}|ISSUE|supplementalmaterialrequests|{requestId}|0.0|3.0|5.0|2.0|-|||Cấp nguyên liệu bổ sung cho bếp|Yêu cầu {result.RequestCode}; phiếu xuất {issueCode}|{AdminId}";
                AssertExactRows(AddExact(before.Movements, movementRow), after.Movements, "movements");
                AssertExactRows(before.PurchaseRequests, after.PurchaseRequests, "purchase requests");
                AssertExactRows(before.PurchaseRequestLines, after.PurchaseRequestLines, "purchase request lines");
                field = SupplementalMaterialRequestService.FulfillmentIssueAuditField;
                auditNewValue = issueId;
                reason = $"Kho cấp 3 kg bằng phiếu {issueCode}.";
            }
            else if (owner == "route")
            {
                AssertExactRows(before.Issues, after.Issues, "issues");
                AssertExactRows(before.IssueLines, after.IssueLines, "issue lines");
                AssertExactRows(before.Stocks, after.Stocks, "stock");
                AssertExactRows(before.Movements, after.Movements, "movements");
                var purchaseId = result.PurchaseRequestId!;
                var purchaseCode = result.PurchaseRequestCode!;
                var headerRow = $"{purchaseId}|{purchaseCode}|{generated.PurchaseRequestDate}|8/30/2026|MORNING|DRAFT|{AdminId}|-|";
                var lineRow = $"{generated.PurchaseRequestLineId}|{purchaseId}|{GuidHelper.ToGuidString(MaterialRequestLineBytes)}|{GuidHelper.ToGuidString(IngredientBytes)}|-|{GuidHelper.ToGuidString(UnitBytes)}|8.0|5.0|3.0|0.0|||False";
                AssertExactRows(AddExact(before.PurchaseRequests, headerRow), after.PurchaseRequests, "purchase requests");
                AssertExactRows(AddExact(before.PurchaseRequestLines, lineRow), after.PurchaseRequestLines, "purchase request lines");
                field = "PurchaseRequestId";
                auditNewValue = purchaseId;
                reason = $"Kho chuyển 3.0 kg còn thiếu sang đề xuất {purchaseCode}.";
            }
            else
            {
                AssertExactRows(before.Issues, after.Issues, "issues");
                AssertExactRows(before.IssueLines, after.IssueLines, "issue lines");
                AssertExactRows(before.Stocks, after.Stocks, "stock");
                AssertExactRows(before.Movements, after.Movements, "movements");
                AssertExactRows(before.PurchaseRequests, after.PurchaseRequests, "purchase requests");
                AssertExactRows(before.PurchaseRequestLines, after.PurchaseRequestLines, "purchase request lines");
                field = owner == "create" ? "Create" : "Reject";
                auditNewValue = newStatus;
                reason = owner == "create" ? "Bếp gửi yêu cầu cấp nguyên liệu bổ sung tới kho." : "Warehouse rejects exact request";
            }

            var transitionReason = owner == "create" ? "Exact DEFAULT shortage" : reason;
            var response = JsonSerializer.Serialize(result);
            var sequence = owner == "create" ? 0 : checked((int)existing!.ConcurrencyVersion);
            var expectedVersion = owner == "create" ? 0 : existing!.ConcurrencyVersion;
            AssertExactRows(AddExact(before.Transitions, $"{generated.Lifecycle.TransitionId}|SupplementalMaterialRequest|{requestId}|{commandId}|{sequence}|{oldStatus}|{newStatus}|{AdminId}|{expectedVersion}|{transitionReason}|{commandId}||{response}|1|{generated.Lifecycle.TransitionCreatedAt}"), after.Transitions, "lifecycle transitions");
            AssertExactRows(AddExact(before.Outbox, $"{generated.Lifecycle.OutboxMessageId}|SupplementalMaterialRequest.Transitioned|SupplementalMaterialRequest|{requestId}|{sequence}|{commandId}|{response}|PENDING|0|||||{generated.Lifecycle.OutboxCreatedAt}"), after.Outbox, "lifecycle outbox");
            AssertExactRows(AddExact(before.Receipts, $"{generated.Lifecycle.CommandReceiptId}|{commandId}|SupplementalMaterialRequest|{requestId}|{response}|{generated.Lifecycle.CommandReceiptCreatedAt}"), after.Receipts, "command receipts");
            var businessAudit = $"{generated.BusinessAuditId}|{generated.BusinessAuditChangedAt}|{AdminId}|SupplementalMaterial|SupplementalMaterialRequest|{requestId}|{field}|{oldStatus}|{auditNewValue}|{reason}|";
            var lifecycleAudit = $"{generated.Lifecycle.AuditId}|{generated.Lifecycle.AuditChangedAt}|{AdminId}|Lifecycle|SupplementalMaterialRequest|{requestId}|Transition|{oldStatus}|{newStatus}|{transitionReason}|{commandId}";
            AssertExactRows(AddExact(before.Audits, businessAudit, lifecycleAudit), after.Audits, "audits");
        }

        public async Task AssertLegacyIntendedDeltaAsync(CompleteLedger before, CompleteLedger after, string expectedMode, LegacyLineageDispositionDto approved, LegacyLineageDispositionDto applied, string commandId)
        {
            var generated = await CaptureLifecycleGeneratedScalarsAsync(commandId, "LegacyLineageDisposition:ISSUE_LINE", GuidHelper.ToGuidString(LegacyIssueLineBytes));
            after.Mode.Should().Be(expectedMode, "the persisted operation mode must remain the exact resumed DEFAULT row");
            var dispositionBytes = GuidHelper.ParseGuidString(approved.DispositionId)!;
            var appliedAt = (await Context.Legacylinedispositions.AsNoTracking().Where(item => item.DispositionId == dispositionBytes).Select(item => item.AppliedAt).SingleAsync())!.Value.ToString("O");
            AssertExactRows(before.MaterialRequests, after.MaterialRequests, "material requests");
            AssertExactRows(before.MaterialRequestLines, after.MaterialRequestLines, "material request lines");
            AssertExactRows(before.Issues, after.Issues, "issues");
            AssertExactRows(ReplaceField(before.IssueLines, GuidHelper.ToGuidString(LegacyIssueLineBytes), 4, GuidHelper.ToGuidString(MaterialRequestLineBytes)), after.IssueLines, "issue lines");
            AssertExactRows(before.Returns, after.Returns, "returns");
            AssertExactRows(before.ReturnLines, after.ReturnLines, "return lines");
            AssertExactRows(before.Stocks, after.Stocks, "stock");
            AssertExactRows(before.Movements, after.Movements, "movements");
            AssertExactRows(before.Supplementals, after.Supplementals, "supplemental requests");
            AssertExactRows(before.PurchaseRequests, after.PurchaseRequests, "purchase requests");
            AssertExactRows(before.PurchaseRequestLines, after.PurchaseRequestLines, "purchase request lines");
            AssertExactRows(before.PurchaseOrders, after.PurchaseOrders, "purchase orders");
            AssertExactRows(before.PurchaseOrderLines, after.PurchaseOrderLines, "purchase order lines");
            AssertExactRows(before.Approvals, after.Approvals, "approvals");
            AssertExactRows(before.ReconciliationActuals, after.ReconciliationActuals, "reconciliation actuals");
            AssertExactRows(before.ReconciliationRevisions, after.ReconciliationRevisions, "reconciliation revisions");
            AssertExactRows(before.ReconciliationDispositions, after.ReconciliationDispositions, "reconciliation dispositions");
            AssertExactRows(before.OutboxDeliveries, after.OutboxDeliveries, "outbox deliveries");
            AssertExactRows(ReplaceFields(before.LegacyDispositions, approved.DispositionId,
                (5, "APPLIED"), (12, AdminId), (13, appliedAt), (14, (approved.Version + 1).ToString())), after.LegacyDispositions, "legacy dispositions");
            var response = JsonSerializer.Serialize(applied);
            var aggregateType = "LegacyLineageDisposition:ISSUE_LINE";
            var aggregateId = GuidHelper.ToGuidString(LegacyIssueLineBytes);
            const string reason = "Apply the exact Manager-reviewed target.";
            AssertExactRows(AddExact(before.Transitions, $"{generated.TransitionId}|{aggregateType}|{aggregateId}|{commandId}|{approved.Version + 1}|APPROVED|APPLIED|{AdminId}|{approved.Version}|{reason}|{commandId}||{response}|1|{generated.TransitionCreatedAt}"), after.Transitions, "lifecycle transitions");
            AssertExactRows(AddExact(before.Outbox, $"{generated.OutboxMessageId}|{aggregateType}.Transitioned|{aggregateType}|{aggregateId}|{approved.Version + 1}|{commandId}|{response}|PENDING|0|||||{generated.OutboxCreatedAt}"), after.Outbox, "lifecycle outbox");
            AssertExactRows(AddExact(before.Receipts, $"{generated.CommandReceiptId}|{commandId}|{aggregateType}|{aggregateId}|{response}|{generated.CommandReceiptCreatedAt}"), after.Receipts, "command receipts");
            AssertExactRows(AddExact(before.Audits, $"{generated.AuditId}|{generated.AuditChangedAt}|{AdminId}|Lifecycle|{aggregateType}|{aggregateId}|Transition|APPROVED|APPLIED|{reason}|{commandId}"), after.Audits, "audits");
        }

        private static void AssertUnchangedCommon(CompleteLedger before, CompleteLedger after)
        {
            AssertExactRows(before.MaterialRequests, after.MaterialRequests, "material requests");
            AssertExactRows(before.MaterialRequestLines, after.MaterialRequestLines, "material request lines");
            AssertExactRows(before.Returns, after.Returns, "returns");
            AssertExactRows(before.ReturnLines, after.ReturnLines, "return lines");
            AssertExactRows(before.PurchaseOrders, after.PurchaseOrders, "purchase orders");
            AssertExactRows(before.PurchaseOrderLines, after.PurchaseOrderLines, "purchase order lines");
            AssertExactRows(before.Approvals, after.Approvals, "approvals");
            AssertExactRows(before.ReconciliationActuals, after.ReconciliationActuals, "reconciliation actuals");
            AssertExactRows(before.ReconciliationRevisions, after.ReconciliationRevisions, "reconciliation revisions");
            AssertExactRows(before.ReconciliationDispositions, after.ReconciliationDispositions, "reconciliation dispositions");
            AssertExactRows(before.LegacyDispositions, after.LegacyDispositions, "legacy dispositions");
            AssertExactRows(before.OutboxDeliveries, after.OutboxDeliveries, "outbox deliveries");
        }

        public void AssertExactLedger(CompleteLedger expected, CompleteLedger actual) => Canonical(expected).Should().Be(Canonical(actual));
        private static void AssertExactRows(string[] expected, string[] actual, string ledger) => string.Join("\n", expected).Should().Be(string.Join("\n", actual), $"the complete {ledger} ledger must match exactly");
        private static string[] AddExact(string[] rows, params string[] additions) => rows.Concat(additions).OrderBy(item => item, StringComparer.Ordinal).ToArray();
        private static string[] ReplaceField(string[] rows, string rowId, int fieldIndex, string value)
        {
            var replaced = false;
            var result = rows.Select(row => { var fields = row.Split('|'); if (fields[0] != rowId) return row; replaced.Should().BeFalse(); replaced = true; fields[fieldIndex] = value; return string.Join('|', fields); }).OrderBy(item => item, StringComparer.Ordinal).ToArray();
            replaced.Should().BeTrue();
            return result;
        }
        private static string[] ReplaceFields(string[] rows, string rowId, params (int Index, string Value)[] replacements)
        {
            var replaced = false;
            var result = rows.Select(row =>
            {
                var fields = row.Split('|');
                if (fields[0] != rowId) return row;
                replaced.Should().BeFalse();
                replaced = true;
                foreach (var replacement in replacements) fields[replacement.Index] = replacement.Value;
                return string.Join('|', fields);
            }).OrderBy(item => item, StringComparer.Ordinal).ToArray();
            replaced.Should().BeTrue();
            return result;
        }
        private static string Canonical(CompleteLedger ledger) => JsonSerializer.Serialize(ledger);
        private static string NormalizePayload(string? payload) => payload ?? "-";

        public async Task<CompleteLedger> CaptureCompleteCommonLedgerAsync()
        {
            Context.ChangeTracker.Clear();
            var mode = await Context.Systemoperationmodes.AsNoTracking().SingleAsync();
            static string Id(byte[]? value) => value is null ? "-" : GuidHelper.ToGuidString(value);
            return new CompleteLedger(
                $"{mode.Id}|{mode.Mode}|{mode.Version}|{Id(mode.UpdatedBy)}|{mode.UpdatedAt:O}|{mode.Reason}",
                await Rows(Context.Materialrequests, item => $"{Id(item.RequestId)}|{item.RequestCode}|{Id(item.PlanId)}|{item.RequestDate}|{item.RequestScope}|{item.Status}|{Id(item.CreatedBy)}|{Id(item.ApprovedBy)}|{item.ApprovedAt:O}"),
                await Rows(Context.Materialrequestlines, item => $"{Id(item.RequestLineId)}|{Id(item.RequestId)}|{Id(item.PlanLineId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{Id(item.BomId)}|{item.PriceTierAmount}|{item.BomScope}|{item.TotalServings}|{item.GrossQtyPerServing}|{item.BomRatePercent}|{Id(item.AppliedPortionRuleId)}|{item.AppliedPortionRuleSource}|{item.AppliedPortionRatePercent}|{item.YieldLossPercent}|{item.TotalRequiredQty}|{item.CurrentStockQty}|{item.SuggestedPurchaseQty}"),
                await Rows(Context.Inventoryissues, item => $"{Id(item.IssueId)}|{item.IssueCode}|{item.IssueDate}|{item.ShiftName}|{Id(item.WarehouseId)}|{Id(item.MaterialRequestId)}|{Id(item.ReconciliationBatchId)}|{Id(item.IssuedBy)}|{Id(item.ReceivedBy)}|{item.ReceivedAt:O}|{item.CreatedAt:O}"),
                await Rows(Context.Inventoryissuelines, item => $"{Id(item.IssueLineId)}|{Id(item.IssueId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{Id(item.MaterialRequestLineId)}|{Id(item.ReconciliationBatchLineId)}|{item.RequestedQty}|{item.IssuedQty}"),
                await Rows(Context.Inventoryreturns, item => $"{Id(item.ReturnId)}|{item.ReturnCode}|{item.ReturnDate}|{item.ShiftName}|{item.ReturnType}|{Id(item.WarehouseId)}|{Id(item.IssueId)}|{item.Reason}|{Id(item.CreatedBy)}|{item.CreatedAt:O}|{Id(item.ReceivedBy)}|{item.ReceivedAt:O}"),
                await Rows(Context.Inventoryreturnlines, item => $"{Id(item.ReturnLineId)}|{Id(item.ReturnId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{Id(item.SourceIssueLineId)}|{item.Quantity}"),
                await Rows(Context.Currentstocks, item => $"{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.CurrentQty}|{item.LastUpdated:O}|{item.RowVersion:O}"),
                await Rows(Context.Stockmovements, item => $"{Id(item.MovementId)}|{item.MovementDate:O}|{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.MovementType}|{item.RefTable}|{Id(item.RefId)}|{item.QuantityIn}|{item.QuantityOut}|{item.BeforeQty}|{item.AfterQty}|{item.LotNumber ?? "-"}|{item.ManufactureDate}|{item.ExpiredDate}|{item.Reason}|{item.Note}|{Id(item.PerformedBy)}"),
                await Rows(Context.Supplementalmaterialrequests, item => $"{Id(item.RequestId)}|{item.RequestCode}|{Id(item.IssueId)}|{Id(item.IssueLineId)}|{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.RequestedQty}|{item.Reason}|{item.Status}|{Id(item.RequestedBy)}|{item.RequestedAt:O}"),
                await Rows(Context.Purchaserequests, item => $"{Id(item.PurchaseRequestId)}|{item.PurchaseRequestCode}|{item.RequestDate}|{item.PurchaseForDate}|{item.ShiftName}|{item.Status}|{Id(item.CreatedBy)}|{Id(item.ApprovedBy)}|{item.ApprovedAt:O}"),
                await Rows(Context.Purchaserequestlines, item => $"{Id(item.PurchaseRequestLineId)}|{Id(item.PurchaseRequestId)}|{Id(item.MaterialRequestLineId)}|{Id(item.IngredientId)}|{Id(item.SupplierId)}|{Id(item.UnitId)}|{item.RequiredQty}|{item.CurrentStockQty}|{item.PurchaseQty}|{item.EstimatedUnitPrice}|{item.ExpectedDeliveryDate}|{item.Note}|{item.IsLegacySupplierSnapshot}"),
                await Rows(Context.Purchaseorders, item => $"{Id(item.PurchaseOrderId)}|{item.PurchaseOrderCode}|{Id(item.PurchaseRequestId)}|{Id(item.SupplierId)}|{Id(item.ReceivingWarehouseId)}|{item.PurchasingTerms}|{item.ProposedDeliveryDate}|{item.OrderDate}|{item.Status}|{Id(item.CreatedBy)}|{item.CreatedAt:O}|{item.UpdatedAt:O}"),
                await Rows(Context.Purchaseorderlines, item => $"{Id(item.PurchaseOrderLineId)}|{Id(item.PurchaseOrderId)}|{Id(item.PurchaseRequestLineId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.OrderedQty}|{item.ReceivedQty}|{item.UnitPrice}"),
                await Rows(Context.Approvalhistories, item => $"{Id(item.ApprovalHistoryId)}|{item.TargetType}|{Id(item.TargetId)}|{item.Decision}|{item.OldStatus}|{item.NewStatus}|{item.Reason}|{Id(item.ActionBy)}|{item.ActionAt:O}"),
                await Rows(Context.Auditlogs.Where(item => item.BusinessArea != "SYSTEM_OPERATION"), item => $"{Id(item.AuditId)}|{item.ChangedAt:O}|{Id(item.ChangedBy)}|{item.BusinessArea}|{item.EntityName}|{Id(item.EntityId)}|{item.FieldName}|{item.OldValue}|{item.NewValue}|{item.Reason}|{item.CorrelationId}"),
                await Rows(Context.Reconciliationactuals, item => $"{Id(item.ActualId)}|{Id(item.BatchLineId)}|{item.Side}|{item.Quantity}|{item.Version}|{Id(item.EnteredBy)}|{item.EnteredAt:O}"),
                await Rows(Context.Reconciliationactualrevisions, item => $"{Id(item.RevisionId)}|{Id(item.ActualId)}|{item.OldQuantity}|{item.NewQuantity}|{item.Reason}|{Id(item.ChangedBy)}|{item.ChangedAt:O}"),
                await Rows(Context.Reconciliationdispositions, item => $"{Id(item.DispositionId)}|{Id(item.BatchLineId)}|{item.Category}|{item.Reason}|{item.Version}|{Id(item.DisposedBy)}|{item.DisposedAt:O}"),
                await Rows(Context.Legacylinedispositions, item => $"{Id(item.DispositionId)}|{item.LegacyLineType}|{Id(item.LegacyLineId)}|{Id(item.TargetMaterialRequestLineId)}|{Id(item.TargetIssueLineId)}|{item.Status}|{item.Reason}|{item.ReviewReason}|{Id(item.CreatedBy)}|{item.CreatedAt:O}|{Id(item.ReviewedBy)}|{item.ReviewedAt:O}|{Id(item.AppliedBy)}|{item.AppliedAt:O}|{item.Version}"),
                await Rows(Context.Lifecycletransitions, item => $"{Id(item.TransitionId)}|{item.AggregateType}|{Id(item.AggregateId)}|{item.CommandId}|{item.AggregateSequence}|{item.FromState}|{item.ToState}|{Id(item.ActorId)}|{item.ExpectedVersion}|{item.Reason}|{item.CorrelationId}|{item.CausationId}|{NormalizePayload(item.PayloadJson)}|{item.SchemaVersion}|{item.CreatedAt:O}"),
                await Rows(Context.Lifecycleoutboxmessages, item => $"{Id(item.OutboxMessageId)}|{item.EventType}|{item.AggregateType}|{Id(item.AggregateId)}|{item.AggregateSequence}|{item.CommandId}|{NormalizePayload(item.PayloadJson)}|{item.Status}|{item.AttemptCount}|{item.NextAttemptAt:O}|{item.LockedAt:O}|{item.ProcessedAt:O}|{item.LastError}|{item.CreatedAt:O}"),
                await Rows(Context.Lifecycleoutboxdeliveries, item => $"{Id(item.DeliveryId)}|{Id(item.OutboxMessageId)}|{item.ConsumerName}|{item.ProcessedAt:O}"),
                await Rows(Context.Lifecyclecommandreceipts, item => $"{Id(item.CommandReceiptId)}|{item.CommandId}|{item.AggregateType}|{Id(item.AggregateId)}|{NormalizePayload(item.ResponseJson)}|{item.CreatedAt:O}"));
        }

        private static async Task<string[]> Rows<TEntity>(DbSet<TEntity> set, Func<TEntity, string> project) where TEntity : class =>
            await Rows(set.AsQueryable(), project);
        private static async Task<string[]> Rows<TEntity>(IQueryable<TEntity> query, Func<TEntity, string> project) where TEntity : class =>
            (await query.AsNoTracking().ToListAsync()).Select(project).OrderBy(item => item, StringComparer.Ordinal).ToArray();

        public async ValueTask DisposeAsync() { await Context.DisposeAsync(); await _connection.DisposeAsync(); }
    }

    private sealed record OperationAuthority(string Mode, long Version, string OperationKey);

    // SupplementalMaterialRequest has no persisted concurrency/version column in the entity or EF schema.
    // Its public ConcurrencyVersion is lifecycle-derived, so the canonical row captures every persisted
    // supplemental scalar (including RequestedAt) without inventing a storage authority that does not exist.
    private sealed record LifecycleGeneratedScalars(
        string TransitionId,
        string TransitionCreatedAt,
        string OutboxMessageId,
        string OutboxCreatedAt,
        string CommandReceiptId,
        string CommandReceiptCreatedAt,
        string AuditId,
        string AuditChangedAt);

    private sealed record SupplementalGeneratedScalars(
        string SupplementalRequestedAt,
        string BusinessAuditId,
        string BusinessAuditChangedAt,
        LifecycleGeneratedScalars Lifecycle,
        string? IssueId,
        string? IssueCode,
        string? IssueLineId,
        string? IssueCreatedAt,
        string? MovementId,
        string? MovementDate,
        string? StockLastUpdated,
        string? StockRowVersion,
        string? PurchaseRequestLineId,
        string? PurchaseRequestDate);

    private sealed record CompleteLedger(string Mode, string[] MaterialRequests, string[] MaterialRequestLines, string[] Issues, string[] IssueLines, string[] Returns, string[] ReturnLines, string[] Stocks, string[] Movements, string[] Supplementals, string[] PurchaseRequests, string[] PurchaseRequestLines, string[] PurchaseOrders, string[] PurchaseOrderLines, string[] Approvals, string[] Audits, string[] ReconciliationActuals, string[] ReconciliationRevisions, string[] ReconciliationDispositions, string[] LegacyDispositions, string[] Transitions, string[] Outbox, string[] OutboxDeliveries, string[] Receipts);
}
