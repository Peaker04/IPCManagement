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
using System.Text.Json;
using System.Text.Json.Serialization;
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

        await fixture.Invoking(item => item.IssueService.CreateAsync(create, fixture.ActorId))
            .Should().ThrowAsync<BusinessRuleException>();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeCreate);

        var defaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT issue creation.");
        fixture.SetRequestAuthority(defaultAuthority, "inventoryissues.createasync");
        var beforeCreateSuccess = await fixture.CaptureAsync();
        AssertExactModeSwitch(beforeCreate, beforeCreateSuccess, SystemOperationEligibility.Default, "Resume DEFAULT issue creation.", fixture.ActorId);

        var created = await fixture.IssueService.CreateAsync(create, fixture.ActorId);
        var afterCreateSuccess = await fixture.CaptureAsync();
        created.Should().NotBeNull();
        AssertExactIssueCreateDelta(beforeCreateSuccess, afterCreateSuccess, created!, create, fixture);

        var replay = await fixture.IssueService.CreateAsync(create, fixture.ActorId);
        replay!.IssueId.Should().Be(created!.IssueId);
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(afterCreateSuccess);

        var receiptInactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT issue receipt.");
        fixture.SetRequestAuthority(receiptInactiveAuthority, "inventoryissues.confirmreceiptasync");
        var beforeReceipt = await fixture.CaptureAsync();
        await fixture.Invoking(item => item.IssueService.ConfirmReceiptAsync(created.IssueId, new(), fixture.ActorId))
            .Should().ThrowAsync<BusinessRuleException>();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeReceipt);

        var receiptDefaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT issue receipt.");
        fixture.SetRequestAuthority(receiptDefaultAuthority, "inventoryissues.confirmreceiptasync");
        var beforeReceiptSuccess = await fixture.CaptureAsync();
        AssertExactModeSwitch(beforeReceipt, beforeReceiptSuccess, SystemOperationEligibility.Default, "Resume DEFAULT issue receipt.", fixture.ActorId);

        var confirmed = await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, new(), fixture.ActorId);
        var afterReceiptSuccess = await fixture.CaptureAsync();
        confirmed!.IssueId.Should().Be(created.IssueId);
        AssertExactIssueReceiptDelta(beforeReceiptSuccess, afterReceiptSuccess, created.IssueId, fixture);

        var confirmedReplay = await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, new(), fixture.ActorId);
        confirmedReplay!.IssueId.Should().Be(created.IssueId);
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(afterReceiptSuccess);
    }

    [Fact]
    public async Task Return_CreateAndReceipt_FreezeCompleteLedgerThenResumeOriginalIdentityOnce()
    {
        await using var fixture = await Fixture.CreateAsync(receivedIssue: true);
        var create = fixture.CreateReturnCommand("phase30-default-return-create");

        var inactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT return creation.");
        fixture.SetRequestAuthority(inactiveAuthority, "inventoryreturns.createasync");
        var beforeCreate = await fixture.CaptureAsync();
        await fixture.Invoking(item => item.ReturnService.CreateAsync(create, fixture.ActorId))
            .Should().ThrowAsync<BusinessRuleException>();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeCreate);

        var defaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT return creation.");
        fixture.SetRequestAuthority(defaultAuthority, "inventoryreturns.createasync");
        var beforeCreateSuccess = await fixture.CaptureAsync();
        AssertExactModeSwitch(beforeCreate, beforeCreateSuccess, SystemOperationEligibility.Default, "Resume DEFAULT return creation.", fixture.ActorId);

        var created = await fixture.ReturnService.CreateAsync(create, fixture.ActorId);
        var afterCreateSuccess = await fixture.CaptureAsync();
        created.Should().NotBeNull();
        AssertExactReturnCreateDelta(beforeCreateSuccess, afterCreateSuccess, created!, create, fixture);

        var replay = await fixture.ReturnService.CreateAsync(create, fixture.ActorId);
        replay!.ReturnId.Should().Be(created!.ReturnId);
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(afterCreateSuccess);

        var receiptInactiveAuthority = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Freeze DEFAULT return receipt.");
        fixture.SetRequestAuthority(receiptInactiveAuthority, "inventoryreturns.confirmreceiptasync");
        var beforeReceipt = await fixture.CaptureAsync();
        var confirmation = new ConfirmInventoryReturnReceiptRequest { CommandId = "phase30-default-return-confirm", ExpectedVersion = 0 };
        await fixture.Invoking(item => item.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId))
            .Should().ThrowAsync<BusinessRuleException>();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(beforeReceipt);

        var receiptDefaultAuthority = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Resume DEFAULT return receipt.");
        fixture.SetRequestAuthority(receiptDefaultAuthority, "inventoryreturns.confirmreceiptasync");
        var beforeReceiptSuccess = await fixture.CaptureAsync();
        AssertExactModeSwitch(beforeReceipt, beforeReceiptSuccess, SystemOperationEligibility.Default, "Resume DEFAULT return receipt.", fixture.ActorId);

        (await fixture.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId)).Should().BeTrue();
        var afterReceiptSuccess = await fixture.CaptureAsync();
        AssertExactReturnReceiptDelta(beforeReceiptSuccess, afterReceiptSuccess, created.ReturnId, confirmation, fixture);

        (await fixture.ReturnService.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.ActorId)).Should().BeTrue();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(afterReceiptSuccess);
    }

    [Theory]
    [InlineData("issue-create")]
    [InlineData("issue-confirm")]
    [InlineData("return-create")]
    [InlineData("return-confirm")]
    public async Task StaleCapturedModeVersion_FailsEachPublicOwnerWithCompleteZeroResidue(string owner)
    {
        await using var fixture = await Fixture.CreateAsync(receivedIssue: owner.StartsWith("return", StringComparison.Ordinal));
        Func<Task> act;

        if (owner == "issue-confirm")
        {
            fixture.SetRequestAuthority(SystemOperationEligibility.Default, 1, "inventoryissues.createasync");
            var issue = await fixture.IssueService.CreateAsync(fixture.CreateIssueCommand("phase30-stale-issue-confirm-fixture"), fixture.ActorId);
            act = () => fixture.IssueService.ConfirmReceiptAsync(issue!.IssueId, new(), fixture.ActorId);
        }
        else if (owner == "return-confirm")
        {
            fixture.SetRequestAuthority(SystemOperationEligibility.Default, 1, "inventoryreturns.createasync");
            var inventoryReturn = await fixture.ReturnService.CreateAsync(fixture.CreateReturnCommand("phase30-stale-return-confirm-fixture"), fixture.ActorId);
            var confirmation = new ConfirmInventoryReturnReceiptRequest { CommandId = "phase30-stale-return-confirm", ExpectedVersion = 0 };
            act = () => fixture.ReturnService.ConfirmReceiptAsync(inventoryReturn!.ReturnId, confirmation, fixture.ActorId);
        }
        else if (owner == "return-create")
        {
            act = () => fixture.ReturnService.CreateAsync(fixture.CreateReturnCommand("phase30-stale-return-create"), fixture.ActorId);
        }
        else
        {
            act = () => fixture.IssueService.CreateAsync(fixture.CreateIssueCommand("phase30-stale-issue-create"), fixture.ActorId);
        }

        await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, $"Advance authority before stale {owner}.");
        var operationKey = owner switch
        {
            "issue-create" => "inventoryissues.createasync",
            "issue-confirm" => "inventoryissues.confirmreceiptasync",
            "return-create" => "inventoryreturns.createasync",
            _ => "inventoryreturns.confirmreceiptasync",
        };
        fixture.SetRequestAuthority(SystemOperationEligibility.Default, 1, operationKey);
        var before = await fixture.CaptureAsync();

        await act.Should().ThrowAsync<SystemOperationConflictException>();
        (await fixture.CaptureAsync()).Should().BeEquivalentTo(before);
    }

    private static void AssertExactModeSwitch(
        Ledger before,
        Ledger after,
        string expectedMode,
        string expectedReason,
        string actorId)
    {
        after.Mode.Version.Should().Be(before.Mode.Version + 1);
        after.Mode.Should().Be(new ModeValue(
            expectedMode,
            before.Mode.Version + 1,
            after.Mode.UpdatedAt,
            actorId,
            expectedReason));

        var modeAudit = SingleAdded(before.Audits, after.Audits, item => item.Id);
        modeAudit.Should().Be(new AuditValue(
            modeAudit.Id,
            after.Mode.UpdatedAt,
            actorId,
            "SYSTEM_OPERATION",
            "SystemOperationMode",
            null,
            "Mode",
            before.Mode.Mode,
            expectedMode,
            expectedReason,
            null));

        var normalizedExpected = before with
        {
            Mode = after.Mode,
            Audits = AddOrdered(before.Audits, modeAudit, item => item.Id),
        };
        after.Should().BeEquivalentTo(normalizedExpected,
            "a real mode switch may change only the exact SystemOperationMode row and its exact SYSTEM_OPERATION audit tuple");
    }

    private static void AssertExactIssueCreateDelta(
        Ledger before,
        Ledger after,
        InventoryIssueCreatedDto created,
        CreateInventoryIssueRequest command,
        Fixture fixture)
    {
        var oldRequest = before.MaterialRequests.Single(item => item.Id == fixture.MaterialRequestId);
        var newRequest = after.MaterialRequests.Single(item => item.Id == fixture.MaterialRequestId);
        newRequest.Should().Be(oldRequest with { Status = "EXPORTED" });

        var issue = SingleAdded(before.Issues, after.Issues, item => item.Id);
        issue.Should().Be(new IssueValue(created.IssueId, created.IssueCode, command.IssueDate, null,
            fixture.WarehouseId, fixture.MaterialRequestId, null, fixture.ActorId, null, null, issue.CreatedAt));
        var issueLine = SingleAdded(before.IssueLines, after.IssueLines, item => item.Id);
        issueLine.Should().Be(new IssueLineValue(issueLine.Id, created.IssueId, fixture.IngredientId,
            fixture.UnitId, fixture.MaterialRequestLineId, null, 5m, 5m));

        var oldStock = before.Stocks.Single();
        var newStock = after.Stocks.Single();
        newStock.Should().Be(new StockValue(fixture.WarehouseId, fixture.IngredientId, fixture.UnitId,
            15m, newStock.LastUpdated, newStock.RowVersion));
        var movement = SingleAdded(before.Movements, after.Movements, item => item.Id);
        movement.Should().Be(new MovementValue(movement.Id, movement.Date, fixture.WarehouseId,
            fixture.IngredientId, fixture.UnitId, "ISSUE", "inventoryissues", created.IssueId,
            0m, 5m, 20m, 15m, null, null, null, "Xuất kho sản xuất", $"Phiếu xuất {created.IssueCode}", fixture.ActorId));

        var audit = SingleAddedWhere(before.Audits, after.Audits, item => item.BusinessArea == "InventoryIssue", item => item.Id);
        audit.Should().Be(new AuditValue(audit.Id, audit.ChangedAt, fixture.ActorId, "InventoryIssue",
            nameof(MaterialRequest), fixture.MaterialRequestId, nameof(MaterialRequest.Status), "APPROVED", "EXPORTED",
            "Đã xuất đủ nguyên liệu, tự động chuyển trạng thái Nhu cầu thành EXPORTED.", null));
        var canonicalResult = new InventoryIssueCreatedDto
        {
            IssueId = issue.Id!,
            IssueCode = issue.Code,
            ConcurrencyVersion = checked(command.ExpectedVersion + 1),
        };
        created.Should().BeEquivalentTo(canonicalResult);
        var canonicalPayloadJson = JsonSerializer.Serialize(canonicalResult);
        var transition = SingleAdded(before.Transitions, after.Transitions, item => item.Id);
        transition.Should().Be(new TransitionValue(transition.Id, nameof(InventoryIssue), fixture.MaterialRequestId,
            command.CommandId, 1, null, "ISSUED", fixture.ActorId, 0,
            $"Tạo phiếu xuất {issue.Code} cho nhu cầu đã chọn.", command.CorrelationId, command.CausationId,
            canonicalPayloadJson, 1, transition.CreatedAt));
        var lifecycleAudit = AssertLifecycleAudit(before, after, transition, fixture.ActorId);
        var outbox = SingleAdded(before.Outbox, after.Outbox, item => item.Id);
        var receipt = SingleAdded(before.Receipts, after.Receipts, item => item.Id);
        AssertLifecyclePair(transition, outbox, receipt, canonicalResult);

        var expected = before with
        {
            MaterialRequests = ReplaceOrdered(before.MaterialRequests, oldRequest, newRequest, item => item.Id),
            Issues = AddOrdered(before.Issues, issue, item => item.Id),
            IssueLines = AddOrdered(before.IssueLines, issueLine, item => item.Id),
            Stocks = ReplaceOrdered(before.Stocks, oldStock, newStock, StockKey),
            Movements = AddOrdered(before.Movements, movement, item => item.Id),
            Audits = AddOrdered(AddOrdered(before.Audits, audit, item => item.Id), lifecycleAudit, item => item.Id),
            Transitions = AddOrdered(before.Transitions, transition, item => item.Id),
            Outbox = AddOrdered(before.Outbox, outbox, item => item.Id),
            Receipts = AddOrdered(before.Receipts, receipt, item => item.Id),
            DefaultNetIssued = 5m,
        };
        after.Should().BeEquivalentTo(expected, "issue creation has one exact allow-listed full-ledger delta");
    }

    private static void AssertExactIssueReceiptDelta(Ledger before, Ledger after, string issueId, Fixture fixture)
    {
        var oldIssue = before.Issues.Single(item => item.Id == issueId);
        var newIssue = after.Issues.Single(item => item.Id == issueId);
        newIssue.Should().Be(oldIssue with { ReceivedBy = fixture.ActorId, ReceivedAt = newIssue.ReceivedAt });
        newIssue.ReceivedAt.Should().NotBeNull();

        var audit = SingleAddedWhere(before.Audits, after.Audits, item => item.BusinessArea == "KitchenReceipt", item => item.Id);
        audit.Should().Be(new AuditValue(audit.Id, newIssue.ReceivedAt!.Value, fixture.ActorId,
            "KitchenReceipt", nameof(InventoryIssue), issueId, "KitchenReceived", null,
            $"receivedAt={newIssue.ReceivedAt.Value:O}",
            $"Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất {newIssue.Code}.", null));

        var expected = before with
        {
            Issues = ReplaceOrdered(before.Issues, oldIssue, newIssue, item => item.Id),
            Audits = AddOrdered(before.Audits, audit, item => item.Id),
        };
        after.Should().BeEquivalentTo(expected, "issue receipt confirmation updates one issue and adds its exact audit tuple only");
    }

    private static void AssertExactReturnCreateDelta(
        Ledger before,
        Ledger after,
        InventoryReturnCreatedDto created,
        CreateInventoryReturnRequest command,
        Fixture fixture)
    {
        var inventoryReturn = SingleAdded(before.Returns, after.Returns, item => item.Id);
        inventoryReturn.Should().Be(new ReturnValue(created.ReturnId, created.ReturnCode, command.ReturnDate,
            null, "RETURN", fixture.WarehouseId, fixture.IssueId, command.Reason, fixture.ActorId,
            inventoryReturn.CreatedAt, null, null));
        var line = SingleAdded(before.ReturnLines, after.ReturnLines, item => item.Id);
        line.Should().Be(new ReturnLineValue(line.Id, created.ReturnId, fixture.IngredientId, fixture.UnitId,
            fixture.IssueLineId, 2m));
        var canonicalResult = new InventoryReturnCreatedDto
        {
            ReturnId = inventoryReturn.Id!,
            ReturnCode = inventoryReturn.Code,
        };
        created.Should().BeEquivalentTo(canonicalResult);
        var canonicalPayloadJson = JsonSerializer.Serialize(canonicalResult);
        var transition = SingleAdded(before.Transitions, after.Transitions, item => item.Id);
        transition.Should().Be(new TransitionValue(transition.Id, nameof(InventoryReturn), inventoryReturn.Id,
            command.CommandId, 0, null, "PENDING_RECEIPT", fixture.ActorId, 0, command.Reason,
            command.CorrelationId, command.CausationId, canonicalPayloadJson, 1, transition.CreatedAt));
        var lifecycleAudit = AssertLifecycleAudit(before, after, transition, fixture.ActorId);
        var outbox = SingleAdded(before.Outbox, after.Outbox, item => item.Id);
        var receipt = SingleAdded(before.Receipts, after.Receipts, item => item.Id);
        AssertLifecyclePair(transition, outbox, receipt, canonicalResult);

        var expected = before with
        {
            Returns = AddOrdered(before.Returns, inventoryReturn, item => item.Id),
            ReturnLines = AddOrdered(before.ReturnLines, line, item => item.Id),
            Audits = AddOrdered(before.Audits, lifecycleAudit, item => item.Id),
            Transitions = AddOrdered(before.Transitions, transition, item => item.Id),
            Outbox = AddOrdered(before.Outbox, outbox, item => item.Id),
            Receipts = AddOrdered(before.Receipts, receipt, item => item.Id),
            DefaultNetIssued = 3m,
        };
        after.Should().BeEquivalentTo(expected, "return creation has one exact allow-listed full-ledger delta");
    }

    private static void AssertExactReturnReceiptDelta(
        Ledger before,
        Ledger after,
        string returnId,
        ConfirmInventoryReturnReceiptRequest command,
        Fixture fixture)
    {
        var oldReturn = before.Returns.Single(item => item.Id == returnId);
        var newReturn = after.Returns.Single(item => item.Id == returnId);
        newReturn.Should().Be(oldReturn with { ReceivedBy = fixture.ActorId, ReceivedAt = newReturn.ReceivedAt });
        newReturn.ReceivedAt.Should().NotBeNull();

        var oldStock = before.Stocks.Single();
        var newStock = after.Stocks.Single();
        newStock.Should().Be(new StockValue(fixture.WarehouseId, fixture.IngredientId, fixture.UnitId,
            22m, newStock.LastUpdated, newStock.RowVersion));
        var movement = SingleAdded(before.Movements, after.Movements, item => item.Id);
        movement.Should().Be(new MovementValue(movement.Id, movement.Date, fixture.WarehouseId,
            fixture.IngredientId, fixture.UnitId, "RETURN", "inventoryreturns", returnId,
            2m, 0m, 20m, 22m, null, null, null, "Trả nguyên liệu dư sau sản xuất",
            $"Phiếu trả {newReturn.Code}", fixture.ActorId));
        var audit = SingleAddedWhere(before.Audits, after.Audits, item => item.BusinessArea == "StorekeeperReturnReceipt", item => item.Id);
        audit.Should().Be(new AuditValue(audit.Id, newReturn.ReceivedAt!.Value, fixture.ActorId,
            "StorekeeperReturnReceipt", nameof(InventoryReturn), returnId, "StorekeeperReceived", null,
            $"receivedAt={newReturn.ReceivedAt.Value:O}",
            $"Thủ kho xác nhận phiếu trả {newReturn.Code}.", null));
        var canonicalResult = new InventoryReturnReceiptResult(
            newReturn.Id!,
            newReturn.ReturnType == "WASTE" ? "RECORDED" : "RECEIVED",
            checked(command.ExpectedVersion + 1));
        var canonicalPayloadJson = JsonSerializer.Serialize(canonicalResult);
        var transition = SingleAdded(before.Transitions, after.Transitions, item => item.Id);
        transition.Should().Be(new TransitionValue(transition.Id, nameof(InventoryReturn), newReturn.Id,
            command.CommandId, 1, "PENDING_RECEIPT", canonicalResult.Status, fixture.ActorId, command.ExpectedVersion,
            command.HasDiscrepancy ? command.DiscrepancyNote?.Trim() : $"Thủ kho xác nhận phiếu trả {newReturn.Code}.",
            command.CorrelationId, command.CausationId, canonicalPayloadJson, 1, transition.CreatedAt));
        var lifecycleAudit = AssertLifecycleAudit(before, after, transition, fixture.ActorId);
        var outbox = SingleAdded(before.Outbox, after.Outbox, item => item.Id);
        var receipt = SingleAdded(before.Receipts, after.Receipts, item => item.Id);
        AssertLifecyclePair(transition, outbox, receipt, canonicalResult);

        var expected = before with
        {
            Returns = ReplaceOrdered(before.Returns, oldReturn, newReturn, item => item.Id),
            Stocks = ReplaceOrdered(before.Stocks, oldStock, newStock, StockKey),
            Movements = AddOrdered(before.Movements, movement, item => item.Id),
            Audits = AddOrdered(AddOrdered(before.Audits, audit, item => item.Id), lifecycleAudit, item => item.Id),
            Transitions = AddOrdered(before.Transitions, transition, item => item.Id),
            Outbox = AddOrdered(before.Outbox, outbox, item => item.Id),
            Receipts = AddOrdered(before.Receipts, receipt, item => item.Id),
        };
        after.Should().BeEquivalentTo(expected, "return receipt confirmation has one exact allow-listed full-ledger delta");
    }

    private static AuditValue AssertLifecycleAudit(Ledger before, Ledger after, TransitionValue transition, string actorId)
    {
        var audit = SingleAddedWhere(before.Audits, after.Audits, item => item.BusinessArea == "Lifecycle", item => item.Id);
        audit.Should().Be(new AuditValue(audit.Id, transition.CreatedAt, actorId, "Lifecycle",
            transition.AggregateType, transition.AggregateId, "Transition", transition.FromState,
            transition.ToState, transition.Reason, transition.CorrelationId));
        return audit;
    }

    private static void AssertLifecyclePair<TCanonical>(
        TransitionValue transition,
        OutboxValue outbox,
        ReceiptValue receipt,
        TCanonical canonicalResult)
    {
        transition.PayloadJson.Should().NotBeNull();
        JsonSerializer.Deserialize<TCanonical>(transition.PayloadJson!).Should().BeEquivalentTo(canonicalResult);
        JsonSerializer.Deserialize<TCanonical>(outbox.PayloadJson).Should().BeEquivalentTo(canonicalResult);
        JsonSerializer.Deserialize<TCanonical>(receipt.ResponseJson).Should().BeEquivalentTo(canonicalResult);

        outbox.Should().Be(new OutboxValue(outbox.Id, $"{transition.AggregateType}.Transitioned", transition.AggregateType,
            transition.AggregateId, transition.AggregateSequence, transition.CommandId, transition.PayloadJson!,
            "PENDING", 0, null, null, null, null, transition.CreatedAt));
        receipt.Should().Be(new ReceiptValue(receipt.Id, transition.CommandId, transition.AggregateType,
            transition.AggregateId, transition.PayloadJson, transition.CreatedAt));
    }

    private static T SingleAdded<T>(T[] before, T[] after, Func<T, string?> key) =>
        SingleAddedWhere(before, after, _ => true, key);

    private static T SingleAddedWhere<T>(T[] before, T[] after, Func<T, bool> predicate, Func<T, string?> key)
    {
        var beforeKeys = before.Select(key).ToHashSet(StringComparer.Ordinal);
        return after.Where(item => !beforeKeys.Contains(key(item)) && predicate(item)).Should().ContainSingle().Subject;
    }

    private static T[] AddOrdered<T>(T[] before, T added, Func<T, string?> key) =>
        [.. before.Append(added).OrderBy(key, StringComparer.Ordinal)];

    private static T[] ReplaceOrdered<T>(T[] before, T oldValue, T newValue, Func<T, string?> key) =>
        [.. before.Select(item => EqualityComparer<T>.Default.Equals(item, oldValue) ? newValue : item)
            .OrderBy(key, StringComparer.Ordinal)];

    private static string? StockKey(StockValue item) => $"{item.WarehouseId}/{item.IngredientId}/{item.UnitId}";

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
        public string WarehouseId => GuidHelper.ToGuidString(WarehouseBytes);
        public string IngredientId => GuidHelper.ToGuidString(IngredientBytes);
        public string UnitId => GuidHelper.ToGuidString(UnitBytes);
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
                    CREATE TABLE lifecycleoutboxdeliveries (
                        deliveryId BLOB PRIMARY KEY,
                        outboxMessageId BLOB NOT NULL,
                        consumerName TEXT NOT NULL,
                        processedAt TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationactuals (
                        actualId BLOB PRIMARY KEY,
                        batchLineId BLOB NOT NULL,
                        side TEXT NOT NULL,
                        quantity TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        enteredBy BLOB NOT NULL,
                        enteredAt TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationactualrevisions (
                        revisionId BLOB PRIMARY KEY,
                        actualId BLOB NOT NULL,
                        oldQuantity TEXT NOT NULL,
                        newQuantity TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        changedBy BLOB NOT NULL,
                        changedAt TEXT NOT NULL
                    );
                    CREATE TABLE reconciliationdispositions (
                        dispositionId BLOB PRIMARY KEY,
                        batchLineId BLOB NOT NULL,
                        category TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        disposedBy BLOB NOT NULL,
                        disposedAt TEXT NOT NULL
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

        public void SetRequestAuthority(SystemOperationModeDto authority, string operationKey) =>
            SetRequestAuthority(authority.Mode, authority.Version, operationKey);

        public void SetRequestAuthority(string mode, long version, string operationKey)
        {
            RequestContext.Mode = mode;
            RequestContext.ExpectedModeVersion = version;
            RequestContext.OperationKey = operationKey;
            RequestContext.Disposition = OperationDisposition.Retained;
        }

        public async Task<Ledger> CaptureAsync()
        {
            Context.ChangeTracker.Clear();
            var mode = await Context.Systemoperationmodes.AsNoTracking().SingleAsync();
            var requests = await Context.Materialrequests.AsNoTracking().ToListAsync();
            var requestLines = await Context.Materialrequestlines.AsNoTracking().ToListAsync();
            var issues = await Context.Inventoryissues.AsNoTracking().ToListAsync();
            var issueLines = await Context.Inventoryissuelines.AsNoTracking().ToListAsync();
            var returns = await Context.Inventoryreturns.AsNoTracking().ToListAsync();
            var returnLines = await Context.Inventoryreturnlines.AsNoTracking().ToListAsync();
            var stocks = await Context.Currentstocks.AsNoTracking().ToListAsync();
            var movements = await Context.Stockmovements.AsNoTracking().ToListAsync();
            var defaultIssued = issueLines.Where(item => item.MaterialRequestLineId is not null).Sum(item => item.IssuedQty);
            var defaultReturned = returnLines.Where(line => issueLines.Any(issueLine => Same(issueLine.IssueLineId, line.SourceIssueLineId))).Sum(item => item.Quantity);
            var reconciliationIssued = issueLines.Where(item => item.ReconciliationBatchLineId is not null).Sum(item => item.IssuedQty);
            var reconciliationReturned = returnLines.Where(line => issueLines.Any(issueLine => issueLine.ReconciliationBatchLineId is not null && Same(issueLine.IssueLineId, line.SourceIssueLineId))).Sum(item => item.Quantity);

            return new Ledger(
                new ModeValue(mode.Mode, mode.Version, mode.UpdatedAt, Id(mode.UpdatedBy), mode.Reason),
                requests.Select(item => new MaterialRequestValue(Id(item.RequestId), item.RequestCode, Id(item.PlanId), item.RequestDate, item.RequestScope, item.Status, Id(item.CreatedBy), Id(item.ApprovedBy), item.ApprovedAt)).OrderBy(item => item.Id).ToArray(),
                requestLines.Select(item => new MaterialRequestLineValue(Id(item.RequestLineId), Id(item.RequestId), Id(item.PlanLineId), Id(item.IngredientId), Id(item.UnitId), Id(item.BomId), item.PriceTierAmount, item.BomScope, item.TotalServings, item.GrossQtyPerServing, item.BomRatePercent, Id(item.AppliedPortionRuleId), item.AppliedPortionRuleSource, item.AppliedPortionRatePercent, item.YieldLossPercent, item.TotalRequiredQty, item.CurrentStockQty, item.SuggestedPurchaseQty)).OrderBy(item => item.Id).ToArray(),
                issues.Select(item => new IssueValue(Id(item.IssueId), item.IssueCode, item.IssueDate, item.ShiftName, Id(item.WarehouseId), Id(item.MaterialRequestId), Id(item.ReconciliationBatchId), Id(item.IssuedBy), Id(item.ReceivedBy), AsUtc(item.ReceivedAt), item.CreatedAt)).OrderBy(item => item.Id).ToArray(),
                issueLines.Select(item => new IssueLineValue(Id(item.IssueLineId), Id(item.IssueId), Id(item.IngredientId), Id(item.UnitId), Id(item.MaterialRequestLineId), Id(item.ReconciliationBatchLineId), item.RequestedQty, item.IssuedQty)).OrderBy(item => item.Id).ToArray(),
                returns.Select(item => new ReturnValue(Id(item.ReturnId), item.ReturnCode, item.ReturnDate, item.ShiftName, item.ReturnType, Id(item.WarehouseId), Id(item.IssueId), item.Reason, Id(item.CreatedBy), item.CreatedAt, Id(item.ReceivedBy), AsUtc(item.ReceivedAt))).OrderBy(item => item.Id).ToArray(),
                returnLines.Select(item => new ReturnLineValue(Id(item.ReturnLineId), Id(item.ReturnId), Id(item.IngredientId), Id(item.UnitId), Id(item.SourceIssueLineId), item.Quantity)).OrderBy(item => item.Id).ToArray(),
                stocks.Select(item => new StockValue(Id(item.WarehouseId), Id(item.IngredientId), Id(item.UnitId), item.CurrentQty, item.LastUpdated, item.RowVersion)).OrderBy(item => $"{item.WarehouseId}/{item.IngredientId}/{item.UnitId}").ToArray(),
                movements.Select(item => new MovementValue(Id(item.MovementId), item.MovementDate, Id(item.WarehouseId), Id(item.IngredientId), Id(item.UnitId), item.MovementType, item.RefTable, Id(item.RefId), item.QuantityIn, item.QuantityOut, item.BeforeQty, item.AfterQty, item.LotNumber, item.ManufactureDate, item.ExpiredDate, item.Reason, item.Note, Id(item.PerformedBy))).OrderBy(item => item.Id).ToArray(),
                (await Context.Supplementalmaterialrequests.AsNoTracking().ToListAsync()).Select(item => new SupplementalValue(Id(item.RequestId), item.RequestCode, Id(item.IssueId), Id(item.IssueLineId), Id(item.WarehouseId), Id(item.IngredientId), Id(item.UnitId), item.RequestedQty, item.Reason, item.Status, Id(item.RequestedBy), item.RequestedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Purchaserequests.AsNoTracking().ToListAsync()).Select(item => new PurchaseRequestValue(Id(item.PurchaseRequestId), item.PurchaseRequestCode, item.RequestDate, item.PurchaseForDate, item.ShiftName, item.Status, Id(item.CreatedBy), Id(item.ApprovedBy), item.ApprovedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Purchaserequestlines.AsNoTracking().ToListAsync()).Select(item => new PurchaseRequestLineValue(Id(item.PurchaseRequestLineId), Id(item.PurchaseRequestId), Id(item.MaterialRequestLineId), Id(item.IngredientId), Id(item.SupplierId), Id(item.UnitId), item.RequiredQty, item.CurrentStockQty, item.PurchaseQty, item.EstimatedUnitPrice, item.ExpectedDeliveryDate, item.Note, item.IsLegacySupplierSnapshot)).OrderBy(item => item.Id).ToArray(),
                (await Context.Purchaseorders.AsNoTracking().ToListAsync()).Select(item => new PurchaseOrderValue(Id(item.PurchaseOrderId), item.PurchaseOrderCode, Id(item.PurchaseRequestId), Id(item.SupplierId), Id(item.ReceivingWarehouseId), item.PurchasingTerms, item.ProposedDeliveryDate, item.OrderDate, item.Status, Id(item.CreatedBy), item.CreatedAt, item.UpdatedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Purchaseorderlines.AsNoTracking().ToListAsync()).Select(item => new PurchaseOrderLineValue(Id(item.PurchaseOrderLineId), Id(item.PurchaseOrderId), Id(item.PurchaseRequestLineId), Id(item.IngredientId), Id(item.UnitId), item.OrderedQty, item.ReceivedQty, item.UnitPrice)).OrderBy(item => item.Id).ToArray(),
                (await Context.Approvalhistories.AsNoTracking().ToListAsync()).Select(item => new ApprovalValue(Id(item.ApprovalHistoryId), item.TargetType, Id(item.TargetId), item.Decision, item.OldStatus, item.NewStatus, item.Reason, Id(item.ActionBy), item.ActionAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Auditlogs.AsNoTracking().ToListAsync()).Select(item => new AuditValue(Id(item.AuditId), item.ChangedAt, Id(item.ChangedBy), item.BusinessArea, item.EntityName, Id(item.EntityId), item.FieldName, item.OldValue, item.NewValue, item.Reason, item.CorrelationId)).OrderBy(item => item.Id).ToArray(),
                (await Context.Reconciliationactuals.AsNoTracking().ToListAsync()).Select(item => new ActualValue(Id(item.ActualId), Id(item.BatchLineId), item.Side, item.Quantity, item.Version, Id(item.EnteredBy), item.EnteredAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Reconciliationactualrevisions.AsNoTracking().ToListAsync()).Select(item => new RevisionValue(Id(item.RevisionId), Id(item.ActualId), item.OldQuantity, item.NewQuantity, item.Reason, Id(item.ChangedBy), item.ChangedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Reconciliationdispositions.AsNoTracking().ToListAsync()).Select(item => new DispositionValue(Id(item.DispositionId), Id(item.BatchLineId), item.Category, item.Reason, item.Version, Id(item.DisposedBy), item.DisposedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Lifecycletransitions.AsNoTracking().ToListAsync()).Select(item => new TransitionValue(Id(item.TransitionId), item.AggregateType, Id(item.AggregateId), item.CommandId, item.AggregateSequence, item.FromState, item.ToState, Id(item.ActorId), item.ExpectedVersion, item.Reason, item.CorrelationId, item.CausationId, item.PayloadJson, item.SchemaVersion, item.CreatedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Lifecycleoutboxmessages.AsNoTracking().ToListAsync()).Select(item => new OutboxValue(Id(item.OutboxMessageId), item.EventType, item.AggregateType, Id(item.AggregateId), item.AggregateSequence, item.CommandId, item.PayloadJson, item.Status, item.AttemptCount, item.NextAttemptAt, item.LockedAt, item.ProcessedAt, item.LastError, item.CreatedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Lifecycleoutboxdeliveries.AsNoTracking().ToListAsync()).Select(item => new DeliveryValue(Id(item.DeliveryId), Id(item.OutboxMessageId), item.ConsumerName, item.ProcessedAt)).OrderBy(item => item.Id).ToArray(),
                (await Context.Lifecyclecommandreceipts.AsNoTracking().ToListAsync()).Select(item => new ReceiptValue(Id(item.CommandReceiptId), item.CommandId, item.AggregateType, Id(item.AggregateId), item.ResponseJson, item.CreatedAt)).OrderBy(item => item.Id).ToArray(),
                defaultIssued - defaultReturned,
                reconciliationIssued - reconciliationReturned);
        }

        private static string? Id(byte[]? value) => value is null ? null : GuidHelper.ToGuidString(value);
        private static DateTime? AsUtc(DateTime? value) =>
            value is null ? null : DateTime.SpecifyKind(value.Value, DateTimeKind.Utc);
        private static bool Same(byte[] left, byte[]? right) => right is not null && left.SequenceEqual(right);

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    private sealed record Ledger(
        ModeValue Mode,
        MaterialRequestValue[] MaterialRequests,
        MaterialRequestLineValue[] MaterialRequestLines,
        IssueValue[] Issues,
        IssueLineValue[] IssueLines,
        ReturnValue[] Returns,
        ReturnLineValue[] ReturnLines,
        StockValue[] Stocks,
        MovementValue[] Movements,
        SupplementalValue[] SupplementalRequests,
        PurchaseRequestValue[] PurchaseRequests,
        PurchaseRequestLineValue[] PurchaseRequestLines,
        PurchaseOrderValue[] PurchaseOrders,
        PurchaseOrderLineValue[] PurchaseOrderLines,
        ApprovalValue[] ApprovalHistories,
        AuditValue[] Audits,
        ActualValue[] ReconciliationActuals,
        RevisionValue[] ReconciliationActualRevisions,
        DispositionValue[] ReconciliationDispositions,
        TransitionValue[] Transitions,
        OutboxValue[] Outbox,
        DeliveryValue[] OutboxDeliveries,
        ReceiptValue[] Receipts,
        decimal DefaultNetIssued,
        decimal ReconciliationNetIssued);

    private sealed record ModeValue(string Mode, long Version, DateTime UpdatedAt, string? UpdatedBy, string? Reason);
    private sealed record MaterialRequestValue(string? Id, string Code, string? PlanId, DateOnly Date, string Scope, string Status, string? CreatedBy, string? ApprovedBy, DateTime? ApprovedAt);
    private sealed record MaterialRequestLineValue(string? Id, string? ParentId, string? PlanLineId, string? IngredientId, string? UnitId, string? BomId, decimal PriceTierAmount, string BomScope, int TotalServings, decimal GrossQtyPerServing, decimal BomRatePercent, string? AppliedPortionRuleId, string AppliedPortionRuleSource, decimal AppliedPortionRatePercent, decimal? YieldLossPercent, decimal TotalRequiredQty, decimal CurrentStockQty, decimal SuggestedPurchaseQty);
    private sealed record IssueValue(string? Id, string Code, DateOnly Date, string? ShiftName, string? WarehouseId, string? MaterialRequestId, string? ReconciliationBatchId, string? IssuedBy, string? ReceivedBy, DateTime? ReceivedAt, DateTime CreatedAt);
    private sealed record IssueLineValue(string? Id, string? ParentId, string? IngredientId, string? UnitId, string? MaterialRequestLineId, string? ReconciliationBatchLineId, decimal RequestedQty, decimal IssuedQty);
    private sealed record ReturnValue(string? Id, string Code, DateOnly Date, string? ShiftName, string ReturnType, string? WarehouseId, string? IssueId, string? Reason, string? CreatedBy, DateTime CreatedAt, string? ReceivedBy, DateTime? ReceivedAt);
    private sealed record ReturnLineValue(string? Id, string? ParentId, string? IngredientId, string? UnitId, string? SourceIssueLineId, decimal Quantity);
    private sealed record StockValue(string? WarehouseId, string? IngredientId, string? UnitId, decimal Quantity, DateTime LastUpdated, DateTime RowVersion);
    private sealed record MovementValue(string? Id, DateTime Date, string? WarehouseId, string? IngredientId, string? UnitId, string Type, string? RefTable, string? RefId, decimal QuantityIn, decimal QuantityOut, decimal BeforeQty, decimal AfterQty, string? LotNumber, DateOnly? ManufactureDate, DateOnly? ExpiredDate, string? Reason, string? Note, string? PerformedBy);
    private sealed record SupplementalValue(string? Id, string Code, string? IssueId, string? IssueLineId, string? WarehouseId, string? IngredientId, string? UnitId, decimal RequestedQty, string? Reason, string Status, string? RequestedBy, DateTime RequestedAt);
    private sealed record PurchaseRequestValue(string? Id, string Code, DateOnly RequestDate, DateOnly PurchaseForDate, string? ShiftName, string Status, string? CreatedBy, string? ApprovedBy, DateTime? ApprovedAt);
    private sealed record PurchaseRequestLineValue(string? Id, string? ParentId, string? MaterialRequestLineId, string? IngredientId, string? SupplierId, string? UnitId, decimal RequiredQty, decimal CurrentStockQty, decimal PurchaseQty, decimal EstimatedUnitPrice, DateOnly? ExpectedDeliveryDate, string? Note, bool IsLegacySupplierSnapshot);
    private sealed record PurchaseOrderValue(string? Id, string Code, string? PurchaseRequestId, string? SupplierId, string? ReceivingWarehouseId, string? PurchasingTerms, DateOnly? ProposedDeliveryDate, DateOnly OrderDate, string Status, string? CreatedBy, DateTime CreatedAt, DateTime UpdatedAt);
    private sealed record PurchaseOrderLineValue(string? Id, string? ParentId, string? PurchaseRequestLineId, string? IngredientId, string? UnitId, decimal OrderedQty, decimal ReceivedQty, decimal UnitPrice);
    private sealed record ApprovalValue(string? Id, string TargetType, string? TargetId, string Decision, string? OldStatus, string? NewStatus, string? Reason, string? ActionBy, DateTime ActionAt);
    private sealed record AuditValue(string? Id, DateTime ChangedAt, string? ChangedBy, string BusinessArea, string EntityName, string? EntityId, string? FieldName, string? OldValue, string? NewValue, string? Reason, string? CorrelationId);
    private sealed record ActualValue(string? Id, string? BatchLineId, string Side, decimal Quantity, long Version, string? EnteredBy, DateTime EnteredAt);
    private sealed record RevisionValue(string? Id, string? ActualId, decimal OldQuantity, decimal NewQuantity, string Reason, string? ChangedBy, DateTime ChangedAt);
    private sealed record DispositionValue(string? Id, string? BatchLineId, string Category, string Reason, long Version, string? DisposedBy, DateTime DisposedAt);
    private sealed record TransitionValue(string? Id, string AggregateType, string? AggregateId, string CommandId, int AggregateSequence, string? FromState, string ToState, string? ActorId, long ExpectedVersion, string? Reason, string? CorrelationId, string? CausationId, string? PayloadJson, int SchemaVersion, DateTime CreatedAt);
    private sealed record OutboxValue(string? Id, string EventType, string AggregateType, string? AggregateId, int AggregateSequence, string CommandId, string PayloadJson, string Status, int AttemptCount, DateTime? NextAttemptAt, DateTime? LockedAt, DateTime? ProcessedAt, string? LastError, DateTime CreatedAt);
    private sealed record DeliveryValue(string? Id, string? OutboxMessageId, string ConsumerName, DateTime ProcessedAt);
    private sealed record ReceiptValue(string? Id, string CommandId, string AggregateType, string? AggregateId, string ResponseJson, DateTime CreatedAt);
    private sealed record InventoryReturnReceiptResult(
        [property: JsonPropertyName("returnId")] string ReturnId,
        [property: JsonPropertyName("status")] string Status,
        [property: JsonPropertyName("concurrencyVersion")] long ConcurrencyVersion);
}
