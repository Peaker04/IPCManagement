using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Exceptions;
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

        var issued = ReconciliationBatchService.ProjectNetIssuedQuantities(
            context.Inventoryissuelines.Local
                .Where(item => item.ReconciliationBatchLineId is not null)
                .Select(item => (item.IssueLineId, item.ReconciliationBatchLineId!, item.IssuedQty)),
            context.Inventoryreturnlines.Local
                .Where(item => item.SourceIssueLineId is not null && item.Return.ReceivedAt is not null)
                .Select(item => (item.SourceIssueLineId!, item.Quantity)));
        var comparison = ReconciliationComparisonService.Map(
            sourceLine, [], null, issued[Convert.ToHexString(lineId)]);

        Assert.Equal(8m, comparison.IssuedQuantity);
        Assert.Equal(-2m, comparison.IssuedRequiredDifference);
        Assert.Equal("NEEDS_REVIEW", comparison.Status);
    }

    [Theory]
    [InlineData("both-header")]
    [InlineData("neither-header")]
    [InlineData("both-line")]
    [InlineData("neither-line")]
    [InlineData("header-line-mismatch")]
    public void Exact_one_source_validator_rejects_structurally_invalid_issue_requests(string invalidCase)
    {
        var requestId = Guid.NewGuid().ToString();
        var batchId = Guid.NewGuid().ToString();
        var requestLineId = Guid.NewGuid().ToString();
        var batchLineId = Guid.NewGuid().ToString();
        var request = new CreateInventoryIssueRequest
        {
            CommandId = "invalid-source-shape",
            ExpectedVersion = 1,
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            MaterialRequestId = invalidCase is "both-header" or "header-line-mismatch" ? requestId : null,
            ReconciliationBatchId = invalidCase is not "neither-header" and not "header-line-mismatch" ? batchId : null,
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    MaterialRequestLineId = invalidCase is "both-line" or "header-line-mismatch" ? requestLineId : null,
                    ReconciliationBatchLineId = invalidCase == "both-line" ? batchLineId : invalidCase == "neither-line" ? null : batchLineId,
                    IngredientId = Guid.NewGuid().ToString(),
                    UnitId = Guid.NewGuid().ToString(),
                    RequestedQty = 1,
                    IssuedQty = 1
                }
            ]
        };

        var result = new CreateInventoryIssueDtoValidator().Validate(request);

        Assert.False(result.IsValid);
    }

    [Fact]
    public async Task Reconciliation_issue_rejects_line_from_another_batch_with_atomic_zero_effects()
    {
        await using var context = CreateContext();
        var fixture = await CreateReconciliationIssueFixtureAsync(context);
        var foreignBatchId = GuidHelper.NewId();
        var foreignLineId = GuidHelper.NewId();
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = foreignBatchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 3, CreatedBy = fixture.Actor, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = foreignLineId, BatchId = foreignBatchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 2, FrozenTolerance = 0.1m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
                }
            ]
        });
        await context.SaveChangesAsync();
        var before = CaptureEffects(context);

        await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Service.CreateAsync(
            new CreateInventoryIssueRequest
            {
                CommandId = fixture.Request.CommandId,
                ExpectedVersion = fixture.Request.ExpectedVersion,
                IssueDate = fixture.Request.IssueDate,
                ReconciliationBatchId = fixture.Request.ReconciliationBatchId,
                Lines =
                [
                    new CreateInventoryIssueLineRequest
                    {
                        ReconciliationBatchLineId = GuidHelper.ToGuidString(foreignLineId),
                        IngredientId = fixture.Request.Lines[0].IngredientId,
                        UnitId = fixture.Request.Lines[0].UnitId,
                        RequestedQty = 2,
                        IssuedQty = 2
                    }
                ]
            }, fixture.ActorId));

        Assert.Equal(before, CaptureEffects(context));
        await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
    }

    [Fact]
    public async Task Reconciliation_issue_rechecks_mode_version_inside_transaction_before_commit()
    {
        await using var context = CreateContext();
        var fixture = await CreateReconciliationIssueFixtureAsync(context, raceModeVersion: true);
        var before = CaptureEffects(context);

        await Assert.ThrowsAsync<SystemOperationConflictException>(() => fixture.Service.CreateAsync(fixture.Request, fixture.ActorId));

        Assert.Equal(before, CaptureEffects(context));
        await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
    }

    private static async Task<ReconciliationIssueFixture> CreateReconciliationIssueFixtureAsync(
        IpcManagementContext context,
        bool raceModeVersion = false)
    {
        var actorId = Guid.NewGuid().ToString();
        var actor = GuidHelper.ParseGuidString(actorId)!;
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouseEntity = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-TDD", IngredientName = "Nguyên liệu", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouseEntity, IsActive = true };
        context.AddRange(unit, warehouseEntity, ingredient,
            new CurrentStock { WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 20 },
            new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.MaterialReconciliation, Version = 7, UpdatedAt = DateTime.UtcNow, UpdatedBy = actor },
            new ReconciliationBatch
            {
                BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
                Status = "TRANSFERRED", Version = 3, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
                Lines =
                [
                    new ReconciliationBatchLine
                    {
                        BatchLineId = lineId, BatchId = batchId, IngredientId = ingredientId, CanonicalUnitId = unitId,
                        RequiredQuantity = 2, FrozenTolerance = 0.1m, ToleranceSourceKind = "SYSTEM_DEFAULT",
                        ToleranceSourceVersion = "1", Version = 1, Ingredient = ingredient, CanonicalUnit = unit
                    }
                ]
            });
        await context.SaveChangesAsync();
        var repository = Substitute.For<IInventoryIssueRepository>();
        repository.When(item => item.Add(Arg.Any<InventoryIssue>())).Do(call => context.Inventoryissues.Add(call.Arg<InventoryIssue>()));
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.SaveChangesAsync().Returns(_ => context.SaveChangesAsync());
        var ledger = Substitute.For<IStockLedgerService>();
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        warehouse.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "inventoryissues.create",
            ExpectedModeVersion = 7,
            Disposition = OperationDisposition.Retained
        };
        IEfTransactionRunner runner = raceModeVersion
            ? new ModeRacingTransactionRunner(context, requestContext)
            : new ImmediateTransactionRunner();
        var service = new InventoryIssueService(repository, unitOfWork, ledger, runner, warehouse, context, requestContext);
        var request = new CreateInventoryIssueRequest
        {
            CommandId = $"phase30-{Guid.NewGuid():N}", ExpectedVersion = 3,
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow), ReconciliationBatchId = GuidHelper.ToGuidString(batchId),
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    ReconciliationBatchLineId = GuidHelper.ToGuidString(lineId), IngredientId = GuidHelper.ToGuidString(ingredientId),
                    UnitId = GuidHelper.ToGuidString(unitId), RequestedQty = 2, IssuedQty = 2
                }
            ]
        };
        return new(service, ledger, request, actorId, actor, ingredientId, unitId);
    }

    private static (int Issues, int Lines, int Movements, int Audits, int Lifecycle) CaptureEffects(IpcManagementContext context) =>
        (context.Inventoryissues.Count(), context.Inventoryissuelines.Count(), context.Stockmovements.Count(),
            context.Auditlogs.Count(), context.Lifecycletransitions.Count());

    private sealed record ReconciliationIssueFixture(
        InventoryIssueService Service,
        IStockLedgerService Ledger,
        CreateInventoryIssueRequest Request,
        string ActorId,
        byte[] Actor,
        byte[] IngredientId,
        byte[] UnitId);

    private sealed class ModeRacingTransactionRunner(
        IpcManagementContext context,
        SystemOperationRequestContext requestContext) : IEfTransactionRunner
    {
        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) =>
            operation(cancellationToken);

        public async Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion,
            Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            requestContext.OperationKey = operationKey;
            requestContext.ExpectedModeVersion = expectedModeVersion;
            var authority = await context.Systemoperationmodes.SingleAsync(cancellationToken);
            authority.Version++;
            await context.SaveChangesAsync(cancellationToken);
            await new SystemOperationModeGuard(context).ValidateAsync(operationKey, expectedModeVersion, requestContext.Disposition, cancellationToken);
            return await operation(cancellationToken);
        }
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-tracer-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }
}
