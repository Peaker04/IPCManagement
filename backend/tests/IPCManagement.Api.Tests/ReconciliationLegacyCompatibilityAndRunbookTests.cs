using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationLegacyCompatibilityAndRunbookTests
{
    private static async Task EnsureSchemaAsync(IpcManagementContext context) => await context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationsourcerevisions (sourceRevisionId BLOB PRIMARY KEY, menuAmendmentId BLOB NOT NULL, batchId BLOB NOT NULL, previousMenuVersionId BLOB NOT NULL, appliedMenuVersionId BLOB NOT NULL, revisionNumber INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, appliedBy BLOB NOT NULL, appliedAt TEXT NOT NULL, AppliedByRole TEXT NULL, ApplyMode TEXT NULL, UNIQUE (menuAmendmentId, batchId), UNIQUE (batchId, revisionNumber));
        CREATE TABLE IF NOT EXISTS reconciliationsourcedeltas (SourceDeltaId BLOB PRIMARY KEY, SourceRevisionId BLOB NOT NULL, BatchId BLOB NOT NULL, DailyLineId BLOB NULL, ServiceDate TEXT NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL, PreviousRequiredQuantity TEXT NOT NULL, NewRequiredQuantity TEXT NOT NULL, DeltaQuantity TEXT NOT NULL, WorkKind TEXT NOT NULL, Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedAt TEXT NOT NULL, ResolvedAt TEXT NULL, ResolvedBy BLOB NULL, ResolutionEntity TEXT NULL, ResolutionId BLOB NULL, ResolutionCommandId TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdailydispositions (dispositionId BLOB PRIMARY KEY, dailyLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, InvalidatedAt TEXT NULL, InvalidatedBy BLOB NULL, InvalidationReason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationactuals (actualId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, side TEXT NOT NULL, quantity TEXT NOT NULL, version INTEGER NOT NULL, enteredBy BLOB NOT NULL, enteredAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationdispositions (dispositionId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL);
        """);

    [Fact]
    public async Task Legacy_Batch_Without_Daily_Lineage_Is_Readable_Without_Implicit_Backfill()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();

        // Shape 1: Legacy batch with weekly lines only, ZERO daily lines
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 20m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
                }
            ]
        });
        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, OperationKey = "reconciliation.legacy.read", ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);

        // Act
        var batchDto = await batches.GetAsync(GuidHelper.ToGuidString(batchId));
        var dailyDto = await batches.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batchId));

        // Assert: Readable, but marked as incompatible with daily issuance
        batchDto.Should().NotBeNull();
        dailyDto.Should().NotBeNull();
        dailyDto!.Compatibility.CanRead.Should().BeTrue();
        dailyDto.Compatibility.CanIssueByDate.Should().BeFalse();
        dailyDto.Compatibility.ReasonCode.Should().Be("LEGACY_DAILY_LINEAGE_MISSING");

        // Invariant: ZERO implicit backfill or row generation!
        context.ChangeTracker.Clear();
        (await context.Reconciliationbatchdailylines.CountAsync(d => d.BatchId == batchId)).Should().Be(0);
    }

    [Fact]
    public async Task Legacy_Batch_Denies_Daily_Mutations_With_Zero_Effects()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();

        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 20m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1
                }
            ]
        });
        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, OperationKey = "reconciliation.legacy.mutation", ExpectedModeVersion = 1 };
        var ledger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);

        // 1. Kitchen cooking export denies legacy batch without daily lineage
        var kitchenExport = new ReconciliationKitchenExportService(context);
        var actCooking = () => kitchenExport.GetAsync(GuidHelper.ToGuidString(batchId));
        await actCooking.Should().ThrowAsync<InvalidOperationException>().WithMessage("*LEGACY_DAILY_LINEAGE_MISSING*");

        // 2. Coordinated preparation issue denies legacy batch
        var prepService = new ReconciliationPreparationService(context, ledger, new ImmediateTransactionRunner(), warehouseResolver, requestContext);
        var actPrep = () => prepService.IssueCoordinatedAsync(new CoordinatedPreparationIssueRequest
        {
            CommandId = "legacy-prep-" + Guid.NewGuid().ToString("N"),
            ServiceDate = new DateOnly(2026, 6, 15),
            Batches = [new CoordinatedPreparationIssueBatchRequest { ReconciliationBatchId = GuidHelper.ToGuidString(batchId), ExpectedVersion = 2, Lines = [] }]
        }, fixture.UserIdString);
        await actPrep.Should().ThrowAsync<BusinessRuleException>().WithMessage("*không có định lượng*");

        // 3. Daily disposition denies non-existent daily lines
        var actualService = new ReconciliationActualService(context, new ImmediateTransactionRunner(), requestContext);
        var actDisp = () => actualService.SetDailyDispositionAsync(GuidHelper.ToGuidString(GuidHelper.NewId()), new SetReconciliationDispositionRequest("ACCEPTED_VARIANCE", "test", null), fixture.UserIdString);
        await actDisp.Should().ThrowAsync<KeyNotFoundException>();

        // Zero mutation effects
        context.ChangeTracker.Clear();
        (await context.Inventoryissues.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Reconciliationdailydispositions.CountAsync()).Should().Be(0);
        (await context.Reconciliationbatches.SingleAsync()).Version.Should().Be(2);
    }

    [Fact]
    public async Task Completed_Batch_Is_Immutable_And_Rejects_All_Mutations()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureSchemaAsync(context);

        var batchId = GuidHelper.NewId();
        var lineId = GuidHelper.NewId();
        var dailyId = GuidHelper.NewId();
        var serviceDate = new DateOnly(2026, 6, 15);

        // Shape 2: Completed batch
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = batchId, MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(),
            Status = "COMPLETED", Version = 10, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            CompletedBy = fixture.UserId, CompletedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 10m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines =
                    [
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = dailyId, BatchLineId = lineId, BatchId = batchId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate, RequiredQuantity = 10m, Version = 1
                        }
                    ]
                }
            ]
        });
        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, OperationKey = "reconciliation.completed.read", ExpectedModeVersion = 1 };
        var batches = new ReconciliationBatchService(context, new ImmediateTransactionRunner(), requestContext);

        // 1. Compatibility reports read-only
        var dailyDto = await batches.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batchId));
        dailyDto!.Compatibility.CanRead.Should().BeTrue();
        dailyDto.Compatibility.CanIssueByDate.Should().BeFalse();
        dailyDto.Compatibility.ReasonCode.Should().Be("BATCH_READ_ONLY");

        // 2. Transfer to warehouse fails
        var actTransfer = () => batches.TransferToWarehouseAsync(GuidHelper.ToGuidString(batchId), new TransferReconciliationBatchRequest(10), fixture.UserIdString);
        await actTransfer.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // 3. Source recompute fails: COMPLETED locks every day (BR-MRX-EDIT-3)
        var recomputeBatch = await MrxBatchRecomputer.LoadBatchAsync(context, batchId, CancellationToken.None);
        var actStage = () => new MrxBatchRecomputer(context).ApplyAsync(recomputeBatch, [], new HashSet<DateOnly>(),
            new MrxRevisionStamp(fixture.UserId, "ADMIN", "DIRECT", "Edit", GuidHelper.NewId(), GuidHelper.NewId(), null), CancellationToken.None);
        (await actStage.Should().ThrowAsync<MrxSourceChangeException>()).Which.Code.Should().Be(MrxErrorCodes.BatchCompleted);

        // 4. Daily disposition fails
        var actualService = new ReconciliationActualService(context, new ImmediateTransactionRunner(), requestContext);
        var actDisp = () => actualService.SetDailyDispositionAsync(GuidHelper.ToGuidString(dailyId), new SetReconciliationDispositionRequest("ACCEPTED_VARIANCE", "Late edit", null), fixture.UserIdString);
        await actDisp.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Chỉ lô đang đối chiếu*");

        // 5. Completion fails
        var completionService = new ReconciliationCompletionService(context, batches, new ImmediateTransactionRunner(), requestContext);
        var actComplete = () => completionService.CompleteAsync(GuidHelper.ToGuidString(batchId), new CompleteReconciliationBatchRequest(10), fixture.UserIdString);
        await actComplete.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // Assert: 100% immutable
        context.ChangeTracker.Clear();
        var reloaded = await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchId);
        reloaded.Status.Should().Be("COMPLETED");
        reloaded.Version.Should().Be(10);
    }
}
