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
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationWarehouseIssueApplicationPathTests
{
    [Fact]
    public async Task Ready_snapshot_remains_exact_after_shared_master_edits_and_only_new_version_reflects_authority()
    {
        await using var context = CreateContext();
        var actor = GuidHelper.NewId();
        var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = GuidHelper.NewId(), WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "MAT-OLD", IngredientName = "Vật tư cũ", UnitId = unit.UnitId, Unit = unit, WarehouseId = warehouse.WarehouseId, Warehouse = warehouse, IsActive = true };
        var batch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "READY", Version = 2, CreatedBy = actor, CreatedAt = DateTime.UtcNow,
        };
        var line = new ReconciliationBatchLine
        {
            BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = ingredient.IngredientId,
            Ingredient = ingredient, CanonicalUnitId = unit.UnitId, CanonicalUnit = unit, RequiredQuantity = 12.345678m,
            FrozenTolerance = 0.125m, ToleranceSourceKind = "INGREDIENT", ToleranceSourceVersion = "4", Version = 1,
        };
        line.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line,
            MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(), SourceQuantity = 12.345678m,
        });
        batch.Lines.Add(line);
        context.AddRange(unit, warehouse, ingredient, batch);
        await context.SaveChangesAsync();
        var service = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), ProtectedContext());

        var before = await CaptureFrozenSnapshotAsync(context, batch.BatchId);
        ingredient.IngredientCode = "MAT-NEW";
        ingredient.IngredientName = "Vật tư mới";
        unit.UnitName = "kg changed";
        unit.ConvertRateToBase = 2;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var reloaded = await service.GetAsync(GuidHelper.ToGuidString(batch.BatchId));
        var after = await CaptureFrozenSnapshotAsync(context, batch.BatchId);
        Assert.NotNull(reloaded);
        Assert.Equal(before, after);

        var newBatch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 2,
            CreatedBy = actor, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = GuidHelper.NewId(), IngredientId = ingredient.IngredientId, CanonicalUnitId = unit.UnitId,
                    RequiredQuantity = 24.691356m, FrozenTolerance = 0.25m, ToleranceSourceKind = "INGREDIENT", ToleranceSourceVersion = "5", Version = 1,
                }
            ]
        };
        context.Reconciliationbatches.Add(newBatch);
        await context.SaveChangesAsync();
        var next = await CaptureFrozenSnapshotAsync(context, newBatch.BatchId);

        Assert.NotEqual(before.MenuVersionId, next.MenuVersionId);
        Assert.NotEqual(before.QuantityImportBatchId, next.QuantityImportBatchId);
        Assert.NotEqual(before.RequiredQuantity, next.RequiredQuantity);
        Assert.Equal(before.IngredientId, next.IngredientId);
        Assert.Equal(before.CanonicalUnitId, next.CanonicalUnitId);
    }

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
        var issueRequestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "inventoryissues.create",
            ExpectedModeVersion = 1,
            Disposition = OperationDisposition.Retained
        };
        var issues = new InventoryIssueService(repository, unitOfWork, ledger, new ImmediateTransactionRunner(), warehouse, context, issueRequestContext);
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
    public async Task Public_issue_seam_rejects_structurally_invalid_source_families_with_atomic_zero_effects(string invalidCase)
    {
        await using var context = CreateContext();
        var fixture = await CreateReconciliationIssueFixtureAsync(context);
        var request = CloneRequest(fixture.Request);
        request.CommandId = $"invalid-{invalidCase}";
        var materialRequestId = Guid.NewGuid().ToString();
        var materialRequestLineId = Guid.NewGuid().ToString();

        if (invalidCase == "both-header") request.MaterialRequestId = materialRequestId;
        if (invalidCase == "neither-header") request.ReconciliationBatchId = null;
        if (invalidCase == "both-line") request.Lines[0].MaterialRequestLineId = materialRequestLineId;
        if (invalidCase == "neither-line") request.Lines[0].ReconciliationBatchLineId = null;
        if (invalidCase == "header-line-mismatch")
        {
            request.MaterialRequestId = materialRequestId;
            request.ReconciliationBatchId = null;
        }

        var before = CaptureEffects(context);

        await Assert.ThrowsAnyAsync<ArgumentException>(() => fixture.Service.CreateAsync(request, fixture.ActorId));

        Assert.Equal(before, CaptureEffects(context));
        await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
    }

    [Fact]
    public async Task Default_issue_rejects_material_request_line_from_another_request_with_atomic_zero_effects()
    {
        await using var context = CreateContext();
        var fixture = await CreateDefaultIssueFixtureAsync(context);
        var before = CaptureEffects(context);

        await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Service.CreateAsync(fixture.Request, fixture.ActorId));

        Assert.Equal(before, CaptureEffects(context));
        await fixture.Ledger.DidNotReceiveWithAnyArgs().RemoveStockWithCheckAsync(default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
    }

    [Fact]
    public void Ef_model_enforces_every_expressible_issue_source_family_boundary()
    {
        using var context = CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var issue = model.FindEntityType(typeof(InventoryIssue))!;
        var line = model.FindEntityType(typeof(InventoryIssueLine))!;
        var issueCheck = Assert.Single(issue.GetCheckConstraints(), item => item.Name == "ckInventoryIssuesSourceFamily");
        var lineCheck = Assert.Single(line.GetCheckConstraints(), item => item.Name == "ckInventoryIssueLinesSourceFamily");

        Assert.Contains("materialRequestId` IS NOT NULL", issueCheck.Sql, StringComparison.Ordinal);
        Assert.Contains("reconciliationBatchId` IS NOT NULL", issueCheck.Sql, StringComparison.Ordinal);
        Assert.Contains("materialRequestLineId` IS NOT NULL", lineCheck.Sql, StringComparison.Ordinal);
        Assert.Contains("reconciliationBatchLineId` IS NOT NULL", lineCheck.Sql, StringComparison.Ordinal);
        Assert.Contains("materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NULL", lineCheck.Sql, StringComparison.Ordinal);
        Assert.True(line.GetIndexes().Single(index => index.Name == "uxInventoryIssueLinesReconciliationBatchLine").IsUnique);
        Assert.Contains(line.GetForeignKeys(), key => key.Properties.Single().Name == nameof(InventoryIssueLine.MaterialRequestLineId));
        Assert.Contains(line.GetForeignKeys(), key => key.Properties.Single().Name == nameof(InventoryIssueLine.ReconciliationBatchLineId));
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
    public async Task Reconciliation_issue_response_loss_replay_and_true_relational_duplicate_are_exactly_once()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-phase30-duplicate-{Guid.NewGuid():N}.db");
        try
        {
            var source = await SeedRelationalIssueDatabaseAsync(databasePath, "phase30-relational-duplicate");
            using var barrier = new Barrier(2);
            await using var first = await CreateRelationalIssueServiceAsync(databasePath, source, new BarrierPreWriteGate(barrier));
            await using var second = await CreateRelationalIssueServiceAsync(databasePath, source, new BarrierPreWriteGate(barrier));

            static async Task<(InventoryIssueCreatedDto? Result, Exception? Error)> Submit(RelationalIssueService service)
            {
                try { return (await service.Service.CreateAsync(CloneRequest(service.Source.Request), service.Source.ActorId), null); }
                catch (Exception error) { return (null, error); }
            }

            var results = await Task.WhenAll(Submit(first), Submit(second));
            Assert.Single(results, result => result.Result is not null);
            Assert.Single(results, result => result.Error is DbUpdateException or ResourceConflictException or SqliteException);

            await using var verify = CreateRelationalContext(databasePath);
            var winner = await verify.Inventoryissues.AsNoTracking().SingleAsync();
            var response = results.Single(result => result.Result is not null).Result!;
            Assert.Equal(GuidHelper.ToGuidString(winner.IssueId), response.IssueId);
            Assert.Single(await verify.Inventoryissuelines.AsNoTracking().ToListAsync());
            Assert.Single(await verify.Stockmovements.AsNoTracking().ToListAsync());
            Assert.Equal(18m, await verify.Currentstocks.AsNoTracking().Select(stock => stock.CurrentQty).SingleAsync());
            Assert.Single(await verify.Lifecycletransitions.AsNoTracking().ToListAsync());
            Assert.Single(await verify.Lifecyclecommandreceipts.AsNoTracking().ToListAsync());

            await using var replayService = await CreateRelationalIssueServiceAsync(databasePath, source);
            var replay = await replayService.Service.CreateAsync(CloneRequest(source.Request), source.ActorId);
            Assert.Equal(response.IssueId, replay!.IssueId);
            Assert.Equal(1, await verify.Inventoryissues.CountAsync());
            Assert.Equal(1, await verify.Stockmovements.CountAsync());
            Assert.Equal(18m, await verify.Currentstocks.Select(stock => stock.CurrentQty).SingleAsync());
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
    }

    [Fact]
    public async Task Reconciliation_issue_loses_separate_context_mode_change_with_relational_zero_ledger()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-phase30-mode-{Guid.NewGuid():N}.db");
        try
        {
            var source = await SeedRelationalIssueDatabaseAsync(databasePath, "phase30-relational-mode");
            var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            await using var authorityRead = CreateRelationalContext(databasePath);
            await using var command = await CreateRelationalIssueServiceAsync(
                databasePath, source, new DeterministicPreWriteGate(entered, release), new SystemOperationModeGuard(authorityRead));
            await using var beforeContext = CreateRelationalContext(databasePath);
            var before = await CaptureCompleteLedgerAsync(beforeContext);

            var pending = command.Service.CreateAsync(CloneRequest(source.Request), source.ActorId);
            await entered.Task;
            await using (var authorityContext = CreateRelationalContext(databasePath))
            {
                var authority = new SystemOperationModeService(
                    authorityContext, new SystemOperationModeGuard(authorityContext), new EfTransactionRunner(authorityContext));
                await authority.ChangeAsync(
                    new IPCManagement.Api.Features.SystemOperation.Contracts.ChangeSystemOperationModeRequest(
                        SystemOperationEligibility.Default, source.ModeVersion, true, "Deterministic phase 30 race"),
                    source.ActorId);
            }
            release.SetResult();

            await Assert.ThrowsAsync<SystemOperationConflictException>(() => pending);
            await using var afterContext = CreateRelationalContext(databasePath);
            var after = await CaptureCompleteLedgerAsync(afterContext);
            Assert.Equal(before with { Audits = before.Audits + 1, ModeVersion = before.ModeVersion + 1 }, after);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
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

    private static async Task<RelationalIssueSource> SeedRelationalIssueDatabaseAsync(string databasePath, string commandId)
    {
        await using var context = CreateRelationalContext(databasePath);
        await context.Database.EnsureDeletedAsync();
        await context.Database.EnsureCreatedAsync();
        await context.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
        await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys=OFF;");

        var actor = GuidHelper.NewId();
        var actorId = GuidHelper.ToGuidString(actor);
        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH-R", WarehouseName = "Relational warehouse", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-R", IngredientName = "Relational ingredient", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouse, IsActive = true };
        context.AddRange(unit, warehouse, ingredient,
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
                        BatchLineId = lineId, IngredientId = ingredientId, CanonicalUnitId = unitId,
                        RequiredQuantity = 2, FrozenTolerance = 0.1m, ToleranceSourceKind = "SYSTEM_DEFAULT",
                        ToleranceSourceVersion = "1", Version = 1
                    }
                ]
            });
        await context.SaveChangesAsync();

        return new RelationalIssueSource(
            actorId, 7,
            new CreateInventoryIssueRequest
            {
                CommandId = commandId,
                ExpectedVersion = 3,
                IssueDate = new DateOnly(2026, 8, 26),
                ReconciliationBatchId = GuidHelper.ToGuidString(batchId),
                Lines =
                [
                    new CreateInventoryIssueLineRequest
                    {
                        ReconciliationBatchLineId = GuidHelper.ToGuidString(lineId),
                        IngredientId = GuidHelper.ToGuidString(ingredientId),
                        UnitId = GuidHelper.ToGuidString(unitId),
                        RequestedQty = 2,
                        IssuedQty = 2
                    }
                ]
            });
    }

    private static async Task<RelationalIssueService> CreateRelationalIssueServiceAsync(
        string databasePath,
        RelationalIssueSource source,
        IInventoryIssuePreWriteGate? gate = null,
        SystemOperationModeGuard? guard = null)
    {
        var context = CreateRelationalContext(databasePath);
        await context.Database.ExecuteSqlRawAsync("PRAGMA busy_timeout=5000;");
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "inventory.issues.create.reconciliation",
            ExpectedModeVersion = source.ModeVersion,
            Disposition = OperationDisposition.ReconciliationOnly,
        };
        var resolvedGuard = guard ?? new SystemOperationModeGuard(context);
        var service = new InventoryIssueService(
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(new CurrentStockRepository(context), new StockMovementRepository(context)),
            new SqliteDeferredTransactionRunner(context, requestContext, resolvedGuard),
            new FixedWarehouseResolver(await context.Warehouses.AsNoTracking().Select(item => item.WarehouseId).SingleAsync()),
            context,
            requestContext,
            resolvedGuard,
            gate);
        return new RelationalIssueService(context, service, source);
    }

    private static RelationalIssueContext CreateRelationalContext(string databasePath)
    {
        var connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Private,
            Pooling = false,
            DefaultTimeout = 5,
            ForeignKeys = false,
        }.ToString();
        return new RelationalIssueContext(new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connectionString).Options);
    }

    private static async Task<CompleteLedger> CaptureCompleteLedgerAsync(IpcManagementContext context)
    {
        var batch = await context.Reconciliationbatches.AsNoTracking().SingleAsync();
        var stocks = await context.Currentstocks.AsNoTracking().OrderBy(item => item.IngredientId).Select(item => item.CurrentQty).ToListAsync();
        return new CompleteLedger(
            await context.Inventoryissues.CountAsync(),
            await context.Inventoryissuelines.CountAsync(),
            await context.Stockmovements.CountAsync(),
            string.Join('|', stocks.Select(item => $"{item:F6}")),
            await context.Auditlogs.CountAsync(),
            await context.Lifecycletransitions.CountAsync(),
            string.Join('|', await context.Lifecyclecommandreceipts.AsNoTracking().OrderBy(item => item.CommandId).Select(item => item.CommandId).ToListAsync()),
            batch.Status,
            batch.Version,
            await context.Systemoperationmodes.Select(item => item.Version).SingleAsync());
    }

    private sealed class SqliteDeferredTransactionRunner(
        RelationalIssueContext context,
        SystemOperationRequestContext requestContext,
        SystemOperationModeGuard modeGuard) : IEfTransactionRunner
    {
        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) =>
            ExecuteAsync(async token => { await operation(token); return true; }, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion,
            Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            requestContext.OperationKey = operationKey;
            requestContext.ExpectedModeVersion = expectedModeVersion;
            return ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);
        }

        public async Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            await context.Database.OpenConnectionAsync(cancellationToken);
            var connection = (SqliteConnection)context.Database.GetDbConnection();
            await using var transaction = connection.BeginTransaction(System.Data.IsolationLevel.Serializable, deferred: true);
            await context.Database.UseTransactionAsync(transaction, cancellationToken);
            try
            {
                await modeGuard.ValidateAsync(
                    requestContext.OperationKey ?? throw new InvalidOperationException("Operation key is required."),
                    requestContext.ExpectedModeVersion ?? throw new InvalidOperationException("Expected mode version is required."),
                    requestContext.Disposition,
                    cancellationToken);
                var result = await operation(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
            finally
            {
                await context.Database.UseTransactionAsync(null, cancellationToken);
                await context.Database.CloseConnectionAsync();
            }
        }
    }

    private sealed class BarrierPreWriteGate(Barrier barrier) : IInventoryIssuePreWriteGate
    {
        public Task WaitAsync(CancellationToken cancellationToken) => Task.Run(() =>
        {
            if (!barrier.SignalAndWait(TimeSpan.FromSeconds(10), cancellationToken))
                throw new TimeoutException("Both relational submissions did not reach the pre-write barrier.");
        }, cancellationToken);
    }

    private sealed class FixedWarehouseResolver(byte[] warehouseId) : IOperationalWarehouseResolver
    {
        public Task<byte[]> ResolveAsync(CancellationToken cancellationToken = default) => Task.FromResult(warehouseId);
    }

    private sealed class RelationalIssueContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.UseCollation("BINARY");
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
                foreach (var index in entity.GetIndexes())
                    index.SetDatabaseName($"{entity.GetTableName()}_{index.GetDatabaseName()}");
            foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
            {
                if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetColumnType("TEXT");
                if (property.GetCollation()?.Contains("utf8mb4", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetCollation("BINARY");
                if (property.GetDefaultValueSql()?.Contains("CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetDefaultValueSql("CURRENT_TIMESTAMP");
            }
        }
    }

    private sealed record RelationalIssueSource(string ActorId, long ModeVersion, CreateInventoryIssueRequest Request);

    private sealed class RelationalIssueService(RelationalIssueContext context, InventoryIssueService service, RelationalIssueSource source) : IAsyncDisposable
    {
        public InventoryIssueService Service { get; } = service;
        public RelationalIssueSource Source { get; } = source;
        public ValueTask DisposeAsync() => context.DisposeAsync();
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
        return new(service, repository, unitOfWork, ledger, warehouse, requestContext, request, actorId, actor, ingredientId, unitId);
    }

    private static async Task<ReconciliationIssueFixture> CreateDefaultIssueFixtureAsync(IpcManagementContext context)
    {
        var actorId = Guid.NewGuid().ToString();
        var actor = GuidHelper.ParseGuidString(actorId)!;
        var requestId = GuidHelper.NewId();
        var ownedLineId = GuidHelper.NewId();
        var foreignLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH", WarehouseName = "Kho", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-DEFAULT", IngredientName = "Nguyên liệu", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouse, IsActive = true };
        var materialRequest = new MaterialRequest
        {
            RequestId = requestId, RequestCode = "MR-PHASE30", RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY", Status = "SENTTOWAREHOUSE", CreatedBy = actor, PlanId = GuidHelper.NewId(),
            Materialrequestlines =
            [
                new MaterialRequestLine
                {
                    RequestLineId = ownedLineId, RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = ingredientId,
                    UnitId = unitId, TotalServings = 1, GrossQtyPerServing = 2, BomRatePercent = 100,
                    TotalRequiredQty = 2, CurrentStockQty = 20, SuggestedPurchaseQty = 0, Ingredient = ingredient, Unit = unit
                }
            ]
        };
        context.AddRange(unit, warehouse, ingredient, new CurrentStock
        {
            WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 20,
            Ingredient = ingredient, Unit = unit, Warehouse = warehouse
        });
        await context.SaveChangesAsync();
        var repository = Substitute.For<IInventoryIssueRepository>();
        repository.GetMaterialRequestForIssueAsync(Arg.Is<byte[]>(id => id.SequenceEqual(requestId))).Returns(materialRequest);
        repository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>()).Returns([]);
        repository.When(item => item.Add(Arg.Any<InventoryIssue>())).Do(call => context.Inventoryissues.Add(call.Arg<InventoryIssue>()));
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.SaveChangesAsync().Returns(_ => context.SaveChangesAsync());
        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        var service = new InventoryIssueService(repository, unitOfWork, ledger, new ImmediateTransactionRunner(), warehouseResolver, context);
        var request = new CreateInventoryIssueRequest
        {
            CommandId = $"phase30-default-{Guid.NewGuid():N}", ExpectedVersion = 0,
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow), MaterialRequestId = GuidHelper.ToGuidString(requestId),
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    MaterialRequestLineId = GuidHelper.ToGuidString(foreignLineId), IngredientId = GuidHelper.ToGuidString(ingredientId),
                    UnitId = GuidHelper.ToGuidString(unitId), RequestedQty = 2, IssuedQty = 2
                }
            ]
        };
        return new(service, repository, unitOfWork, ledger, warehouseResolver, new SystemOperationRequestContext(), request, actorId, actor, ingredientId, unitId);
    }

    private static CreateInventoryIssueRequest CloneRequest(CreateInventoryIssueRequest source) => new()
    {
        CommandId = source.CommandId,
        ExpectedVersion = source.ExpectedVersion,
        IssueDate = source.IssueDate,
        WarehouseId = source.WarehouseId,
        MaterialRequestId = source.MaterialRequestId,
        ReconciliationBatchId = source.ReconciliationBatchId,
        Lines = source.Lines.Select(line => new CreateInventoryIssueLineRequest
        {
            MaterialRequestLineId = line.MaterialRequestLineId,
            ReconciliationBatchLineId = line.ReconciliationBatchLineId,
            IngredientId = line.IngredientId,
            UnitId = line.UnitId,
            RequestedQty = line.RequestedQty,
            IssuedQty = line.IssuedQty
        }).ToList()
    };

    private static (int Issues, int Lines, int Movements, string Stock, int Audits, int Lifecycle, string Replays) CaptureEffects(IpcManagementContext context) =>
        (context.Inventoryissues.Count(), context.Inventoryissuelines.Count(), context.Stockmovements.Count(),
            string.Join('|', context.Currentstocks.OrderBy(item => item.IngredientId).Select(item => $"{Convert.ToHexString(item.WarehouseId)}:{Convert.ToHexString(item.IngredientId)}:{item.CurrentQty}")),
            context.Auditlogs.Count(), context.Lifecycletransitions.Count(),
            string.Join('|', context.Lifecyclecommandreceipts.OrderBy(item => item.CommandId).Select(item => $"{item.CommandId}:{item.ResponseJson}")));

    private sealed record ReconciliationIssueFixture(
        InventoryIssueService Service,
        IInventoryIssueRepository Repository,
        IUnitOfWork UnitOfWork,
        IStockLedgerService Ledger,
        IOperationalWarehouseResolver Warehouse,
        SystemOperationRequestContext RequestContext,
        CreateInventoryIssueRequest Request,
        string ActorId,
        byte[] Actor,
        byte[] IngredientId,
        byte[] UnitId);

    private static CompleteLedger CaptureCompleteLedger(IpcManagementContext context)
    {
        var effects = CaptureEffects(context);
        var batch = context.Reconciliationbatches.AsNoTracking().Single();
        var mode = context.Systemoperationmodes.AsNoTracking().Single();
        return new CompleteLedger(effects.Issues, effects.Lines, effects.Movements, effects.Stock, effects.Audits,
            effects.Lifecycle, effects.Replays, batch.Status, batch.Version, mode.Version);
    }

    private sealed record CompleteLedger(
        int Issues, int Lines, int Movements, string Stock, int Audits, int Lifecycle, string Replays,
        string BatchStatus, long BatchVersion, long ModeVersion);

    private sealed class DeterministicPreWriteGate(TaskCompletionSource entered, TaskCompletionSource release) : IInventoryIssuePreWriteGate
    {
        public async Task WaitAsync(CancellationToken token)
        {
            entered.TrySetResult();
            await release.Task.WaitAsync(token);
        }
    }

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

    private static async Task<FrozenSnapshot> CaptureFrozenSnapshotAsync(IpcManagementContext context, byte[] batchId)
    {
        var batch = await context.Reconciliationbatches.AsNoTracking().SingleAsync(item => item.BatchId == batchId);
        var line = await context.Reconciliationbatchlines.AsNoTracking().SingleAsync(item => item.BatchId == batchId);
        var contributors = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(item => item.BatchLineId == line.BatchLineId)
            .OrderBy(item => item.ContributorId)
            .Select(item => $"{Convert.ToHexString(item.ContributorId)}:{Convert.ToHexString(item.MenuScheduleId)}:{Convert.ToHexString(item.MealQuantityPlanLineId)}:{Convert.ToHexString(item.DishBomId)}:{item.SourceQuantity}")
            .ToListAsync();
        return new FrozenSnapshot(
            Convert.ToHexString(batch.MenuVersionId), Convert.ToHexString(batch.QuantityImportBatchId), Convert.ToHexString(line.BatchLineId),
            Convert.ToHexString(line.IngredientId), Convert.ToHexString(line.CanonicalUnitId), line.RequiredQuantity, line.FrozenTolerance,
            line.ToleranceSourceKind, line.ToleranceSourceVersion, line.Version, string.Join('|', contributors));
    }

    private static SystemOperationRequestContext ProtectedContext() => new()
    {
        Mode = SystemOperationEligibility.MaterialReconciliation,
        OperationKey = "reconciliationbatches.read",
        ExpectedModeVersion = 7,
        Disposition = OperationDisposition.ReconciliationOnly,
    };

    private sealed record FrozenSnapshot(
        string MenuVersionId, string QuantityImportBatchId, string BatchLineId, string IngredientId, string CanonicalUnitId,
        decimal RequiredQuantity, decimal FrozenTolerance, string ToleranceSourceKind, string ToleranceSourceVersion, long Version, string Contributors);

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-tracer-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }
}
