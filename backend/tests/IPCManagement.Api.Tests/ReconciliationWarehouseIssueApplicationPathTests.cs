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
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouseEntity = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-01", IngredientName = "Nguyên liệu", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouseEntity, IsActive = true };
        context.Units.Add(unit);
        context.Warehouses.Add(warehouseEntity);
        context.Ingredients.Add(ingredient);
        context.Currentstocks.Add(new CurrentStock { WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 20 });
        var sourceLine = new ReconciliationBatchLine
        {
            BatchLineId = lineId, BatchId = batchId, IngredientId = ingredientId, CanonicalUnitId = unitId,
            RequiredQuantity = 7.5m, FrozenTolerance = 0.1m, ToleranceSourceKind = "SYSTEM_DEFAULT",
            ToleranceSourceVersion = "1", Version = 1, Ingredient = ingredient, CanonicalUnit = unit
        };
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId,
            MenuVersionId = GuidHelper.NewId(),
            QuantityImportBatchId = GuidHelper.NewId(),
            Status = "READY",
            Version = 2,
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow,
            Lines = [sourceLine]
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
        if (!context.Currentstocks.Local.Any())
            context.Currentstocks.Add(new CurrentStock { WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 20, Ingredient = ingredient, Unit = unit, Warehouse = warehouseEntity });
        Assert.Equal(20m, Assert.Single(context.Currentstocks.Local).CurrentQty);

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
            Arg.Any<byte[]>(), Arg.Is<byte[]>(value => value.SequenceEqual(actor)), "Xuất kho đối chiếu", Arg.Any<string>());

        var storedIssueLine = Assert.Single(context.Inventoryissuelines.Local);
        Assert.True(storedIssueLine.ReconciliationBatchLineId!.SequenceEqual(lineId));
        var comparison = ReconciliationComparisonService.Map(sourceLine, [], null, storedIssueLine.IssuedQty);
        Assert.Equal(7.5m, comparison.IssuedQuantity);
        Assert.Equal(0m, comparison.IssuedRequiredDifference);
        Assert.Equal("MATCHED", comparison.Status);
    }

    [Fact]
    public async Task Multiple_partial_issues_sum_exact_linked_lines_and_subtract_only_received_source_linked_returns()
    {
        await using var context = CreateContext();
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var otherLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var actor = GuidHelper.NewId();
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-01", IngredientName = "Nguyên liệu", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouse, IsActive = true };
        var sourceLine = new ReconciliationBatchLine
        {
            BatchLineId = lineId, BatchId = batchId, IngredientId = ingredientId, CanonicalUnitId = unitId,
            RequiredQuantity = 10m, FrozenTolerance = 0.1m, ToleranceSourceKind = "SYSTEM_DEFAULT",
            ToleranceSourceVersion = "1", Version = 1, Ingredient = ingredient, CanonicalUnit = unit
        };
        var batch = new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS", Version = 4, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
            Lines = [sourceLine]
        };
        var firstIssue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-PART-1", IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId, ReconciliationBatchId = batchId, IssuedBy = actor, CreatedAt = DateTime.UtcNow
        };
        var firstLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = firstIssue.IssueId, IngredientId = ingredientId, UnitId = unitId,
            RequestedQty = 10m, IssuedQty = 4m, ReconciliationBatchLineId = lineId, Issue = firstIssue
        };
        firstIssue.Inventoryissuelines.Add(firstLine);
        var secondIssue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-PART-2", IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId, ReconciliationBatchId = batchId, IssuedBy = actor, CreatedAt = DateTime.UtcNow
        };
        secondIssue.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = secondIssue.IssueId, IngredientId = ingredientId, UnitId = unitId,
            RequestedQty = 10m, IssuedQty = 5m, ReconciliationBatchLineId = lineId, Issue = secondIssue
        });
        secondIssue.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = secondIssue.IssueId, IngredientId = ingredientId, UnitId = unitId,
            RequestedQty = 99m, IssuedQty = 99m, ReconciliationBatchLineId = otherLineId, Issue = secondIssue
        });
        var receivedReturn = new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-RECEIVED", ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReturnType = "RETURN", WarehouseId = warehouseId, IssueId = firstIssue.IssueId, CreatedBy = actor,
            CreatedAt = DateTime.UtcNow, ReceivedBy = actor, ReceivedAt = DateTime.UtcNow, Issue = firstIssue, Warehouse = warehouse
        };
        receivedReturn.Inventoryreturnlines.Add(new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(), ReturnId = receivedReturn.ReturnId, IngredientId = ingredientId, UnitId = unitId,
            SourceIssueLineId = firstLine.IssueLineId, Quantity = 1m, Return = receivedReturn, SourceIssueLine = firstLine,
            Ingredient = ingredient, Unit = unit
        });
        var pendingReturn = new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "RET-PENDING", ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReturnType = "RETURN", WarehouseId = warehouseId, IssueId = firstIssue.IssueId, CreatedBy = actor,
            CreatedAt = DateTime.UtcNow, Issue = firstIssue, Warehouse = warehouse
        };
        pendingReturn.Inventoryreturnlines.Add(new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(), ReturnId = pendingReturn.ReturnId, IngredientId = ingredientId, UnitId = unitId,
            SourceIssueLineId = firstLine.IssueLineId, Quantity = 2m, Return = pendingReturn, SourceIssueLine = firstLine,
            Ingredient = ingredient, Unit = unit
        });
        context.AddRange(unit, warehouse, ingredient, batch, sourceLine, firstIssue, secondIssue, receivedReturn, pendingReturn);
        await context.SaveChangesAsync();

        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), new SystemOperationRequestContext());
        var result = Assert.Single(await service.ListAsync());

        var comparison = Assert.Single(result.Lines);
        Assert.Equal(8m, comparison.IssuedQuantity);
        Assert.Equal(-2m, comparison.IssuedRequiredDifference);
        Assert.Equal("NEEDS_REVIEW", comparison.Status);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-tracer-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }
}
