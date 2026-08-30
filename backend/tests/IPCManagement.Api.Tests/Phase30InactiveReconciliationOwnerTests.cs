using System.Reflection;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.LifecycleOutbox;
using IPCManagement.Api.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveReconciliationOwnerTests
{
    [Fact]
    public async Task Batch_TransferAndCompletion_FreezeThenResumeExactPersistedBatches()
    {
        await using var fixture = await Fixture.CreateAsync();

        var inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation batch owners.");
        fixture.Authorize(inactive, "reconciliation.batches.transfer", OperationDisposition.ReconciliationOnly);
        var beforeTransfer = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.BatchService.TransferToWarehouseAsync(x.TransferBatchId, new(1), x.ActorId))
            .Should().ThrowAsync<SystemOperationUnavailableException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeTransfer);

        var active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation transfer.");
        fixture.Authorize(active, "reconciliation.batches.transfer", OperationDisposition.ReconciliationOnly);
        var beforeTransferSuccess = await fixture.SnapshotAsync();
        var transferred = await fixture.BatchService.TransferToWarehouseAsync(fixture.TransferBatchId, new(1), fixture.ActorId);
        transferred.BatchId.Should().Be(fixture.TransferBatchId);
        transferred.Status.Should().Be("TRANSFERRED");
        transferred.SourceVersion.Should().Be(2);
        transferred.Lines.Should().ContainSingle().Which.BatchLineId.Should().Be(fixture.TransferLineId);
        var afterTransfer = await fixture.SnapshotAsync();
        AssertOnlyBatchDelta(beforeTransferSuccess, afterTransfer, fixture.TransferBatchId, "READY", "TRANSFERRED", 1, 2);
        var transferReplay = await fixture.BatchService.TransferToWarehouseAsync(fixture.TransferBatchId, new(1), fixture.ActorId);
        transferReplay.BatchId.Should().Be(transferred.BatchId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterTransfer);

        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation completion.");
        fixture.Authorize(inactive, "reconciliation.batches.complete", OperationDisposition.ReconciliationOnly);
        var beforeComplete = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.CompletionService.CompleteAsync(x.CompletionBatchId, new(3), x.ActorId))
            .Should().ThrowAsync<SystemOperationUnavailableException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeComplete);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation completion.");
        fixture.Authorize(active, "reconciliation.batches.complete", OperationDisposition.ReconciliationOnly);
        var beforeCompleteSuccess = await fixture.SnapshotAsync();
        var completed = await fixture.CompletionService.CompleteAsync(fixture.CompletionBatchId, new(3), fixture.ActorId);
        completed.BatchId.Should().Be(fixture.CompletionBatchId);
        completed.Status.Should().Be("COMPLETED");
        completed.Version.Should().Be(4);
        completed.Lines.Should().ContainSingle().Which.BatchLineId.Should().Be(fixture.CompletionLineId);
        var afterComplete = await fixture.SnapshotAsync();
        AssertOnlyBatchDelta(beforeCompleteSuccess, afterComplete, fixture.CompletionBatchId, "IN_PROGRESS", "COMPLETED", 3, 4, completed: true);
        var completedReplay = await fixture.CompletionService.CompleteAsync(fixture.CompletionBatchId, new(3), fixture.ActorId);
        completedReplay.BatchId.Should().Be(completed.BatchId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterComplete);
    }

    [Fact]
    public async Task Inventory_IssueAndReturn_FreezeThenResumeExactReconciliationLineageOnce()
    {
        await using var fixture = await Fixture.CreateAsync();
        var issueCommand = fixture.IssueCommand();

        var inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation warehouse issue.");
        fixture.Authorize(inactive, "inventoryissues.createasync", OperationDisposition.Retained);
        var beforeIssue = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.IssueService.CreateAsync(issueCommand, x.ActorId))
            .Should().ThrowAsync<BusinessRuleException>().WithMessage("*chế độ đối chiếu nguyên liệu*");
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeIssue);

        var active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation warehouse issue.");
        fixture.Authorize(active, "inventoryissues.createasync", OperationDisposition.Retained);
        var beforeIssueSuccess = await fixture.SnapshotAsync();
        var created = await fixture.IssueService.CreateAsync(issueCommand, fixture.ActorId);
        created.Should().NotBeNull();
        var afterIssue = await fixture.SnapshotAsync();
        AssertExactIssueDelta(beforeIssueSuccess, afterIssue, created!, fixture);
        var issueReplay = await fixture.IssueService.CreateAsync(issueCommand, fixture.ActorId);
        issueReplay!.IssueId.Should().Be(created!.IssueId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterIssue);

        await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, new(), fixture.ActorId);
        var afterKitchenReceipt = await fixture.SnapshotAsync();
        var returnCommand = fixture.ReturnCommand(created.IssueId, afterKitchenReceipt.IssueLines.Single(x => x.ReconciliationBatchLineId == fixture.IssueLineId).Id);

        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation return creation.");
        fixture.Authorize(inactive, "inventoryreturns.createasync", OperationDisposition.Retained);
        var beforeReturn = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.ReturnService.CreateAsync(returnCommand, x.ActorId))
            .Should().ThrowAsync<BusinessRuleException>().WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeReturn);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation return creation.");
        fixture.Authorize(active, "inventoryreturns.createasync", OperationDisposition.Retained);
        var beforeReturnSuccess = await fixture.SnapshotAsync();
        var createdReturn = await fixture.ReturnService.CreateAsync(returnCommand, fixture.ActorId);
        createdReturn.Should().NotBeNull();
        var afterReturnCreate = await fixture.SnapshotAsync();
        AssertExactReturnCreateDelta(beforeReturnSuccess, afterReturnCreate, createdReturn!, fixture);
        var returnReplay = await fixture.ReturnService.CreateAsync(returnCommand, fixture.ActorId);
        returnReplay!.ReturnId.Should().Be(createdReturn!.ReturnId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterReturnCreate);

        var confirm = new ConfirmInventoryReturnReceiptRequest { CommandId = "p30-recon-return-confirm", ExpectedVersion = 0 };
        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation return confirmation.");
        fixture.Authorize(inactive, "inventoryreturns.confirmreceiptasync", OperationDisposition.Retained);
        var beforeConfirm = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.ReturnService.ConfirmReceiptAsync(createdReturn.ReturnId, confirm, x.ActorId))
            .Should().ThrowAsync<BusinessRuleException>().WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeConfirm);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation return confirmation.");
        fixture.Authorize(active, "inventoryreturns.confirmreceiptasync", OperationDisposition.Retained);
        var beforeConfirmSuccess = await fixture.SnapshotAsync();
        (await fixture.ReturnService.ConfirmReceiptAsync(createdReturn.ReturnId, confirm, fixture.ActorId)).Should().BeTrue();
        var afterConfirm = await fixture.SnapshotAsync();
        AssertExactReturnConfirmDelta(beforeConfirmSuccess, afterConfirm, createdReturn.ReturnId, fixture);
        (await fixture.ReturnService.ConfirmReceiptAsync(createdReturn.ReturnId, confirm, fixture.ActorId)).Should().BeTrue();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterConfirm);
    }

    [Fact]
    public async Task Actual_IssuedAndDisposition_FreezeThenResumeSameRowsAndVersions()
    {
        await using var fixture = await Fixture.CreateAsync();
        var correction = new UpsertReconciliationActualRequest(4m, 1, false, "Correct exact manual ISSUED actual.");

        var inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze manual ISSUED actual.");
        fixture.Authorize(inactive, "reconciliation.actuals.issued", OperationDisposition.ReconciliationOnly);
        var beforeActual = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.ActualService.UpsertAsync(x.ActualLineId, "ISSUED", correction, x.ActorId))
            .Should().ThrowAsync<SystemOperationUnavailableException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeActual);

        var active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume manual ISSUED actual.");
        fixture.Authorize(active, "reconciliation.actuals.issued", OperationDisposition.ReconciliationOnly);
        var beforeActualSuccess = await fixture.SnapshotAsync();
        await fixture.ActualService.UpsertAsync(fixture.ActualLineId, "ISSUED", correction, fixture.ActorId);
        var afterActual = await fixture.SnapshotAsync();
        AssertExactActualDelta(beforeActualSuccess, afterActual, fixture);
        await fixture.Invoking(x => x.ActualService.UpsertAsync(x.ActualLineId, "ISSUED", correction, x.ActorId))
            .Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterActual);

        var disposition = new SetReconciliationDispositionRequest("INVESTIGATE", "Investigate exact persisted variance.", null);
        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation disposition.");
        fixture.Authorize(inactive, "reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly);
        var beforeDisposition = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.ActualService.SetDispositionAsync(x.ActualLineId, disposition, x.ActorId))
            .Should().ThrowAsync<SystemOperationUnavailableException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeDisposition);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation disposition.");
        fixture.Authorize(active, "reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly);
        var beforeDispositionSuccess = await fixture.SnapshotAsync();
        await fixture.ActualService.SetDispositionAsync(fixture.ActualLineId, disposition, fixture.ActorId);
        var afterDisposition = await fixture.SnapshotAsync();
        AssertExactDispositionDelta(beforeDispositionSuccess, afterDisposition, fixture);
        await fixture.Invoking(x => x.ActualService.SetDispositionAsync(x.ActualLineId, disposition, x.ActorId))
            .Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterDisposition);
    }

    [Fact]
    public void AbsentCleanupAndBackgroundMutationOwners_AreNotRegistered_AndLifecycleProcessorIsDeliveryOnly()
    {
        var assembly = typeof(IPCManagement.Api.DependencyInjection).Assembly;
        var boundedControllers = assembly.GetTypes()
            .Where(type => !type.IsAbstract && typeof(ControllerBase).IsAssignableFrom(type))
            .Where(type => type.Name.Contains("Reconciliation", StringComparison.OrdinalIgnoreCase)
                || type.Name.Contains("MaterialRequest", StringComparison.OrdinalIgnoreCase)
                || type.Name.Contains("InventoryIssue", StringComparison.OrdinalIgnoreCase)
                || type.Name.Contains("InventoryReturn", StringComparison.OrdinalIgnoreCase)
                || type.Name.Contains("Lifecycle", StringComparison.OrdinalIgnoreCase))
            .SelectMany(type => type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                .Where(method => method.GetCustomAttributes().Any(attribute => attribute is HttpMethodAttribute))
                .Select(method => $"{type.Name}.{method.Name}"))
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();

        boundedControllers.Should().NotContain(owner => OwnerLooksLikeCleanupOrBackgroundMutation(owner));

        var root = FindRepositoryRoot();
        var dependencyInjectionSource = File.ReadAllText(Path.Combine(root, "backend", "src", "IPCManagement.Api", "DependencyInjection.cs"));
        var registrationLines = dependencyInjectionSource.Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.StartsWith("services.Add", StringComparison.Ordinal) && line.Contains('<'))
            .ToArray();
        registrationLines.Should().NotContain(line =>
            (line.Contains("Cleanup", StringComparison.OrdinalIgnoreCase) || line.Contains("Background", StringComparison.OrdinalIgnoreCase))
            && (line.Contains("MaterialRequest", StringComparison.Ordinal) || line.Contains("Reconciliation", StringComparison.Ordinal)));
        registrationLines.Should().ContainSingle(line => line.Contains("ILifecycleOutboxProcessor, LifecycleOutboxProcessor", StringComparison.Ordinal));
        dependencyInjectionSource.Should().Contain("AddHostedService<LifecycleOutboxWorker>");

        typeof(ILifecycleOutboxProcessor).GetMethods().Select(method => method.Name)
            .Should().Equal(nameof(ILifecycleOutboxProcessor.ProcessBatchAsync));
        var processorSource = File.ReadAllText(Path.Combine(root, "backend", "src", "IPCManagement.Api", "Infrastructure", "LifecycleOutbox", "LifecycleOutboxProcessor.cs"));
        var workerSource = File.ReadAllText(Path.Combine(root, "backend", "src", "IPCManagement.Api", "Infrastructure", "LifecycleOutbox", "LifecycleOutboxWorker.cs"));
        var lifecycleSource = processorSource + "\n" + workerSource;
        lifecycleSource.Should().NotContain("Materialrequests");
        lifecycleSource.Should().NotContain("Reconciliationbatches");
        lifecycleSource.Should().NotContain("new MaterialRequest");
        lifecycleSource.Should().NotContain("new ReconciliationBatch");
        lifecycleSource.Should().NotContain("Inventoryreturns.Add");
        lifecycleSource.Should().NotContain("Inventoryissues.Add");
        lifecycleSource.Should().NotContain("CompletedAt =");
    }

    private static bool OwnerLooksLikeCleanupOrBackgroundMutation(string owner) =>
        (owner.Contains("Cleanup", StringComparison.OrdinalIgnoreCase)
            || owner.Contains("Background", StringComparison.OrdinalIgnoreCase)
            || owner.Contains("Process", StringComparison.OrdinalIgnoreCase))
        && !owner.StartsWith("LifecycleOutboxController.", StringComparison.Ordinal);

    private static string FindRepositoryRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, "AGENTS.md"))) return current.FullName;
            current = current.Parent;
        }
        throw new DirectoryNotFoundException("Repository root was not found.");
    }

    private static void AssertOnlyBatchDelta(Snapshot before, Snapshot after, string batchId, string oldStatus, string newStatus, long oldVersion, long newVersion, bool completed = false)
    {
        var oldBatch = before.Batches.Single(x => x.Id == batchId);
        var newBatch = after.Batches.Single(x => x.Id == batchId);
        oldBatch.Status.Should().Be(oldStatus);
        oldBatch.Version.Should().Be(oldVersion);
        newBatch.Should().Be(oldBatch with { Status = newStatus, Version = newVersion, CompletedBy = completed ? after.ActorId : oldBatch.CompletedBy, CompletedAt = completed ? newBatch.CompletedAt : oldBatch.CompletedAt });
        if (completed) newBatch.CompletedAt.Should().NotBeNull();
        after.Should().BeEquivalentTo(before with { Batches = Replace(before.Batches, oldBatch, newBatch, x => x.Id) });
    }

    private static void AssertExactIssueDelta(Snapshot before, Snapshot after, InventoryIssueCreatedDto created, Fixture fixture)
    {
        var issue = after.Issues.Except(before.Issues).Should().ContainSingle().Subject;
        issue.Id.Should().Be(created.IssueId);
        issue.ReconciliationBatchId.Should().Be(fixture.IssueBatchId);
        issue.MaterialRequestId.Should().BeNull();
        var line = after.IssueLines.Except(before.IssueLines).Should().ContainSingle().Subject;
        line.IssueId.Should().Be(issue.Id);
        line.ReconciliationBatchLineId.Should().Be(fixture.IssueLineId);
        line.MaterialRequestLineId.Should().BeNull();
        line.IssuedQty.Should().Be(5m);
        after.Stocks.Single().Qty.Should().Be(before.Stocks.Single().Qty - 5m);
        var movement = after.Movements.Except(before.Movements).Should().ContainSingle().Subject;
        movement.Should().Be(new MovementValue(movement.Id, "ISSUE", "inventoryissues", issue.Id, 5m, 0m));
        after.ReconciliationNet.Should().Be(before.ReconciliationNet + 5m);
        after.DefaultNet.Should().Be(0m);
        after.Transitions.Length.Should().Be(before.Transitions.Length + 1);
        after.Outbox.Length.Should().Be(before.Outbox.Length + 1);
        after.Receipts.Length.Should().Be(before.Receipts.Length + 1);
    }

    private static void AssertExactReturnCreateDelta(Snapshot before, Snapshot after, InventoryReturnCreatedDto created, Fixture fixture)
    {
        var result = after.Returns.Except(before.Returns).Should().ContainSingle().Subject;
        result.Id.Should().Be(created.ReturnId);
        var line = after.ReturnLines.Except(before.ReturnLines).Should().ContainSingle().Subject;
        line.ReturnId.Should().Be(result.Id);
        line.Quantity.Should().Be(2m);
        before.IssueLines.Should().ContainSingle(x => x.Id == line.SourceIssueLineId && x.ReconciliationBatchLineId == fixture.IssueLineId);
        after.Stocks.Should().Equal(before.Stocks);
        after.Movements.Should().Equal(before.Movements);
        after.ReconciliationNet.Should().Be(before.ReconciliationNet - 2m);
        after.DefaultNet.Should().Be(0m);
        after.Transitions.Length.Should().Be(before.Transitions.Length + 1);
        after.Outbox.Length.Should().Be(before.Outbox.Length + 1);
        after.Receipts.Length.Should().Be(before.Receipts.Length + 1);
    }

    private static void AssertExactReturnConfirmDelta(Snapshot before, Snapshot after, string returnId, Fixture fixture)
    {
        var oldReturn = before.Returns.Single(x => x.Id == returnId);
        var newReturn = after.Returns.Single(x => x.Id == returnId);
        newReturn.ReceivedBy.Should().Be(fixture.ActorId);
        newReturn.ReceivedAt.Should().NotBeNull();
        after.Stocks.Single().Qty.Should().Be(before.Stocks.Single().Qty + 2m);
        var movement = after.Movements.Except(before.Movements).Should().ContainSingle().Subject;
        movement.Should().Be(new MovementValue(movement.Id, "RETURN", "inventoryreturns", returnId, 0m, 2m));
        after.ReconciliationNet.Should().Be(before.ReconciliationNet);
        after.DefaultNet.Should().Be(0m);
        after.Transitions.Length.Should().Be(before.Transitions.Length + 1);
        after.Outbox.Length.Should().Be(before.Outbox.Length + 1);
        after.Receipts.Length.Should().Be(before.Receipts.Length + 1);
    }

    private static void AssertExactActualDelta(Snapshot before, Snapshot after, Fixture fixture)
    {
        var oldActual = before.Actuals.Single(x => x.LineId == fixture.ActualLineId && x.Side == "ISSUED");
        var newActual = after.Actuals.Single(x => x.Id == oldActual.Id);
        newActual.Should().Be(oldActual with { Quantity = 4m, Version = 2, EnteredBy = fixture.ActorId, EnteredAt = newActual.EnteredAt });
        after.Revisions.Except(before.Revisions).Should().ContainSingle().Which.ActualId.Should().Be(oldActual.Id);
        after.Dispositions.Should().Equal(before.Dispositions);
        after.Batches.Should().Equal(before.Batches);
        after.Stocks.Should().Equal(before.Stocks);
        after.Movements.Should().Equal(before.Movements);
    }

    private static void AssertExactDispositionDelta(Snapshot before, Snapshot after, Fixture fixture)
    {
        var disposition = after.Dispositions.Except(before.Dispositions).Should().ContainSingle().Subject;
        disposition.LineId.Should().Be(fixture.ActualLineId);
        disposition.Category.Should().Be("INVESTIGATE");
        disposition.Reason.Should().Be("Investigate exact persisted variance.");
        disposition.Version.Should().Be(1);
        disposition.DisposedBy.Should().Be(fixture.ActorId);
        after.Actuals.Should().Equal(before.Actuals);
        after.Revisions.Should().Equal(before.Revisions);
        after.Batches.Should().Equal(before.Batches);
        after.Stocks.Should().Equal(before.Stocks);
        after.Movements.Should().Equal(before.Movements);
    }

    private static T[] Replace<T>(T[] values, T oldValue, T newValue, Func<T, string> key) =>
        values.Select(x => EqualityComparer<T>.Default.Equals(x, oldValue) ? newValue : x).OrderBy(key).ToArray();

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private long modeVersion = 1;
        private readonly byte[] actor = GuidHelper.NewId();
        private readonly byte[] warehouse = GuidHelper.NewId();
        private readonly byte[] ingredient = GuidHelper.NewId();
        private readonly byte[] unit = GuidHelper.NewId();
        private readonly byte[] transferBatch = GuidHelper.NewId();
        private readonly byte[] transferLine = GuidHelper.NewId();
        private readonly byte[] completionBatch = GuidHelper.NewId();
        private readonly byte[] completionLine = GuidHelper.NewId();
        private readonly byte[] issueBatch = GuidHelper.NewId();
        private readonly byte[] issueLine = GuidHelper.NewId();
        private readonly byte[] actualBatch = GuidHelper.NewId();
        private readonly byte[] actualLine = GuidHelper.NewId();

        private Fixture(SqliteConnection connection, IpcManagementContext context)
        {
            this.connection = connection;
            Context = context;
            RequestContext = new();
            var guard = new SystemOperationModeGuard(context);
            ModeService = new SystemOperationModeService(context, guard, new EfTransactionRunner(context));
            var runner = new EfTransactionRunner(context, RequestContext, guard);
            var unitOfWork = new UnitOfWork(context);
            var issueRepository = new InventoryIssueRepository(context);
            var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
            warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouse);
            var ledger = new StockLedgerService(new CurrentStockRepository(context), new StockMovementRepository(context));
            BatchService = new(context, runner, RequestContext);
            CompletionService = new(context, BatchService, runner, RequestContext);
            ActualService = new(context, runner, RequestContext);
            IssueService = new(issueRepository, unitOfWork, ledger, runner, warehouseResolver, context, RequestContext);
            ReturnService = new(new InventoryReturnRepository(context), issueRepository, unitOfWork, ledger, runner, warehouseResolver, context, RequestContext);
        }

        public IpcManagementContext Context { get; }
        public SystemOperationRequestContext RequestContext { get; }
        public SystemOperationModeService ModeService { get; }
        public ReconciliationBatchService BatchService { get; }
        public ReconciliationCompletionService CompletionService { get; }
        public ReconciliationActualService ActualService { get; }
        public InventoryIssueService IssueService { get; }
        public InventoryReturnService ReturnService { get; }
        public string ActorId => Id(actor)!;
        public string TransferBatchId => Id(transferBatch)!;
        public string TransferLineId => Id(transferLine)!;
        public string CompletionBatchId => Id(completionBatch)!;
        public string CompletionLineId => Id(completionLine)!;
        public string IssueBatchId => Id(issueBatch)!;
        public string IssueLineId => Id(issueLine)!;
        public string ActualLineId => Id(actualLine)!;

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var helper = typeof(WorkflowGenerationTests).GetNestedType("WorkflowFixture", BindingFlags.NonPublic)!;
            var schema = helper.GetMethod("CreateMinimalWorkflowSchemaAsync", BindingFlags.NonPublic | BindingFlags.Static)!;
            await (Task)schema.Invoke(null, [connection])!;
            await using var command = connection.CreateCommand();
            command.CommandText = AdditionalSchema;
            await command.ExecuteNonQueryAsync();
            var context = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options);
            var fixture = new Fixture(connection, context);
            await fixture.SeedAsync();
            return fixture;
        }

        private async Task SeedAsync()
        {
            var role = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
            Context.AddRange(role,
                new User { UserId = actor, RoleId = role.RoleId, Username = $"p30-{Guid.NewGuid():N}", FullName = "P30", PasswordHash = "test-only", IsActive = true, CreatedAt = DateTime.UtcNow },
                new Unit { UnitId = unit, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 },
                new Warehouse { WarehouseId = warehouse, WarehouseCode = "P30", WarehouseName = "P30", WarehouseType = "MAIN", IsOperationalActive = true },
                new Ingredient { IngredientId = ingredient, IngredientCode = "P30-I", IngredientName = "P30 ingredient", UnitId = unit, WarehouseId = warehouse, ReferencePrice = 1, IsActive = true },
                new CurrentStock { WarehouseId = warehouse, IngredientId = ingredient, UnitId = unit, CurrentQty = 20m, LastUpdated = DateTime.UtcNow },
                new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.MaterialReconciliation, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = actor },
                Batch(transferBatch, transferLine, "READY", 1, 5m),
                Batch(completionBatch, completionLine, "IN_PROGRESS", 3, 3m),
                Batch(issueBatch, issueLine, "TRANSFERRED", 2, 5m),
                Batch(actualBatch, actualLine, "IN_PROGRESS", 6, 5m));
            Context.Inventoryissues.Add(new InventoryIssue
            {
                IssueId = GuidHelper.NewId(), IssueCode = "ISS-P30-COMPLETE", IssueDate = new DateOnly(2026, 8, 30), WarehouseId = warehouse,
                ReconciliationBatchId = completionBatch, IssuedBy = actor, ReceivedBy = actor, ReceivedAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow,
                Inventoryissuelines = [new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = ingredient, UnitId = unit, ReconciliationBatchLineId = completionLine, RequestedQty = 3m, IssuedQty = 3m }]
            });
            Context.Reconciliationactuals.AddRange(
                new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = actualLine, Side = "PURCHASED", Quantity = 5m, Version = 1, EnteredBy = actor, EnteredAt = DateTime.UtcNow },
                new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = actualLine, Side = "ISSUED", Quantity = 5m, Version = 1, EnteredBy = actor, EnteredAt = DateTime.UtcNow });
            await Context.SaveChangesAsync();
        }

        private ReconciliationBatch Batch(byte[] id, byte[] lineId, string status, long version, decimal quantity) => new()
        {
            BatchId = id, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = status, Version = version, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
            Lines = [new ReconciliationBatchLine { BatchLineId = lineId, IngredientId = ingredient, CanonicalUnitId = unit, RequiredQuantity = quantity, FrozenTolerance = 0.1m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                Contributors = [new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(), SourceQuantity = quantity }] }]
        };

        public async Task<SystemOperationModeDto> SwitchAsync(string mode, string reason)
        {
            var value = await ModeService.ChangeAsync(new(mode, modeVersion, true, reason), ActorId);
            modeVersion = value.Version;
            return value;
        }

        public void Authorize(SystemOperationModeDto value, string key, OperationDisposition disposition)
        {
            RequestContext.Mode = value.Mode;
            RequestContext.ExpectedModeVersion = value.Version;
            RequestContext.OperationKey = key;
            RequestContext.Disposition = disposition;
        }

        public CreateInventoryIssueRequest IssueCommand() => new()
        {
            CommandId = "p30-recon-issue", ExpectedVersion = 2, ReconciliationBatchId = IssueBatchId, IssueDate = new DateOnly(2026, 8, 30), WarehouseId = Id(warehouse),
            Lines = [new CreateInventoryIssueLineRequest { ReconciliationBatchLineId = IssueLineId, IngredientId = Id(ingredient), UnitId = Id(unit), RequestedQty = 5m, IssuedQty = 5m }]
        };

        public CreateInventoryReturnRequest ReturnCommand(string issueId, string sourceLineId) => new()
        {
            CommandId = "p30-recon-return", ReturnDate = new DateOnly(2026, 8, 30), ReturnType = "RETURN", WarehouseId = Id(warehouse), IssueId = issueId, Reason = "Return exact reconciliation quantity.",
            Lines = [new CreateInventoryReturnLineRequest { SourceIssueLineId = sourceLineId, IngredientId = Id(ingredient), UnitId = Id(unit), Quantity = 2m }]
        };

        public async Task<Snapshot> SnapshotAsync()
        {
            Context.ChangeTracker.Clear();
            var issues = await Context.Inventoryissues.AsNoTracking().ToListAsync();
            var issueLines = await Context.Inventoryissuelines.AsNoTracking().ToListAsync();
            var returns = await Context.Inventoryreturns.AsNoTracking().ToListAsync();
            var returnLines = await Context.Inventoryreturnlines.AsNoTracking().ToListAsync();
            var reconIssued = issueLines.Where(x => x.ReconciliationBatchLineId is not null).Sum(x => x.IssuedQty);
            var reconReturned = returnLines.Where(x => issueLines.Any(i => Same(i.IssueLineId, x.SourceIssueLineId) && i.ReconciliationBatchLineId is not null)).Sum(x => x.Quantity);
            var defaultIssued = issueLines.Where(x => x.MaterialRequestLineId is not null).Sum(x => x.IssuedQty);
            var defaultReturned = returnLines.Where(x => issueLines.Any(i => Same(i.IssueLineId, x.SourceIssueLineId) && i.MaterialRequestLineId is not null)).Sum(x => x.Quantity);
            return new Snapshot(ActorId,
                (await Context.Reconciliationbatches.AsNoTracking().ToListAsync()).Select(x => new BatchValue(Id(x.BatchId)!, x.Status, x.Version, Id(x.CompletedBy), x.CompletedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationbatchlines.AsNoTracking().ToListAsync()).Select(x => new BatchLineValue(Id(x.BatchLineId)!, Id(x.BatchId)!, x.RequiredQuantity, x.Version)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync()).Select(x => new ContributorValue(Id(x.ContributorId)!, Id(x.BatchLineId)!, x.SourceQuantity)).OrderBy(x => x.Id).ToArray(),
                issues.Select(x => new IssueValue(Id(x.IssueId)!, Id(x.MaterialRequestId), Id(x.ReconciliationBatchId), Id(x.ReceivedBy), x.ReceivedAt)).OrderBy(x => x.Id).ToArray(),
                issueLines.Select(x => new IssueLineValue(Id(x.IssueLineId)!, Id(x.IssueId)!, Id(x.MaterialRequestLineId), Id(x.ReconciliationBatchLineId), x.IssuedQty)).OrderBy(x => x.Id).ToArray(),
                returns.Select(x => new ReturnValue(Id(x.ReturnId)!, Id(x.IssueId)!, Id(x.ReceivedBy), x.ReceivedAt)).OrderBy(x => x.Id).ToArray(),
                returnLines.Select(x => new ReturnLineValue(Id(x.ReturnLineId)!, Id(x.ReturnId)!, Id(x.SourceIssueLineId)!, x.Quantity)).OrderBy(x => x.Id).ToArray(),
                (await Context.Currentstocks.AsNoTracking().ToListAsync()).Select(x => new StockValue(Id(x.WarehouseId)!, Id(x.IngredientId)!, Id(x.UnitId)!, x.CurrentQty)).OrderBy(x => x.IngredientId).ToArray(),
                (await Context.Stockmovements.AsNoTracking().ToListAsync()).Select(x => new MovementValue(Id(x.MovementId)!, x.MovementType, x.RefTable, Id(x.RefId)!, x.QuantityOut, x.QuantityIn)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationactuals.AsNoTracking().ToListAsync()).Select(x => new ActualValue(Id(x.ActualId)!, Id(x.BatchLineId)!, x.Side, x.Quantity, x.Version, Id(x.EnteredBy)!, x.EnteredAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationactualrevisions.AsNoTracking().ToListAsync()).Select(x => new RevisionValue(Id(x.RevisionId)!, Id(x.ActualId)!, x.OldQuantity, x.NewQuantity, x.Reason)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationdispositions.AsNoTracking().ToListAsync()).Select(x => new DispositionValue(Id(x.DispositionId)!, Id(x.BatchLineId)!, x.Category, x.Reason, x.Version, Id(x.DisposedBy)!, x.DisposedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Auditlogs.AsNoTracking().ToListAsync()).Select(x => Id(x.AuditId)!).OrderBy(x => x).ToArray(),
                (await Context.Lifecycletransitions.AsNoTracking().ToListAsync()).Select(x => Id(x.TransitionId)!).OrderBy(x => x).ToArray(),
                (await Context.Lifecycleoutboxmessages.AsNoTracking().ToListAsync()).Select(x => Id(x.OutboxMessageId)!).OrderBy(x => x).ToArray(),
                (await Context.Lifecyclecommandreceipts.AsNoTracking().ToListAsync()).Select(x => Id(x.CommandReceiptId)!).OrderBy(x => x).ToArray(),
                reconIssued - reconReturned, defaultIssued - defaultReturned);
        }

        private static string? Id(byte[]? value) => value is null ? null : GuidHelper.ToGuidString(value);
        private static bool Same(byte[] left, byte[]? right) => right is not null && left.SequenceEqual(right);
        public async ValueTask DisposeAsync() { await Context.DisposeAsync(); await connection.DisposeAsync(); }

        private const string AdditionalSchema = """
CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedAt TEXT NOT NULL, updatedBy BLOB NOT NULL, reason TEXT NULL);
CREATE TABLE reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
CREATE TABLE reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
CREATE TABLE reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, sourceQuantity TEXT NOT NULL);
CREATE TABLE reconciliationactuals (actualId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, side TEXT NOT NULL, quantity TEXT NOT NULL, version INTEGER NOT NULL, enteredBy BLOB NOT NULL, enteredAt TEXT NOT NULL);
CREATE UNIQUE INDEX IX_reconciliationactuals_BatchLineId_Side ON reconciliationactuals(batchLineId, side);
CREATE TABLE reconciliationactualrevisions (revisionId BLOB PRIMARY KEY, actualId BLOB NOT NULL, oldQuantity TEXT NOT NULL, newQuantity TEXT NOT NULL, reason TEXT NOT NULL, changedBy BLOB NOT NULL, changedAt TEXT NOT NULL);
CREATE TABLE reconciliationdispositions (dispositionId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL);
CREATE UNIQUE INDEX IX_reconciliationdispositions_BatchLineId ON reconciliationdispositions(batchLineId);
CREATE TABLE lifecycleoutboxdeliveries (deliveryId BLOB PRIMARY KEY, outboxMessageId BLOB NOT NULL, consumerName TEXT NOT NULL, processedAt TEXT NOT NULL);
""";
    }

    private sealed record Snapshot(string ActorId, BatchValue[] Batches, BatchLineValue[] BatchLines, ContributorValue[] Contributors, IssueValue[] Issues, IssueLineValue[] IssueLines, ReturnValue[] Returns, ReturnLineValue[] ReturnLines, StockValue[] Stocks, MovementValue[] Movements, ActualValue[] Actuals, RevisionValue[] Revisions, DispositionValue[] Dispositions, string[] Audits, string[] Transitions, string[] Outbox, string[] Receipts, decimal ReconciliationNet, decimal DefaultNet);
    private sealed record BatchValue(string Id, string Status, long Version, string? CompletedBy, DateTime? CompletedAt);
    private sealed record BatchLineValue(string Id, string BatchId, decimal RequiredQuantity, long Version);
    private sealed record ContributorValue(string Id, string LineId, decimal SourceQuantity);
    private sealed record IssueValue(string Id, string? MaterialRequestId, string? ReconciliationBatchId, string? ReceivedBy, DateTime? ReceivedAt);
    private sealed record IssueLineValue(string Id, string IssueId, string? MaterialRequestLineId, string? ReconciliationBatchLineId, decimal IssuedQty);
    private sealed record ReturnValue(string Id, string IssueId, string? ReceivedBy, DateTime? ReceivedAt);
    private sealed record ReturnLineValue(string Id, string ReturnId, string SourceIssueLineId, decimal Quantity);
    private sealed record StockValue(string WarehouseId, string IngredientId, string UnitId, decimal Qty);
    private sealed record MovementValue(string Id, string Type, string RefTable, string RefId, decimal QuantityOut, decimal QuantityIn);
    private sealed record ActualValue(string Id, string LineId, string Side, decimal Quantity, long Version, string EnteredBy, DateTime EnteredAt);
    private sealed record RevisionValue(string Id, string ActualId, decimal OldQuantity, decimal NewQuantity, string Reason);
    private sealed record DispositionValue(string Id, string LineId, string Category, string Reason, long Version, string DisposedBy, DateTime DisposedAt);
}
