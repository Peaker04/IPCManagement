using System.Reflection;
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

        var inactive = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, $"freeze supplemental {owner}");
        fixture.SetAuthority(inactive, $"supplementalmaterialrequests.{owner}");
        var preInactive = await fixture.CaptureCompleteCommonLedgerAsync();

        var rejected = () => fixture.InvokeSupplementalAsync(owner, existing, commandId);
        await rejected.Should().ThrowAsync<BusinessRuleException>();
        var postRejection = await fixture.CaptureCompleteCommonLedgerAsync();
        postRejection.Should().BeEquivalentTo(preInactive);

        var resumed = await fixture.SwitchAsync(SystemOperationEligibility.Default, $"resume supplemental {owner}");
        fixture.SetAuthority(resumed, $"supplementalmaterialrequests.{owner}");
        var postSwitchBack = await fixture.CaptureCompleteCommonLedgerAsync();
        postSwitchBack.Should().BeEquivalentTo(postRejection, options => options.Excluding(item => item.Path == "Mode"));

        var result = await fixture.InvokeSupplementalAsync(owner, existing, commandId);
        var postSuccess = await fixture.CaptureCompleteCommonLedgerAsync();
        fixture.AssertSupplementalIntendedDelta(owner, preInactive, postSuccess, existing, result, commandId);

        var replay = await fixture.InvokeSupplementalAsync(owner, existing, commandId);
        replay.Should().BeEquivalentTo(result);
        var postReplay = await fixture.CaptureCompleteCommonLedgerAsync();
        postReplay.Should().BeEquivalentTo(postSuccess);
    }

    [Fact]
    public async Task LegacyApprovedDisposition_ApplyAsync_FreezesThenResumesSameReviewedCommandAndReplaysCanonically()
    {
        await using var fixture = await Fixture.CreateAsync();
        var approved = await fixture.CreateApprovedLegacyDispositionAsync();
        var commandId = "phase30-legacy-apply-same-command";

        var inactive = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "freeze approved legacy apply");
        fixture.SetAuthority(inactive, "legacylineagedispositions.apply");
        var preInactive = await fixture.CaptureCompleteCommonLedgerAsync();
        var rejected = () => fixture.LegacyService.ApplyAsync(approved.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = commandId,
            ExpectedVersion = approved.Version,
            Reason = "Apply the exact Manager-reviewed target."
        }, fixture.AdminId);
        await rejected.Should().ThrowAsync<BusinessRuleException>();
        var postRejection = await fixture.CaptureCompleteCommonLedgerAsync();
        postRejection.Should().BeEquivalentTo(preInactive);

        var resumed = await fixture.SwitchAsync(SystemOperationEligibility.Default, "resume approved legacy apply");
        fixture.SetAuthority(resumed, "legacylineagedispositions.apply");
        var postSwitchBack = await fixture.CaptureCompleteCommonLedgerAsync();
        postSwitchBack.Should().BeEquivalentTo(postRejection, options => options.Excluding(item => item.Path == "Mode"));

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
        postSuccess.LegacyDispositions.Should().HaveSameCount(preInactive.LegacyDispositions);
        postSuccess.IssueLines.Should().NotBeEquivalentTo(preInactive.IssueLines);
        postSuccess.Transitions.Should().HaveCount(preInactive.Transitions.Length + 1);
        postSuccess.Outbox.Should().HaveCount(preInactive.Outbox.Length + 1);
        postSuccess.Receipts.Should().HaveCount(preInactive.Receipts.Length + 1);
        postSuccess.Issues.Should().BeEquivalentTo(preInactive.Issues);
        postSuccess.Returns.Should().BeEquivalentTo(preInactive.Returns);
        postSuccess.Movements.Should().BeEquivalentTo(preInactive.Movements);

        var replay = await fixture.LegacyService.ApplyAsync(approved.DispositionId, new ApplyLegacyLineageDispositionRequest
        {
            CommandId = commandId,
            ExpectedVersion = approved.Version,
            Reason = "Apply the exact Manager-reviewed target."
        }, fixture.AdminId);
        replay.Should().BeEquivalentTo(applied);
        (await fixture.CaptureCompleteCommonLedgerAsync()).Should().BeEquivalentTo(postSuccess);
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
        public void SetAuthority(SystemOperationModeDto mode, string operationKey)
        {
            RequestContext.Mode = mode.Mode;
            RequestContext.ExpectedModeVersion = mode.Version;
            RequestContext.OperationKey = operationKey;
            RequestContext.Disposition = OperationDisposition.Retained;
        }

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

        public void AssertSupplementalIntendedDelta(string owner, CompleteLedger before, CompleteLedger after, SupplementalMaterialRequestDto? existing, SupplementalMaterialRequestDto result, string commandId)
        {
            result.ConcurrencyVersion.Should().Be(owner == "create" ? 1 : existing!.ConcurrencyVersion + 1);
            after.Returns.Should().BeEquivalentTo(before.Returns);
            after.ReturnLines.Should().BeEquivalentTo(before.ReturnLines);
            after.Approvals.Should().BeEquivalentTo(before.Approvals);
            after.ReconciliationActuals.Should().BeEquivalentTo(before.ReconciliationActuals);
            after.ReconciliationRevisions.Should().BeEquivalentTo(before.ReconciliationRevisions);
            after.ReconciliationDispositions.Should().BeEquivalentTo(before.ReconciliationDispositions);
            after.Receipts.Should().HaveCount(before.Receipts.Length + 1);
            after.Transitions.Should().HaveCount(before.Transitions.Length + 1);
            after.Outbox.Should().HaveCount(before.Outbox.Length + 1);
            after.Receipts.Should().ContainSingle(item => item.Contains(commandId, StringComparison.Ordinal));
            if (owner == "create")
            {
                after.Supplementals.Should().HaveCount(before.Supplementals.Length + 1);
                after.Issues.Should().BeEquivalentTo(before.Issues);
                after.PurchaseRequests.Should().BeEquivalentTo(before.PurchaseRequests);
                after.Movements.Should().BeEquivalentTo(before.Movements);
            }
            else
            {
                result.RequestId.Should().Be(existing!.RequestId);
                after.Supplementals.Should().HaveSameCount(before.Supplementals);
            }
            if (owner == "fulfill")
            {
                result.Status.Should().Be("PARTIALLY_FULFILLED");
                after.Issues.Should().HaveCount(before.Issues.Length + 1);
                after.IssueLines.Should().HaveCount(before.IssueLines.Length + 1);
                after.Movements.Should().HaveCount(before.Movements.Length + 1);
                after.Movements.Should().ContainSingle(item => item.Contains("|ISSUE|supplementalmaterialrequests|", StringComparison.Ordinal) && item.Contains(result.RequestId, StringComparison.Ordinal));
                after.Stocks.Should().NotBeEquivalentTo(before.Stocks);
            }
            else if (owner == "route")
            {
                result.Status.Should().Be("NEEDS_PURCHASE");
                after.PurchaseRequests.Should().HaveCount(before.PurchaseRequests.Length + 1);
                after.PurchaseRequestLines.Should().HaveCount(before.PurchaseRequestLines.Length + 1);
                after.PurchaseRequestLines.Should().ContainSingle(item => item.Contains(GuidHelper.ToGuidString(MaterialRequestLineBytes), StringComparison.Ordinal));
                after.Stocks.Should().BeEquivalentTo(before.Stocks);
                after.Movements.Should().BeEquivalentTo(before.Movements);
            }
            else if (owner == "reject")
            {
                result.Status.Should().Be("REJECTED");
                after.Issues.Should().BeEquivalentTo(before.Issues);
                after.PurchaseRequests.Should().BeEquivalentTo(before.PurchaseRequests);
                after.Stocks.Should().BeEquivalentTo(before.Stocks);
                after.Movements.Should().BeEquivalentTo(before.Movements);
            }
        }

        public async Task<CompleteLedger> CaptureCompleteCommonLedgerAsync()
        {
            Context.ChangeTracker.Clear();
            var mode = await Context.Systemoperationmodes.AsNoTracking().SingleAsync();
            static string Id(byte[]? value) => value is null ? "-" : GuidHelper.ToGuidString(value);
            return new CompleteLedger(
                $"{mode.Mode}|{mode.Version}",
                await Rows(Context.Materialrequests, item => $"{Id(item.RequestId)}|{item.RequestCode}|{Id(item.PlanId)}|{item.RequestScope}|{item.Status}|{Id(item.CreatedBy)}"),
                await Rows(Context.Materialrequestlines, item => $"{Id(item.RequestLineId)}|{Id(item.RequestId)}|{Id(item.PlanLineId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.TotalRequiredQty}|{item.CurrentStockQty}|{item.SuggestedPurchaseQty}"),
                await Rows(Context.Inventoryissues, item => $"{Id(item.IssueId)}|{item.IssueCode}|{item.IssueDate}|{item.ShiftName}|{Id(item.WarehouseId)}|{Id(item.MaterialRequestId)}|{Id(item.ReconciliationBatchId)}|{Id(item.IssuedBy)}|{Id(item.ReceivedBy)}|{item.ReceivedAt:O}"),
                await Rows(Context.Inventoryissuelines, item => $"{Id(item.IssueLineId)}|{Id(item.IssueId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{Id(item.MaterialRequestLineId)}|{Id(item.ReconciliationBatchLineId)}|{item.RequestedQty}|{item.IssuedQty}"),
                await Rows(Context.Inventoryreturns, item => $"{Id(item.ReturnId)}|{item.ReturnCode}|{item.ReturnDate}|{item.ReturnType}|{Id(item.WarehouseId)}|{Id(item.IssueId)}|{Id(item.CreatedBy)}|{Id(item.ReceivedBy)}|{item.ReceivedAt:O}"),
                await Rows(Context.Inventoryreturnlines, item => $"{Id(item.ReturnLineId)}|{Id(item.ReturnId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{Id(item.SourceIssueLineId)}|{item.Quantity}"),
                await Rows(Context.Currentstocks, item => $"{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.CurrentQty}|{item.LastUpdated:O}|{item.RowVersion:O}"),
                await Rows(Context.Stockmovements, item => $"{Id(item.MovementId)}|{item.MovementDate:O}|{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.MovementType}|{item.RefTable}|{Id(item.RefId)}|{item.QuantityIn}|{item.QuantityOut}|{item.BeforeQty}|{item.AfterQty}|{Id(item.PerformedBy)}"),
                await Rows(Context.Supplementalmaterialrequests, item => $"{Id(item.RequestId)}|{item.RequestCode}|{Id(item.IssueId)}|{Id(item.IssueLineId)}|{Id(item.WarehouseId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.RequestedQty}|{item.Reason}|{item.Status}|{Id(item.RequestedBy)}|{item.RequestedAt:O}"),
                await Rows(Context.Purchaserequests, item => $"{Id(item.PurchaseRequestId)}|{item.PurchaseRequestCode}|{item.RequestDate}|{item.PurchaseForDate}|{item.ShiftName}|{item.Status}|{Id(item.CreatedBy)}|{Id(item.ApprovedBy)}"),
                await Rows(Context.Purchaserequestlines, item => $"{Id(item.PurchaseRequestLineId)}|{Id(item.PurchaseRequestId)}|{Id(item.MaterialRequestLineId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.RequiredQty}|{item.CurrentStockQty}|{item.PurchaseQty}"),
                await Rows(Context.Purchaseorders, item => $"{Id(item.PurchaseOrderId)}|{item.PurchaseOrderCode}|{Id(item.PurchaseRequestId)}|{Id(item.SupplierId)}|{Id(item.ReceivingWarehouseId)}|{item.Status}"),
                await Rows(Context.Purchaseorderlines, item => $"{Id(item.PurchaseOrderLineId)}|{Id(item.PurchaseOrderId)}|{Id(item.PurchaseRequestLineId)}|{Id(item.IngredientId)}|{Id(item.UnitId)}|{item.OrderedQty}|{item.ReceivedQty}"),
                await Rows(Context.Approvalhistories, item => $"{Id(item.ApprovalHistoryId)}|{item.TargetType}|{Id(item.TargetId)}|{item.Decision}|{item.OldStatus}|{item.NewStatus}|{Id(item.ActionBy)}"),
                await Rows(Context.Auditlogs.Where(item => item.BusinessArea != "SYSTEM_OPERATION"), item => $"{Id(item.AuditId)}|{item.ChangedAt:O}|{Id(item.ChangedBy)}|{item.BusinessArea}|{item.EntityName}|{Id(item.EntityId)}|{item.FieldName}|{item.OldValue}|{item.NewValue}|{item.Reason}|{item.CorrelationId}"),
                await Rows(Context.Reconciliationactuals, item => $"{Id(item.ActualId)}|{Id(item.BatchLineId)}|{item.Side}|{item.Quantity}|{item.Version}|{Id(item.EnteredBy)}"),
                await Rows(Context.Reconciliationactualrevisions, item => $"{Id(item.RevisionId)}|{Id(item.ActualId)}|{item.OldQuantity}|{item.NewQuantity}|{item.Reason}|{Id(item.ChangedBy)}"),
                await Rows(Context.Reconciliationdispositions, item => $"{Id(item.DispositionId)}|{Id(item.BatchLineId)}|{item.Category}|{item.Reason}|{item.Version}|{Id(item.DisposedBy)}"),
                await Rows(Context.Legacylinedispositions, item => $"{Id(item.DispositionId)}|{item.LegacyLineType}|{Id(item.LegacyLineId)}|{Id(item.TargetMaterialRequestLineId)}|{Id(item.TargetIssueLineId)}|{item.Status}|{item.Reason}|{item.ReviewReason}|{Id(item.CreatedBy)}|{Id(item.ReviewedBy)}|{Id(item.AppliedBy)}|{item.Version}"),
                await Rows(Context.Lifecycletransitions, item => $"{Id(item.TransitionId)}|{item.AggregateType}|{Id(item.AggregateId)}|{item.CommandId}|{item.AggregateSequence}|{item.FromState}|{item.ToState}|{Id(item.ActorId)}|{item.ExpectedVersion}|{item.PayloadJson}"),
                await Rows(Context.Lifecycleoutboxmessages, item => $"{Id(item.OutboxMessageId)}|{item.AggregateType}|{Id(item.AggregateId)}|{item.CommandId}|{item.AggregateSequence}|{item.Status}|{item.PayloadJson}"),
                await Rows(Context.Lifecycleoutboxdeliveries, item => $"{Id(item.DeliveryId)}|{Id(item.OutboxMessageId)}|{item.ConsumerName}|{item.ProcessedAt:O}"),
                await Rows(Context.Lifecyclecommandreceipts, item => $"{Id(item.CommandReceiptId)}|{item.CommandId}|{item.AggregateType}|{Id(item.AggregateId)}|{item.ResponseJson}"));
        }

        private static async Task<string[]> Rows<TEntity>(DbSet<TEntity> set, Func<TEntity, string> project) where TEntity : class =>
            await Rows(set.AsQueryable(), project);
        private static async Task<string[]> Rows<TEntity>(IQueryable<TEntity> query, Func<TEntity, string> project) where TEntity : class =>
            (await query.AsNoTracking().ToListAsync()).Select(project).OrderBy(item => item, StringComparer.Ordinal).ToArray();

        public async ValueTask DisposeAsync() { await Context.DisposeAsync(); await _connection.DisposeAsync(); }
    }

    private sealed record CompleteLedger(string Mode, string[] MaterialRequests, string[] MaterialRequestLines, string[] Issues, string[] IssueLines, string[] Returns, string[] ReturnLines, string[] Stocks, string[] Movements, string[] Supplementals, string[] PurchaseRequests, string[] PurchaseRequestLines, string[] PurchaseOrders, string[] PurchaseOrderLines, string[] Approvals, string[] Audits, string[] ReconciliationActuals, string[] ReconciliationRevisions, string[] ReconciliationDispositions, string[] LegacyDispositions, string[] Transitions, string[] Outbox, string[] OutboxDeliveries, string[] Receipts);
}
