using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
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
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*chế độ đối chiếu nguyên liệu*");
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeTransfer);

        var active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation transfer.");
        fixture.Authorize(active, "reconciliation.batches.transfer", OperationDisposition.ReconciliationOnly);
        var beforeTransferSuccess = await fixture.SnapshotAsync();
        AssertExactSwitchBackDelta(beforeTransfer, beforeTransferSuccess, active, "Resume reconciliation transfer.");
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
        AssertExactSwitchBackDelta(beforeComplete, beforeCompleteSuccess, active, "Resume reconciliation completion.");
        var completed = await fixture.CompletionService.CompleteAsync(fixture.CompletionBatchId, new(3), fixture.ActorId);
        completed.BatchId.Should().Be(fixture.CompletionBatchId);
        completed.Status.Should().Be("COMPLETED");
        completed.Version.Should().Be(4);
        completed.Lines.Should().ContainSingle().Which.BatchLineId.Should().Be(fixture.CompletionLineId);
        var afterComplete = await fixture.SnapshotAsync();
        AssertOnlyBatchDelta(beforeCompleteSuccess, afterComplete, fixture.CompletionBatchId, "IN_PROGRESS", "COMPLETED", 3, 4, completed: true);
        await fixture.Invoking(x => x.CompletionService.CompleteAsync(x.CompletionBatchId, new(3), x.ActorId))
            .Should().ThrowAsync<DbUpdateConcurrencyException>();
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
        AssertExactSwitchBackDelta(beforeIssue, beforeIssueSuccess, active, "Resume reconciliation warehouse issue.");
        var created = await fixture.IssueService.CreateAsync(issueCommand, fixture.ActorId);
        created.Should().NotBeNull();
        var afterIssue = await fixture.SnapshotAsync();
        AssertExactIssueDelta(beforeIssueSuccess, afterIssue, created!, fixture);
        var issueReplay = await fixture.IssueService.CreateAsync(issueCommand, fixture.ActorId);
        issueReplay!.IssueId.Should().Be(created!.IssueId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterIssue);

        var confirmIssue = new ConfirmInventoryIssueReceiptRequest();
        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation issue confirmation.");
        fixture.Authorize(inactive, "inventoryissues.confirmreceiptasync", OperationDisposition.ReconciliationOnly);
        var beforeIssueConfirm = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.IssueService.ConfirmReceiptAsync(created.IssueId, confirmIssue, x.ActorId))
            .Should().ThrowAsync<BusinessRuleException>().WithMessage("*workflow nguồn đang hoạt động*");
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeIssueConfirm);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation issue confirmation.");
        fixture.Authorize(active, "inventoryissues.confirmreceiptasync", OperationDisposition.ReconciliationOnly);
        var beforeIssueConfirmSuccess = await fixture.SnapshotAsync();
        AssertExactSwitchBackDelta(beforeIssueConfirm, beforeIssueConfirmSuccess, active, "Resume reconciliation issue confirmation.");
        await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, confirmIssue, fixture.ActorId);
        var afterKitchenReceipt = await fixture.SnapshotAsync();
        AssertExactIssueConfirmDelta(beforeIssueConfirmSuccess, afterKitchenReceipt, created, fixture);
        await fixture.IssueService.ConfirmReceiptAsync(created.IssueId, confirmIssue, fixture.ActorId);
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterKitchenReceipt);
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
        AssertExactSwitchBackDelta(beforeReturn, beforeReturnSuccess, active, "Resume reconciliation return creation.");
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
        AssertExactSwitchBackDelta(beforeConfirm, beforeConfirmSuccess, active, "Resume reconciliation return confirmation.");
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
        AssertExactSwitchBackDelta(beforeActual, beforeActualSuccess, active, "Resume manual ISSUED actual.");
        await fixture.ActualService.UpsertAsync(fixture.ActualLineId, "ISSUED", correction, fixture.ActorId);
        var afterActual = await fixture.SnapshotAsync();
        AssertExactActualDelta(beforeActualSuccess, afterActual, fixture);
        await fixture.Invoking(x => x.ActualService.UpsertAsync(x.ActualLineId, "ISSUED", correction, x.ActorId))
            .Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(afterActual);

        var disposition = new SetReconciliationDispositionRequest("FOLLOW_UP_REQUIRED", "Investigate exact persisted variance.", null);
        inactive = await fixture.SwitchAsync(SystemOperationEligibility.Default, "Freeze reconciliation disposition.");
        fixture.Authorize(inactive, "reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly);
        var beforeDisposition = await fixture.SnapshotAsync();
        await fixture.Invoking(x => x.ActualService.SetDispositionAsync(x.ActualLineId, disposition, x.ActorId))
            .Should().ThrowAsync<SystemOperationUnavailableException>();
        (await fixture.SnapshotAsync()).Should().BeEquivalentTo(beforeDisposition);

        active = await fixture.SwitchAsync(SystemOperationEligibility.MaterialReconciliation, "Resume reconciliation disposition.");
        fixture.Authorize(active, "reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly);
        var beforeDispositionSuccess = await fixture.SnapshotAsync();
        AssertExactSwitchBackDelta(beforeDisposition, beforeDispositionSuccess, active, "Resume reconciliation disposition.");
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
        Phase30FinalOracleContracts.AssertExactMutationSurface();
        Phase30FinalOracleContracts.AssertExactLifecycleRegistrationsAndCapabilities();
    }

    private static void AssertExactSwitchBackDelta(Snapshot before, Snapshot after, SystemOperationModeDto resumed, string reason)
    {
        var mode = before.Mode with
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            Version = resumed.Version,
            UpdatedAt = resumed.UpdatedAt,
            UpdatedBy = before.ActorId,
            Reason = reason
        };
        var audit = after.Audits.Except(before.Audits).Should().ContainSingle().Subject;
        audit.Should().Be(new AuditValue(audit.Id, resumed.UpdatedAt, before.ActorId, "SYSTEM_OPERATION", "SystemOperationMode", null,
            "Mode", SystemOperationEligibility.Default, SystemOperationEligibility.MaterialReconciliation, reason, null));
        after.Should().BeEquivalentTo(before with
        {
            Mode = mode,
            Audits = before.Audits.Append(audit).OrderBy(value => value.Id).ToArray()
        });
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
        var stock = before.Stocks.Single() with { Qty = before.Stocks.Single().Qty - 5m };
        var movement = after.Movements.Except(before.Movements).Should().ContainSingle().Subject;
        movement.Should().Be(new MovementValue(movement.Id, "ISSUE", "inventoryissues", issue.Id, 5m, 0m));
        var expectedJson = JsonSerializer.Serialize(new InventoryIssueCreatedDto { IssueId = created.IssueId, IssueCode = created.IssueCode, ConcurrencyVersion = 1 });
        var lifecycle = AssertExactLifecycleDelta(before, after, "p30-recon-issue", nameof(InventoryIssue), fixture.IssueBatchId,
            1, "TRANSFERRED", "ISSUED", 2, $"Tạo phiếu xuất {created.IssueCode} từ lô đối chiếu.", fixture.ActorId, expectedJson);
        after.Should().BeEquivalentTo(before with
        {
            Issues = before.Issues.Append(issue).OrderBy(value => value.Id).ToArray(),
            IssueLines = before.IssueLines.Append(line).OrderBy(value => value.Id).ToArray(),
            Stocks = [stock],
            Movements = before.Movements.Append(movement).OrderBy(value => value.Id).ToArray(),
            Audits = lifecycle.Audits,
            Transitions = lifecycle.Transitions,
            Outbox = lifecycle.Outbox,
            Receipts = lifecycle.Receipts,
            ReconciliationNet = before.ReconciliationNet + 5m,
            DefaultNet = 0m
        });
    }

    private static void AssertExactIssueConfirmDelta(Snapshot before, Snapshot after, InventoryIssueCreatedDto created, Fixture fixture)
    {
        var oldIssue = before.Issues.Single(value => value.Id == created.IssueId);
        var newIssue = after.Issues.Single(value => value.Id == created.IssueId);
        newIssue.Should().Be(oldIssue with { ReceivedBy = fixture.ActorId, ReceivedAt = newIssue.ReceivedAt });
        newIssue.ReceivedAt.Should().NotBeNull();
        var audit = after.Audits.Except(before.Audits).Should().ContainSingle().Subject;
        var reason = $"Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất {newIssue.Code}.";
        audit.Should().Be(new AuditValue(audit.Id, newIssue.ReceivedAt!.Value, fixture.ActorId, "KitchenReceipt", nameof(InventoryIssue), created.IssueId,
            "KitchenReceived", null, $"receivedAt={DateTime.SpecifyKind(audit.ChangedAt, DateTimeKind.Utc):O}", reason, null));
        after.Should().BeEquivalentTo(before with
        {
            Issues = Replace(before.Issues, oldIssue, newIssue, value => value.Id),
            Audits = before.Audits.Append(audit).OrderBy(value => value.Id).ToArray()
        });
    }

    private static void AssertExactReturnCreateDelta(Snapshot before, Snapshot after, InventoryReturnCreatedDto created, Fixture fixture)
    {
        var result = after.Returns.Except(before.Returns).Should().ContainSingle().Subject;
        result.Id.Should().Be(created.ReturnId);
        var line = after.ReturnLines.Except(before.ReturnLines).Should().ContainSingle().Subject;
        line.ReturnId.Should().Be(result.Id);
        line.Quantity.Should().Be(2m);
        before.IssueLines.Should().ContainSingle(x => x.Id == line.SourceIssueLineId && x.ReconciliationBatchLineId == fixture.IssueLineId);
        var expectedJson = JsonSerializer.Serialize(new InventoryReturnCreatedDto { ReturnId = created.ReturnId, ReturnCode = created.ReturnCode });
        var lifecycle = AssertExactLifecycleDelta(before, after, "p30-recon-return", nameof(InventoryReturn), result.Id,
            0, null, "PENDING_RECEIPT", 0, "Return exact reconciliation quantity.", fixture.ActorId, expectedJson);
        after.Should().BeEquivalentTo(before with
        {
            Returns = before.Returns.Append(result).OrderBy(value => value.Id).ToArray(),
            ReturnLines = before.ReturnLines.Append(line).OrderBy(value => value.Id).ToArray(),
            Audits = lifecycle.Audits,
            Transitions = lifecycle.Transitions,
            Outbox = lifecycle.Outbox,
            Receipts = lifecycle.Receipts,
            ReconciliationNet = before.ReconciliationNet - 2m,
            DefaultNet = 0m
        });
    }

    private static void AssertExactReturnConfirmDelta(Snapshot before, Snapshot after, string returnId, Fixture fixture)
    {
        var oldReturn = before.Returns.Single(x => x.Id == returnId);
        var newReturn = after.Returns.Single(x => x.Id == returnId);
        newReturn.ReceivedBy.Should().Be(fixture.ActorId);
        newReturn.ReceivedAt.Should().NotBeNull();
        var stock = before.Stocks.Single() with { Qty = before.Stocks.Single().Qty + 2m };
        var movement = after.Movements.Except(before.Movements).Should().ContainSingle().Subject;
        movement.Should().Be(new MovementValue(movement.Id, "RETURN", "inventoryreturns", returnId, 0m, 2m));
        var returnCode = newReturn.Code;
        var reason = $"Thủ kho xác nhận phiếu trả {returnCode}.";
        var expectedJson = JsonSerializer.Serialize(new { returnId, status = "RECEIVED", concurrencyVersion = 1 });
        var lifecycle = AssertExactLifecycleDelta(before, after, "p30-recon-return-confirm", nameof(InventoryReturn), returnId,
            1, "PENDING_RECEIPT", "RECEIVED", 0, reason, fixture.ActorId, expectedJson, additionalAuditCount: 1);
        var receiptAudit = after.Audits.Except(before.Audits).Single(value => value.BusinessArea == "StorekeeperReturnReceipt");
        receiptAudit.Should().Be(new AuditValue(receiptAudit.Id, newReturn.ReceivedAt!.Value, fixture.ActorId, "StorekeeperReturnReceipt", nameof(InventoryReturn), returnId,
            "StorekeeperReceived", null, $"receivedAt={DateTime.SpecifyKind(receiptAudit.ChangedAt, DateTimeKind.Utc):O}", reason, null));
        after.Should().BeEquivalentTo(before with
        {
            Returns = Replace(before.Returns, oldReturn, newReturn, value => value.Id),
            Stocks = [stock],
            Movements = before.Movements.Append(movement).OrderBy(value => value.Id).ToArray(),
            Audits = lifecycle.Audits,
            Transitions = lifecycle.Transitions,
            Outbox = lifecycle.Outbox,
            Receipts = lifecycle.Receipts,
            DefaultNet = 0m
        });
    }

    private static void AssertExactActualDelta(Snapshot before, Snapshot after, Fixture fixture)
    {
        var oldActual = before.Actuals.Single(x => x.LineId == fixture.ActualLineId && x.Side == "ISSUED");
        var newActual = after.Actuals.Single(x => x.Id == oldActual.Id);
        newActual.Should().Be(oldActual with { Quantity = 4m, Version = 2, EnteredBy = fixture.ActorId, EnteredAt = newActual.EnteredAt });
        var revision = after.Revisions.Except(before.Revisions).Should().ContainSingle().Subject;
        revision.Should().Be(new RevisionValue(revision.Id, oldActual.Id, 5m, 4m, "Correct exact manual ISSUED actual.", fixture.ActorId, revision.ChangedAt));
        after.Should().BeEquivalentTo(before with
        {
            Actuals = Replace(before.Actuals, oldActual, newActual, value => value.Id),
            Revisions = before.Revisions.Append(revision).OrderBy(value => value.Id).ToArray()
        });
    }

    private static void AssertExactDispositionDelta(Snapshot before, Snapshot after, Fixture fixture)
    {
        var disposition = after.Dispositions.Except(before.Dispositions).Should().ContainSingle().Subject;
        disposition.Should().Be(new DispositionValue(disposition.Id, fixture.ActualLineId, "FOLLOW_UP_REQUIRED",
            "Investigate exact persisted variance.", 1, fixture.ActorId, disposition.DisposedAt));
        after.Should().BeEquivalentTo(before with
        {
            Dispositions = before.Dispositions.Append(disposition).OrderBy(value => value.Id).ToArray()
        });
    }

    private static LifecycleEffect AssertExactLifecycleDelta(Snapshot before, Snapshot after, string commandId, string aggregateType,
        string aggregateId, int sequence, string? fromState, string toState, long expectedVersion, string reason, string actorId, string expectedJson, int additionalAuditCount = 0)
    {
        var transition = after.Transitions.Except(before.Transitions).Should().ContainSingle().Subject;
        transition.Should().Be(new TransitionValue(transition.Id, aggregateType, aggregateId, commandId, sequence, fromState, toState,
            actorId, expectedVersion, reason, null, null, transition.PayloadJson, 1, transition.CreatedAt));
        transition.PayloadJson.Should().NotBeNullOrWhiteSpace();
        JsonNode.DeepEquals(JsonNode.Parse(transition.PayloadJson!), JsonNode.Parse(expectedJson)).Should().BeTrue("the lifecycle payload is reconstructed from command/result semantics, not copied from the observed row");
        var outbox = after.Outbox.Except(before.Outbox).Should().ContainSingle().Subject;
        outbox.Should().Be(new OutboxValue(outbox.Id, $"{aggregateType}.Transitioned", aggregateType, aggregateId, sequence, commandId,
            transition.PayloadJson!, "PENDING", 0, null, null, null, null, transition.CreatedAt));
        var receipt = after.Receipts.Except(before.Receipts).Should().ContainSingle().Subject;
        receipt.Should().Be(new ReceiptValue(receipt.Id, commandId, aggregateType, aggregateId, receipt.ResponseJson, transition.CreatedAt));
        receipt.ResponseJson.Should().NotBeNullOrWhiteSpace();
        JsonNode.DeepEquals(JsonNode.Parse(receipt.ResponseJson), JsonNode.Parse(expectedJson)).Should().BeTrue("the command receipt response is independently reconstructed");
        var generatedAudits = after.Audits.Except(before.Audits).ToArray();
        generatedAudits.Should().HaveCount(1 + additionalAuditCount);
        var lifecycleAudit = generatedAudits.Single(value => value.BusinessArea == "Lifecycle");
        lifecycleAudit.Should().Be(new AuditValue(lifecycleAudit.Id, transition.CreatedAt, actorId, "Lifecycle", aggregateType, aggregateId,
            "Transition", fromState, toState, reason, null));
        return new(
            before.Transitions.Append(transition).OrderBy(value => value.Id).ToArray(),
            before.Outbox.Append(outbox).OrderBy(value => value.Id).ToArray(),
            before.Receipts.Append(receipt).OrderBy(value => value.Id).ToArray(),
            before.Audits.Concat(generatedAudits).OrderBy(value => value.Id).ToArray());
    }

    private sealed record LifecycleEffect(TransitionValue[] Transitions, OutboxValue[] Outbox, ReceiptValue[] Receipts, AuditValue[] Audits);

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
            CommandId = "p30-recon-issue", ExpectedVersion = 2, ReconciliationBatchId = IssueBatchId, IssueDate = new DateOnly(2026, 8, 30), WarehouseId = Id(warehouse)!,
            Lines = [new CreateInventoryIssueLineRequest { ReconciliationBatchLineId = IssueLineId, IngredientId = Id(ingredient)!, UnitId = Id(unit)!, RequestedQty = 5m, IssuedQty = 5m }]
        };

        public CreateInventoryReturnRequest ReturnCommand(string issueId, string sourceLineId) => new()
        {
            CommandId = "p30-recon-return", ReturnDate = new DateOnly(2026, 8, 30), ReturnType = "RETURN", WarehouseId = Id(warehouse)!, IssueId = issueId, Reason = "Return exact reconciliation quantity.",
            Lines = [new CreateInventoryReturnLineRequest { SourceIssueLineId = sourceLineId, IngredientId = Id(ingredient)!, UnitId = Id(unit)!, Quantity = 2m }]
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
                issues.Select(x => new IssueValue(Id(x.IssueId)!, x.IssueCode, Id(x.MaterialRequestId), Id(x.ReconciliationBatchId), Id(x.ReceivedBy), x.ReceivedAt)).OrderBy(x => x.Id).ToArray(),
                issueLines.Select(x => new IssueLineValue(Id(x.IssueLineId)!, Id(x.IssueId)!, Id(x.MaterialRequestLineId), Id(x.ReconciliationBatchLineId), x.IssuedQty)).OrderBy(x => x.Id).ToArray(),
                returns.Select(x => new ReturnValue(Id(x.ReturnId)!, x.ReturnCode, Id(x.IssueId)!, Id(x.ReceivedBy), x.ReceivedAt)).OrderBy(x => x.Id).ToArray(),
                returnLines.Select(x => new ReturnLineValue(Id(x.ReturnLineId)!, Id(x.ReturnId)!, Id(x.SourceIssueLineId)!, x.Quantity)).OrderBy(x => x.Id).ToArray(),
                (await Context.Currentstocks.AsNoTracking().ToListAsync()).Select(x => new StockValue(Id(x.WarehouseId)!, Id(x.IngredientId)!, Id(x.UnitId)!, x.CurrentQty)).OrderBy(x => x.IngredientId).ToArray(),
                (await Context.Stockmovements.AsNoTracking().ToListAsync()).Select(x => new MovementValue(Id(x.MovementId)!, x.MovementType, x.RefTable!, Id(x.RefId)!, x.QuantityOut, x.QuantityIn)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationactuals.AsNoTracking().ToListAsync()).Select(x => new ActualValue(Id(x.ActualId)!, Id(x.BatchLineId)!, x.Side, x.Quantity, x.Version, Id(x.EnteredBy)!, x.EnteredAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationactualrevisions.AsNoTracking().ToListAsync()).Select(x => new RevisionValue(Id(x.RevisionId)!, Id(x.ActualId)!, x.OldQuantity, x.NewQuantity, x.Reason, Id(x.ChangedBy)!, x.ChangedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Reconciliationdispositions.AsNoTracking().ToListAsync()).Select(x => new DispositionValue(Id(x.DispositionId)!, Id(x.BatchLineId)!, x.Category, x.Reason, x.Version, Id(x.DisposedBy)!, x.DisposedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Auditlogs.AsNoTracking().ToListAsync()).Select(x => new AuditValue(Id(x.AuditId)!, x.ChangedAt, Id(x.ChangedBy)!, x.BusinessArea, x.EntityName, Id(x.EntityId), x.FieldName, x.OldValue, x.NewValue, x.Reason, x.CorrelationId)).OrderBy(x => x.Id).ToArray(),
                (await Context.Lifecycletransitions.AsNoTracking().ToListAsync()).Select(x => new TransitionValue(Id(x.TransitionId)!, x.AggregateType, Id(x.AggregateId)!, x.CommandId, x.AggregateSequence, x.FromState, x.ToState, Id(x.ActorId), x.ExpectedVersion, x.Reason, x.CorrelationId, x.CausationId, x.PayloadJson, x.SchemaVersion, x.CreatedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Lifecycleoutboxmessages.AsNoTracking().ToListAsync()).Select(x => new OutboxValue(Id(x.OutboxMessageId)!, x.EventType, x.AggregateType, Id(x.AggregateId)!, x.AggregateSequence, x.CommandId, x.PayloadJson, x.Status, x.AttemptCount, x.NextAttemptAt, x.LockedAt, x.ProcessedAt, x.LastError, x.CreatedAt)).OrderBy(x => x.Id).ToArray(),
                (await Context.Lifecyclecommandreceipts.AsNoTracking().ToListAsync()).Select(x => new ReceiptValue(Id(x.CommandReceiptId)!, x.CommandId, x.AggregateType, Id(x.AggregateId)!, x.ResponseJson, x.CreatedAt)).OrderBy(x => x.Id).ToArray(),
                await ReadCommonLedgerAsync(),
                await Context.Systemoperationmodes.AsNoTracking().Select(x => new ModeValue(x.Mode, x.Version, x.UpdatedAt, Id(x.UpdatedBy)!, x.Reason)).SingleAsync(),
                reconIssued - reconReturned, defaultIssued - defaultReturned);
        }

        private async Task<LedgerTable[]> ReadCommonLedgerAsync()
        {
            var requested = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "materialrequests", "materialrequestlines", "supplementalmaterialrequests",
                "purchaserequests", "purchaserequestlines", "purchaselinesupplierdecisions", "purchasepriceexceptions",
                "purchaseorders", "purchaseorderlines", "purchasereceiptactivelines",
                "approvalhistories", "approvalrules", "approvalassignments"
            };
            var tables = new List<LedgerTable>();
            await using var tableCommand = connection.CreateCommand();
            tableCommand.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
            await using var tableReader = await tableCommand.ExecuteReaderAsync();
            var existing = new List<string>();
            while (await tableReader.ReadAsync())
                if (requested.Contains(tableReader.GetString(0))) existing.Add(tableReader.GetString(0));
            await tableReader.DisposeAsync();
            existing.Should().BeEquivalentTo(requested, "the local schema must cover every declared supplemental, purchasing, and approval ledger");

            foreach (var table in existing.OrderBy(value => value, StringComparer.Ordinal))
            {
                await using var command = connection.CreateCommand();
                command.CommandText = $"SELECT * FROM {table}";
                await using var reader = await command.ExecuteReaderAsync();
                var rows = new List<string>();
                while (await reader.ReadAsync())
                {
                    var values = Enumerable.Range(0, reader.FieldCount).Select(index =>
                    {
                        if (reader.IsDBNull(index)) return "<NULL>";
                        return reader.GetValue(index) is byte[] bytes ? Convert.ToHexString(bytes) : Convert.ToString(reader.GetValue(index), System.Globalization.CultureInfo.InvariantCulture)!;
                    });
                    rows.Add(string.Join("\u001f", values));
                }
                tables.Add(new LedgerTable(table, rows.OrderBy(value => value, StringComparer.Ordinal).ToArray()));
            }
            return tables.ToArray();
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
CREATE TABLE approvalrules (ruleId BLOB PRIMARY KEY, ruleName TEXT NOT NULL, documentType TEXT NOT NULL, minAmount TEXT NULL, maxAmount TEXT NULL, slaHours INTEGER NULL, isActive INTEGER NOT NULL, createdAt TEXT NOT NULL);
CREATE TABLE approvalassignments (assignmentId BLOB PRIMARY KEY, ruleId BLOB NOT NULL, sequence INTEGER NOT NULL, approverRole TEXT NOT NULL, approverUserId BLOB NULL, isRequired INTEGER NOT NULL);
""";
    }

    private sealed record Snapshot(string ActorId, BatchValue[] Batches, BatchLineValue[] BatchLines, ContributorValue[] Contributors, IssueValue[] Issues, IssueLineValue[] IssueLines, ReturnValue[] Returns, ReturnLineValue[] ReturnLines, StockValue[] Stocks, MovementValue[] Movements, ActualValue[] Actuals, RevisionValue[] Revisions, DispositionValue[] Dispositions, AuditValue[] Audits, TransitionValue[] Transitions, OutboxValue[] Outbox, ReceiptValue[] Receipts, LedgerTable[] CommonLedger, ModeValue Mode, decimal ReconciliationNet, decimal DefaultNet);
    private sealed record BatchValue(string Id, string Status, long Version, string? CompletedBy, DateTime? CompletedAt);
    private sealed record BatchLineValue(string Id, string BatchId, decimal RequiredQuantity, long Version);
    private sealed record ContributorValue(string Id, string LineId, decimal SourceQuantity);
    private sealed record IssueValue(string Id, string Code, string? MaterialRequestId, string? ReconciliationBatchId, string? ReceivedBy, DateTime? ReceivedAt);
    private sealed record IssueLineValue(string Id, string IssueId, string? MaterialRequestLineId, string? ReconciliationBatchLineId, decimal IssuedQty);
    private sealed record ReturnValue(string Id, string Code, string IssueId, string? ReceivedBy, DateTime? ReceivedAt);
    private sealed record ReturnLineValue(string Id, string ReturnId, string SourceIssueLineId, decimal Quantity);
    private sealed record StockValue(string WarehouseId, string IngredientId, string UnitId, decimal Qty);
    private sealed record MovementValue(string Id, string Type, string RefTable, string RefId, decimal QuantityOut, decimal QuantityIn);
    private sealed record ActualValue(string Id, string LineId, string Side, decimal Quantity, long Version, string EnteredBy, DateTime EnteredAt);
    private sealed record RevisionValue(string Id, string ActualId, decimal OldQuantity, decimal NewQuantity, string Reason, string ChangedBy, DateTime ChangedAt);
    private sealed record DispositionValue(string Id, string LineId, string Category, string Reason, long Version, string DisposedBy, DateTime DisposedAt);
    private sealed record AuditValue(string Id, DateTime ChangedAt, string ChangedBy, string BusinessArea, string EntityName, string? EntityId, string? FieldName, string? OldValue, string? NewValue, string? Reason, string? CorrelationId);
    private sealed record TransitionValue(string Id, string AggregateType, string AggregateId, string CommandId, int AggregateSequence, string? FromState, string ToState, string? ActorId, long ExpectedVersion, string? Reason, string? CorrelationId, string? CausationId, string? PayloadJson, int SchemaVersion, DateTime CreatedAt);
    private sealed record OutboxValue(string Id, string EventType, string AggregateType, string AggregateId, int AggregateSequence, string CommandId, string PayloadJson, string Status, int AttemptCount, DateTime? NextAttemptAt, DateTime? LockedAt, DateTime? ProcessedAt, string? LastError, DateTime CreatedAt);
    private sealed record ReceiptValue(string Id, string CommandId, string AggregateType, string AggregateId, string ResponseJson, DateTime CreatedAt);
    private sealed record LedgerTable(string Name, string[] Rows);
    private sealed record ModeValue(string Mode, long Version, DateTime UpdatedAt, string UpdatedBy, string? Reason);
}
