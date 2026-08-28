using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationWarehouseIssueApplicationPathTests
{
    [Fact]
    public async Task Frozen_batch_transfers_without_stock_mutation_then_real_issue_projects_exact_issued_quantity()
    {
        await using var context = CreateContext();
        var actorId = Guid.NewGuid().ToString();
        var actor = GuidHelper.ParseGuidString(actorId)!;
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId,
            MenuVersionId = GuidHelper.NewId(),
            QuantityImportBatchId = GuidHelper.NewId(),
            Status = "READY",
            Version = 2,
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId,
                    BatchId = batchId,
                    IngredientId = ingredientId,
                    CanonicalUnitId = unitId,
                    RequiredQuantity = 7.5m,
                    FrozenTolerance = 0.1m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT",
                    ToleranceSourceVersion = "1",
                    Version = 1
                }
            ]
        });
        await context.SaveChangesAsync();
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "reconciliationbatches.transfer",
            ExpectedModeVersion = 1
        };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);

        var transfer = await batches.TransferToWarehouseAsync(
            GuidHelper.ToGuidString(batchId),
            new TransferReconciliationBatchRequest(2),
            actorId);

        Assert.Equal("TRANSFERRED", transfer.Status);
        Assert.Equal(3, transfer.SourceVersion);
        var transferredLine = Assert.Single(transfer.Lines);
        Assert.Equal(GuidHelper.ToGuidString(lineId), transferredLine.BatchLineId);
        Assert.Equal(7.5m, transferredLine.RequiredQuantity);
        Assert.Empty(context.Inventoryissues);
        Assert.Empty(context.Stockmovements);

        var repository = Substitute.For<IInventoryIssueRepository>();
        repository.When(item => item.Add(Arg.Any<InventoryIssue>()))
            .Do(call => context.Inventoryissues.Add(call.Arg<InventoryIssue>()));
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.SaveChangesAsync().Returns(_ => context.SaveChangesAsync());
        var ledger = Substitute.For<IStockLedgerService>();
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        warehouse.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        var issues = new InventoryIssueService(repository, unitOfWork, ledger, new ImmediateTransactionRunner(), warehouse, context);

        var created = await issues.CreateAsync(new CreateInventoryIssueRequest
        {
            CommandId = "phase30-tracer",
            ExpectedVersion = 3,
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReconciliationBatchId = GuidHelper.ToGuidString(batchId),
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    ReconciliationBatchLineId = GuidHelper.ToGuidString(lineId),
                    IngredientId = GuidHelper.ToGuidString(ingredientId),
                    UnitId = GuidHelper.ToGuidString(unitId),
                    RequestedQty = 7.5m,
                    IssuedQty = 7.5m
                }
            ]
        }, actorId);

        Assert.NotNull(created);
        await ledger.Received(1).RemoveStockWithCheckAsync(
            warehouseId, ingredientId, unitId, 7.5m, "ISSUE", "inventoryissues",
            Arg.Any<byte[]>(), actor, "Xuất kho đối chiếu", Arg.Any<string>());

        var readback = await batches.GetAsync(GuidHelper.ToGuidString(batchId));
        var comparison = Assert.Single(readback!.Lines);
        Assert.Equal(7.5m, comparison.IssuedQuantity);
        Assert.Equal(0m, comparison.IssuedRequiredDifference);
        Assert.Equal("MATCHED", comparison.Status);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-tracer-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }
}
