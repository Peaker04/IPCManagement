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
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Reflection;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveDefaultInventoryOwnerTests
{
    [Fact]
    public async Task Issue_CreateAndReceipt_FreezeCompleteLedgerThenResumeOriginalIdentityOnce()
    {
        await using var fixture = await Fixture.CreateAsync(receivedIssue: false);
        var create = fixture.CreateIssueCommand("phase30-default-issue-create");

        var inactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT issue creation.");
        fixture.SetRequestAuthority(inactiveAuthority, "inventoryissues.createasync");
        var beforeCreate = await fixture.CaptureAsync();

        var inactiveCreate = () => fixture.IssueService.CreateAsync(create, fixture.ActorId);
        await inactiveCreate.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*chế độ DEFAULT*");
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeCreate);

        var defaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT issue creation.");
        fixture.SetRequestAuthority(defaultAuthority, "inventoryissues.createasync");
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeCreate, options => options.Excluding(item => item.Mode).Excluding(item => item.ModeVersion));

        var created = await fixture.IssueService.CreateAsync(create, fixture.ActorId);
        var replay = await fixture.IssueService.CreateAsync(create, fixture.ActorId);
        replay!.IssueId.Should().Be(created!.IssueId);
        var afterCreate = await fixture.CaptureAsync();
        afterCreate.IssueIds.Should().ContainSingle().Which.Should().Be(created.IssueId);
        afterCreate.IssueParentIds.Should().ContainSingle().Which.Should().Be(fixture.MaterialRequestId);
        afterCreate.IssueLineageIds.Should().ContainSingle().Which.Should().Be(fixture.MaterialRequestLineId);
        afterCreate.StockQuantity.Should().Be(15m);
        afterCreate.IssueMovements.Should().Be(1);
        afterCreate.Transitions.Should().Be(1);
        afterCreate.Outbox.Should().Be(1);
        afterCreate.Receipts.Should().Be(1);

        var receiptInactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT issue receipt.");
        fixture.SetRequestAuthority(receiptInactiveAuthority, "inventoryissues.confirmreceiptasync");
        var beforeReceipt = await fixture.CaptureAsync();
        var inactiveReceipt = () => fixture.IssueService.ConfirmReceiptAsync(
            created.IssueId,
            new ConfirmInventoryIssueReceiptRequest(),
            fixture.ActorId);
        await inactiveReceipt.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeReceipt);

        var receiptDefaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT issue receipt.");
        fixture.SetRequestAuthority(receiptDefaultAuthority, "inventoryissues.confirmreceiptasync");
        var confirmed = await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, new ConfirmInventoryIssueReceiptRequest(), fixture.ActorId);
        var confirmedReplay = await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, new ConfirmInventoryIssueReceiptRequest(), fixture.ActorId);

        confirmed!.IssueId.Should().Be(created.IssueId);
        confirmedReplay!.IssueId.Should().Be(created.IssueId);
        var afterReceipt = await fixture.CaptureAsync();
        afterReceipt.IssueIds.Should().Equal(afterCreate.IssueIds);
        afterReceipt.ReceivedIssueIds.Should().ContainSingle().Which.Should().Be(created.IssueId);
        afterReceipt.StockQuantity.Should().Be(afterCreate.StockQuantity);
        afterReceipt.IssueMovements.Should().Be(afterCreate.IssueMovements);
        afterReceipt.Audits.Should().Be(afterCreate.Audits + 1);
        afterReceipt.Transitions.Should().Be(afterCreate.Transitions);
        afterReceipt.Outbox.Should().Be(afterCreate.Outbox);
        afterReceipt.Receipts.Should().Be(afterCreate.Receipts);
    }

    [Fact]
    public async Task Return_CreateAndReceipt_FreezeCompleteLedgerThenResumeOriginalIdentityOnce()
    {
        await using var fixture = await Fixture.CreateAsync(receivedIssue: true);
        var create = fixture.CreateReturnCommand("phase30-default-return-create");

        var inactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT return creation.");
        fixture.SetRequestAuthority(inactiveAuthority, "inventoryreturns.createasync");
        var beforeCreate = await fixture.CaptureAsync();
        var inactiveCreate = () => fixture.ReturnService.CreateAsync(create, fixture.ActorId);
        await inactiveCreate.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeCreate);

        var defaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT return creation.");
        fixture.SetRequestAuthority(defaultAuthority, "inventoryreturns.createasync");
        var created = await fixture.ReturnService.CreateAsync(create, fixture.ActorId);
        var replay = await fixture.ReturnService.CreateAsync(create, fixture.ActorId);

        replay!.ReturnId.Should().Be(created!.ReturnId);
        var afterCreate = await fixture.CaptureAsync();
        afterCreate.ReturnIds.Should().ContainSingle().Which.Should().Be(created.ReturnId);
        afterCreate.ReturnParentIds.Should().ContainSingle().Which.Should().Be(fixture.IssueId);
        afterCreate.ReturnSourceLineIds.Should().ContainSingle().Which.Should().Be(fixture.IssueLineId);
        afterCreate.StockQuantity.Should().Be(20m);
        afterCreate.ReturnMovements.Should().Be(0);
        afterCreate.Transitions.Should().Be(1);
        afterCreate.Outbox.Should().Be(1);
        afterCreate.Receipts.Should().Be(1);

        var receiptInactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT return receipt.");
        fixture.SetRequestAuthority(receiptInactiveAuthority, "inventoryreturns.confirmreceiptasync");
        var beforeReceipt = await fixture.CaptureAsync();
        var confirmation = new ConfirmInventoryReturnReceiptRequest
        {
            CommandId = "phase30-default-return-confirm",
            ExpectedVersion = 0,
        };
        var inactiveReceipt = () => fixture.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId);
        await inactiveReceipt.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeReceipt);

        var receiptDefaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT return receipt.");
        fixture.SetRequestAuthority(receiptDefaultAuthority, "inventoryreturns.confirmreceiptasync");
        (await fixture.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId)).Should().BeTrue();
        (await fixture.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId)).Should().BeTrue();

        var afterReceipt = await fixture.CaptureAsync();
        afterReceipt.ReturnIds.Should().Equal(afterCreate.ReturnIds);
        afterReceipt.ReceivedReturnIds.Should().ContainSingle().Which.Should().Be(created.ReturnId);
        afterReceipt.StockQuantity.Should().Be(22m);
        afterReceipt.ReturnMovements.Should().Be(1);
        afterReceipt.ReturnMovementRefIds.Should().ContainSingle().Which.Should().Be(created.ReturnId);
        afterReceipt.DefaultNetIssued.Should().Be(3m);
        afterReceipt.ReconciliationNetIssued.Should().Be(0m);
        afterReceipt.Transitions.Should().Be(afterCreate.Transitions + 1);
        afterReceipt.Outbox.Should().Be(afterCreate.Outbox + 1);
        afterReceipt.Receipts.Should().Be(afterCreate.Receipts + 1);
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
            var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
            warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(WarehouseBytes);
            var issueRepository = new InventoryIssueRepository(context);
            var runner = new EfTransactionRunner(context, RequestContext, Guard);
            var unitOfWork = new UnitOfWork(context);
            var stockLedger = new StockLedgerService(new CurrentStockRepository(context), new StockMovementRepository(context));
            IssueService = new InventoryIssueService(issueRepository, unitOfWork, stockLedger, runner, warehouseResolver, context, RequestContext);
            ReturnService = new InventoryReturnService(new InventoryReturnRepository(context), issueRepository, unitOfWork, stockLedger, runner, warehouseResolver, context, RequestContext);
        }

        public IpcManagementContext Context { get; }
        public SystemOperationRequestContext RequestContext { get; }
        public SystemOperationModeGuard Guard { get; }
        public SystemOperationModeService ModeService { get; }
        public InventoryIssueService IssueService { get; }
        public InventoryReturnService ReturnService { get; }

        public byte[] ActorBytes { get; } = GuidHelper.NewId();
        public byte[] WarehouseBytes { get; } = GuidHelper.NewId();
        public byte[] IngredientBytes { get; } = GuidHelper.NewId();
        public byte[] UnitBytes { get; } = GuidHelper.NewId();
        public byte[] MaterialRequestBytes { get; } = GuidHelper.NewId();
        public byte[] MaterialRequestLineBytes { get; } = GuidHelper.NewId();
        public byte[] IssueBytes { get; } = GuidHelper.NewId();
        public byte[] IssueLineBytes { get; } = GuidHelper.NewId();

        public string ActorId => GuidHelper.ToGuidString(ActorBytes);
        public string MaterialRequestId => GuidHelper.ToGuidString(MaterialRequestBytes);
        public string MaterialRequestLineId => GuidHelper.ToGuidString(MaterialRequestLineBytes);
        public string IssueId => GuidHelper.ToGuidString(IssueBytes);
        public string IssueLineId => GuidHelper.ToGuidString(IssueLineBytes);

        public static async Task<Fixture> CreateAsync(bool receivedIssue)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var workflowFixtureType = typeof(WorkflowGenerationTests).GetNestedType("WorkflowFixture", BindingFlags.NonPublic)
                ?? throw new InvalidOperationException("Workflow SQLite fixture type was not found.");
            var createSchema = workflowFixtureType.GetMethod("CreateMinimalWorkflowSchemaAsync", BindingFlags.NonPublic | BindingFlags.Static)
                ?? throw new InvalidOperationException("Workflow SQLite schema helper was not found.");
            await (Task)(createSchema.Invoke(null, [connection])
                ?? throw new InvalidOperationException("Workflow SQLite schema helper did not return a task."));
            await using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    CREATE TABLE systemoperationmodes (
                        id INTEGER PRIMARY KEY,
                        mode TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        updatedAt TEXT NOT NULL,
                        updatedBy BLOB NOT NULL,
                        reason TEXT NULL
                    );
                    CREATE TABLE reconciliationbatches (
                        batchId BLOB PRIMARY KEY,
                        status TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationactuals (
                        actualId BLOB PRIMARY KEY,
                        batchLineId BLOB NOT NULL,
                        side TEXT NOT NULL,
                        quantity TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        updatedBy BLOB NOT NULL,
                        updatedAt TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationactualrevisions (
                        revisionId BLOB PRIMARY KEY,
                        actualId BLOB NOT NULL,
                        version INTEGER NOT NULL,
                        quantity TEXT NOT NULL,
                        changedBy BLOB NOT NULL,
                        changedAt TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationdispositions (
                        dispositionId BLOB PRIMARY KEY,
                        batchLineId BLOB NOT NULL,
                        category TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        updatedBy BLOB NOT NULL,
                        updatedAt TEXT NOT NULL
                    );
                    """;
                await command.ExecuteNonQueryAsync();
            }
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
            var context = new IpcManagementContext(options);
            var fixture = new Fixture(connection, context);
            await fixture.SeedAsync(receivedIssue);
            return fixture;
        }

        private async Task SeedAsync(bool receivedIssue)
        {
            var role = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
            Context.AddRange(
                role,
                new User
                {
                    UserId = ActorBytes,
                    RoleId = role.RoleId,
                    Username = $"phase30-{Guid.NewGuid():N}",
                    FullName = "Phase 30 inventory owner",
                    PasswordHash = "test-only",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                },
                new Unit { UnitId = UnitBytes, UnitCode = "KG", UnitName = "kg", ConvertRateToBase = 1 },
                new Warehouse { WarehouseId = WarehouseBytes, WarehouseCode = "P30", WarehouseName = "Phase 30", WarehouseType = "MAIN", IsOperationalActive = true },
                new Ingredient
                {
                    IngredientId = IngredientBytes,
                    IngredientCode = "P30-ING",
                    IngredientName = "Phase 30 ingredient",
                    UnitId = UnitBytes,
                    WarehouseId = WarehouseBytes,
                    ReferencePrice = 1,
                    IsActive = true,
                },
                new MaterialRequest
                {
                    RequestId = MaterialRequestBytes,
                    RequestCode = "MR-P30-DEFAULT-OWNER",
                    PlanId = GuidHelper.NewId(),
                    RequestDate = new DateOnly(2026, 8, 30),
                    RequestScope = "FULLDAY",
                    Status = "APPROVED",
                    CreatedBy = ActorBytes,
                    Materialrequestlines =
                    [
                        new MaterialRequestLine
                        {
                            RequestLineId = MaterialRequestLineBytes,
                            PlanLineId = GuidHelper.NewId(),
                            IngredientId = IngredientBytes,
                            UnitId = UnitBytes,
                            TotalServings = 1,
                            GrossQtyPerServing = 5,
                            BomRatePercent = 100,
                            AppliedPortionRuleSource = "TEST",
                            AppliedPortionRatePercent = 100,
                            TotalRequiredQty = 5,
                            CurrentStockQty = 20,
                            SuggestedPurchaseQty = 0,
                            Ingredient = null!,
                            Unit = null!,
                        }
                    ]
                },
                new CurrentStock
                {
                    WarehouseId = WarehouseBytes,
                    IngredientId = IngredientBytes,
                    UnitId = UnitBytes,
                    CurrentQty = 20,
                    LastUpdated = DateTime.UtcNow,
                },
                new SystemOperationMode
                {
                    Id = 1,
                    Mode = SystemOperationEligibility.Default,
                    Version = 1,
                    UpdatedAt = DateTime.UtcNow,
                    UpdatedBy = ActorBytes,
                });

            if (receivedIssue)
            {
                Context.Inventoryissues.Add(new InventoryIssue
                {
                    IssueId = IssueBytes,
                    IssueCode = "ISS-P30-DEFAULT-OWNER",
                    IssueDate = new DateOnly(2026, 8, 30),
                    WarehouseId = WarehouseBytes,
                    MaterialRequestId = MaterialRequestBytes,
                    IssuedBy = ActorBytes,
                    ReceivedBy = ActorBytes,
                    ReceivedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines =
                    [
                        new InventoryIssueLine
                        {
                            IssueLineId = IssueLineBytes,
                            IngredientId = IngredientBytes,
                            UnitId = UnitBytes,
                            MaterialRequestLineId = MaterialRequestLineBytes,
                            RequestedQty = 5,
                            IssuedQty = 5,
                        }
                    ]
                });
            }

            await Context.SaveChangesAsync();
            _modeVersion = 1;
        }

        public CreateInventoryIssueRequest CreateIssueCommand(string commandId) => new()
        {
            CommandId = commandId,
            ExpectedVersion = 0,
            IssueDate = new DateOnly(2026, 8, 30),
            WarehouseId = GuidHelper.ToGuidString(WarehouseBytes),
            MaterialRequestId = MaterialRequestId,
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    MaterialRequestLineId = MaterialRequestLineId,
                    IngredientId = GuidHelper.ToGuidString(IngredientBytes),
                    UnitId = GuidHelper.ToGuidString(UnitBytes),
                    RequestedQty = 5,
                    IssuedQty = 5,
                }
            ]
        };

        public CreateInventoryReturnRequest CreateReturnCommand(string commandId) => new()
        {
            CommandId = commandId,
            ReturnDate = new DateOnly(2026, 8, 30),
            ReturnType = "RETURN",
            WarehouseId = GuidHelper.ToGuidString(WarehouseBytes),
            IssueId = IssueId,
            Reason = "Return exact DEFAULT source quantity.",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = IssueLineId,
                    IngredientId = GuidHelper.ToGuidString(IngredientBytes),
                    UnitId = GuidHelper.ToGuidString(UnitBytes),
                    Quantity = 2,
                }
            ]
        };

        public async Task<SystemOperationModeDto> SwitchAsync(string mode, string reason)
        {
            var changed = await ModeService.ChangeAsync(new ChangeSystemOperationModeRequest(mode, _modeVersion, true, reason), ActorId);
            _modeVersion = changed.Version;
            return changed;
        }

        public void SetRequestAuthority(SystemOperationModeDto authority, string operationKey)
        {
            RequestContext.Mode = authority.Mode;
            RequestContext.ExpectedModeVersion = authority.Version;
            RequestContext.OperationKey = operationKey;
            RequestContext.Disposition = OperationDisposition.Retained;
        }

        public async Task<Ledger> CaptureAsync()
        {
            Context.ChangeTracker.Clear();
            var mode = await Context.Systemoperationmodes.AsNoTracking().SingleAsync();
            var issues = await Context.Inventoryissues.AsNoTracking().OrderBy(item => item.IssueCode).ToListAsync();
            var issueLines = await Context.Inventoryissuelines.AsNoTracking().OrderBy(item => item.IssueLineId).ToListAsync();
            var returns = await Context.Inventoryreturns.AsNoTracking().OrderBy(item => item.ReturnCode).ToListAsync();
            var returnLines = await Context.Inventoryreturnlines.AsNoTracking().OrderBy(item => item.ReturnLineId).ToListAsync();
            var stock = await Context.Currentstocks.AsNoTracking().SingleAsync();
            var movements = await Context.Stockmovements.AsNoTracking().OrderBy(item => item.MovementDate).ToListAsync();
            var defaultIssued = issueLines.Where(item => item.MaterialRequestLineId is not null).Sum(item => item.IssuedQty);
            var defaultReturned = returnLines.Where(line => issueLines.Any(issueLine => issueLine.IssueLineId.SequenceEqual(line.SourceIssueLineId ?? []))).Sum(item => item.Quantity);
            var reconciliationIssued = issueLines.Where(item => item.ReconciliationBatchLineId is not null).Sum(item => item.IssuedQty);
            var reconciliationReturned = returnLines.Where(line =>
                issueLines.Any(issueLine => issueLine.ReconciliationBatchLineId is not null && issueLine.IssueLineId.SequenceEqual(line.SourceIssueLineId ?? []))).Sum(item => item.Quantity);
            return new Ledger(
                mode.Mode,
                mode.Version,
                issues.Select(item => GuidHelper.ToGuidString(item.IssueId)).ToArray(),
                issues.Select(item => item.MaterialRequestId is null ? "" : GuidHelper.ToGuidString(item.MaterialRequestId)).ToArray(),
                issues.Where(item => item.ReceivedAt is not null).Select(item => GuidHelper.ToGuidString(item.IssueId)).ToArray(),
                issueLines.Select(item => item.MaterialRequestLineId is null ? "" : GuidHelper.ToGuidString(item.MaterialRequestLineId)).ToArray(),
                returns.Select(item => GuidHelper.ToGuidString(item.ReturnId)).ToArray(),
                returns.Select(item => GuidHelper.ToGuidString(item.IssueId)).ToArray(),
                returns.Where(item => item.ReceivedAt is not null).Select(item => GuidHelper.ToGuidString(item.ReturnId)).ToArray(),
                returnLines.Select(item => item.SourceIssueLineId is null ? "" : GuidHelper.ToGuidString(item.SourceIssueLineId)).ToArray(),
                stock.CurrentQty,
                movements.Count(item => item.MovementType == "ISSUE"),
                movements.Count(item => item.MovementType == "RETURN"),
                movements.Where(item => item.MovementType == "RETURN" && item.RefId is not null).Select(item => GuidHelper.ToGuidString(item.RefId!)).ToArray(),
                defaultIssued - defaultReturned,
                reconciliationIssued - reconciliationReturned,
                await Context.Supplementalmaterialrequests.CountAsync(),
                await Context.Approvalhistories.CountAsync(),
                await Context.Auditlogs.CountAsync(item => item.BusinessArea != "SYSTEM_OPERATION"),
                await Context.Reconciliationactuals.CountAsync(),
                await Context.Reconciliationactualrevisions.CountAsync(),
                await Context.Reconciliationdispositions.CountAsync(),
                await Context.Lifecycletransitions.CountAsync(),
                await Context.Lifecycleoutboxmessages.CountAsync(),
                await Context.Lifecyclecommandreceipts.CountAsync());
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    private sealed record Ledger(
        string Mode,
        long ModeVersion,
        string[] IssueIds,
        string[] IssueParentIds,
        string[] ReceivedIssueIds,
        string[] IssueLineageIds,
        string[] ReturnIds,
        string[] ReturnParentIds,
        string[] ReceivedReturnIds,
        string[] ReturnSourceLineIds,
        decimal StockQuantity,
        int IssueMovements,
        int ReturnMovements,
        string[] ReturnMovementRefIds,
        decimal DefaultNetIssued,
        decimal ReconciliationNetIssued,
        int SupplementalRequests,
        int ApprovalHistories,
        int Audits,
        int ReconciliationActuals,
        int ReconciliationActualRevisions,
        int ReconciliationDispositions,
        int Transitions,
        int Outbox,
        int Receipts);
}
