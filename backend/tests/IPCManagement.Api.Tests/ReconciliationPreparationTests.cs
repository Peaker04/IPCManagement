using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationPreparationTests
{
    private static async Task<(byte[] CustomerAId, byte[] CustomerBId, byte[] BatchAId, byte[] BatchBId, byte[] LineAId, byte[] LineBId, byte[] DailyAId, byte[] DailyBId, DateOnly ServiceDate)> SetupTwoCustomerBatchesAsync(WorkflowGenerationTests.WorkflowFixture fixture, IpcManagementContext context)
    {
        await EnsureSchemaAsync(context);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        var serviceDate = new DateOnly(2026, 6, 15);
        var customerAId = fixture.CustomerId;
        var customerBId = GuidHelper.NewId();
        context.Customers.Add(new Customer { CustomerId = customerBId, CustomerCode = "CUST-B", CustomerName = "Khách hàng B", IsActive = true });

        var versionA = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerAId, WeekStartDate = serviceDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        var versionB = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = customerBId, WeekStartDate = serviceDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.AddRange(versionA, versionB);

        var batchAId = GuidHelper.NewId();
        var batchBId = GuidHelper.NewId();
        var lineAId = GuidHelper.NewId();
        var lineBId = GuidHelper.NewId();
        var dailyAId = GuidHelper.NewId();
        var dailyBId = GuidHelper.NewId();

        var batchA = new ReconciliationBatch
        {
            BatchId = batchAId, MenuVersionId = versionA.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 2, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineAId, BatchId = batchAId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 5m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines =
                    [
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = dailyAId, BatchLineId = lineAId, BatchId = batchAId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate, RequiredQuantity = 5m, Version = 1
                        }
                    ]
                }
            ]
        };

        var batchB = new ReconciliationBatch
        {
            BatchId = batchBId, MenuVersionId = versionB.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
            Status = "TRANSFERRED", Version = 3, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = lineBId, BatchId = batchBId, IngredientId = fixture.IngredientId,
                    CanonicalUnitId = fixture.UnitId, RequiredQuantity = 3m, FrozenTolerance = 0.5m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1,
                    DailyLines =
                    [
                        new ReconciliationBatchDailyLine
                        {
                            DailyLineId = dailyBId, BatchLineId = lineBId, BatchId = batchBId,
                            IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
                            ServiceDate = serviceDate, RequiredQuantity = 3m, Version = 1
                        }
                    ]
                }
            ]
        };

        context.Reconciliationbatches.AddRange(batchA, batchB);
        context.Currentstocks.Add(new CurrentStock { WarehouseId = fixture.WarehouseId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, CurrentQty = 50m, LastUpdated = DateTime.UtcNow });
        context.Systemoperationmodes.Add(new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.MaterialReconciliation, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = fixture.UserId });
        await context.SaveChangesAsync();

        return (customerAId, customerBId, batchAId, batchBId, lineAId, lineBId, dailyAId, dailyBId, serviceDate);
    }

    [Fact]
    public async Task GetPreparationAsync_Aggregates_Quantities_By_Ingredient_Across_Multiple_Customers_On_Same_Date()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, lineAId, _, dailyAId, _, serviceDate) = await SetupTwoCustomerBatchesAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var result = await service.GetPreparationAsync(serviceDate);

        result.ServiceDate.Should().Be(serviceDate);
        result.Batches.Should().HaveCount(2);
        result.Batches.Should().Contain(b => b.RequiredQuantity == 5m);
        result.Batches.Should().Contain(b => b.RequiredQuantity == 3m);

        var aggLine = result.AggregatedLines.Should().ContainSingle().Subject;
        aggLine.IngredientId.Should().Be(fixture.IngredientIdString);
        aggLine.TotalRequiredQuantity.Should().Be(8m);
        aggLine.TotalIssuedQuantity.Should().Be(0m);
        aggLine.TotalRemainingQuantity.Should().Be(8m);

        aggLine.Allocations.Should().HaveCount(2);
        aggLine.Allocations.Should().Contain(a => a.RequiredQuantity == 5m);
        aggLine.Allocations.Should().Contain(a => a.RequiredQuantity == 3m);

        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = issueId, IssueCode = "PREP-RETURN", IssueDate = serviceDate,
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batchAId, IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = [new InventoryIssueLine
            {
                IssueLineId = issueLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                ReconciliationBatchLineId = lineAId, ReconciliationBatchDailyLineId = dailyAId,
                ReconciliationServiceDate = serviceDate, RequestedQty = 5m, IssuedQty = 5m
            }]
        });
        context.Inventoryreturns.Add(new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(), ReturnCode = "PREP-RECEIVED", ReturnDate = serviceDate, ReturnType = "RETURN",
            WarehouseId = fixture.WarehouseId, IssueId = issueId, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
            ReceivedBy = fixture.UserId, ReceivedAt = DateTime.UtcNow,
            Inventoryreturnlines = [new InventoryReturnLine
            {
                ReturnLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                SourceIssueLineId = issueLineId, Quantity = 2m
            }]
        });
        await context.SaveChangesAsync();
        var afterReturn = (await service.GetPreparationAsync(serviceDate)).AggregatedLines.Should().ContainSingle().Subject;
        afterReturn.TotalIssuedQuantity.Should().Be(3m);
        afterReturn.TotalRemainingQuantity.Should().Be(5m);
    }

    [Fact]
    public async Task IssueCoordinatedAsync_Creates_Separate_Issues_Linked_By_PreparationGroupId_In_One_Transaction()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, batchBId, lineAId, lineBId, dailyAId, dailyBId, serviceDate) = await SetupTwoCustomerBatchesAsync(fixture, context);
        var removedIngredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(), IngredientCode = "REMOVED", IngredientName = "Removed ingredient",
            UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, IsActive = true
        };
        var removedLineId = GuidHelper.NewId();
        var removedDailyId = GuidHelper.NewId();
        context.Ingredients.Add(removedIngredient);
        context.Reconciliationbatchlines.Add(new ReconciliationBatchLine
        {
            BatchLineId = removedLineId, BatchId = batchAId, IngredientId = removedIngredient.IngredientId,
            CanonicalUnitId = fixture.UnitId, RequiredQuantity = 0m, FrozenTolerance = 0.5m,
            ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 2,
            DailyLines = [new ReconciliationBatchDailyLine
            {
                DailyLineId = removedDailyId, BatchLineId = removedLineId, BatchId = batchAId,
                IngredientId = removedIngredient.IngredientId, CanonicalUnitId = fixture.UnitId,
                ServiceDate = serviceDate, RequiredQuantity = 0m, Version = 2
            }]
        });
        await context.SaveChangesAsync();

        var grams = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "G", UnitName = "gram", BaseUnitCode = "KG", ConvertRateToBase = 0.001m };
        context.Units.Add(grams);
        var stock = await context.Currentstocks.SingleAsync();
        stock.UnitId = grams.UnitId;
        stock.CurrentQty = 2000m;
        await context.SaveChangesAsync();

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1, Disposition = OperationDisposition.ReconciliationOnly };
        var service = new ReconciliationPreparationService(context,
            new EfTransactionRunner(context, requestContext, new SystemOperationModeGuard(context)), warehouseResolver, requestContext);

        var commandId = "coordinated-cmd-" + Guid.NewGuid().ToString("N");
        var request = new CoordinatedPreparationIssueRequest
        {
            CommandId = commandId,
            ServiceDate = serviceDate,
            Batches =
            [
                new CoordinatedPreparationIssueBatchRequest
                {
                    ReconciliationBatchId = GuidHelper.ToGuidString(batchAId),
                    ExpectedVersion = 2,
                    Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineAId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyAId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 5m, IssuedQty = 5m }]
                },
                new CoordinatedPreparationIssueBatchRequest
                {
                    ReconciliationBatchId = GuidHelper.ToGuidString(batchBId),
                    ExpectedVersion = 3,
                    Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineBId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyBId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 3m, IssuedQty = 3m }]
                }
            ]
        };

        var result = await service.IssueCoordinatedAsync(request, fixture.UserIdString);

        result.Should().NotBeNull();
        result.IdempotentReplay.Should().BeFalse();
        result.PreparationGroupId.Should().NotBeNullOrWhiteSpace();
        result.Issues.Should().HaveCount(2);

        var issuesInDb = await context.Inventoryissues.Include(i => i.Inventoryissuelines).ToListAsync();
        issuesInDb.Should().HaveCount(2);

        var parsedGroupId = GuidHelper.ParseGuidString(result.PreparationGroupId);
        issuesInDb.Should().OnlyContain(i => i.PreparationGroupId != null && i.PreparationGroupId.SequenceEqual(parsedGroupId!));

        var batchAFromDb = await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchAId);
        var batchBFromDb = await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchBId);
        batchAFromDb.Status.Should().Be("IN_PROGRESS");
        batchAFromDb.Version.Should().Be(3);
        batchBFromDb.Status.Should().Be("IN_PROGRESS");
        batchBFromDb.Version.Should().Be(4);

        (await context.Stockmovements.ToListAsync()).Should().BeEmpty();
        (await context.Currentstocks.SingleAsync()).CurrentQty.Should().Be(2000m);
        (await context.Currentstocks.SingleAsync()).UnitId.Should().Equal(grams.UnitId);

        var replay = await service.IssueCoordinatedAsync(request, fixture.UserIdString);
        replay.IdempotentReplay.Should().BeTrue();
        replay.PreparationGroupId.Should().Be(result.PreparationGroupId);
        (await context.Inventoryissues.CountAsync()).Should().Be(2);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Currentstocks.SingleAsync()).CurrentQty.Should().Be(2000m);
        request.CommandId = $"second-initial-{Guid.NewGuid():N}";
        request.Batches[0].ExpectedVersion = 3;
        request.Batches[1].ExpectedVersion = 4;
        await Assert.ThrowsAsync<ResourceConflictException>(() => service.IssueCoordinatedAsync(request, fixture.UserIdString));
        context.ChangeTracker.Clear();
        (await context.Inventoryissues.CountAsync()).Should().Be(2);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Reconciliationbatchdailylines.SingleAsync(line => line.DailyLineId == removedDailyId))
            .RequiredQuantity.Should().Be(0m);
    }

    [Fact]
    public async Task IssueCoordinatedAsync_Rolls_Back_All_Batches_When_One_Batch_Has_Stale_Version()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, batchBId, lineAId, lineBId, dailyAId, dailyBId, serviceDate) = await SetupTwoCustomerBatchesAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1, Disposition = OperationDisposition.ReconciliationOnly };
        var service = new ReconciliationPreparationService(context,
            new EfTransactionRunner(context, requestContext, new SystemOperationModeGuard(context)), warehouseResolver, requestContext);
        var stock = await context.Currentstocks.SingleAsync();
        stock.CurrentQty = 0m;
        await context.SaveChangesAsync();

        var request = new CoordinatedPreparationIssueRequest
        {
            CommandId = "coordinated-stale-" + Guid.NewGuid().ToString("N"),
            ServiceDate = serviceDate,
            Batches =
            [
                new CoordinatedPreparationIssueBatchRequest
                {
                    ReconciliationBatchId = GuidHelper.ToGuidString(batchAId),
                    ExpectedVersion = 2,
                    Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineAId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyAId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 5m, IssuedQty = 5m }]
                },
                new CoordinatedPreparationIssueBatchRequest
                {
                    ReconciliationBatchId = GuidHelper.ToGuidString(batchBId),
                    ExpectedVersion = 999, // Stale version!
                    Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineBId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyBId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 3m, IssuedQty = 3m }]
                }
            ]
        };

        var action = () => service.IssueCoordinatedAsync(request, fixture.UserIdString);
        await action.Should().ThrowAsync<DbUpdateConcurrencyException>().WithMessage("*đã thay đổi*");

        context.ChangeTracker.Clear();
        (await context.Inventoryissues.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Lifecyclecommandreceipts.CountAsync()).Should().Be(0);
        (await context.Currentstocks.SingleAsync()).CurrentQty.Should().Be(0m);
        (await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchAId)).Version.Should().Be(2);
        (await context.Reconciliationbatches.SingleAsync(b => b.BatchId == batchBId)).Version.Should().Be(3);
    }

    [Fact]
    public async Task IssueCoordinatedAsync_Rejects_Batch_With_Mismatched_ServiceDate()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, lineAId, _, dailyAId, _, serviceDate) = await SetupTwoCustomerBatchesAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var request = new CoordinatedPreparationIssueRequest
        {
            CommandId = "coordinated-date-mismatch-" + Guid.NewGuid().ToString("N"),
            ServiceDate = serviceDate.AddDays(1), // Mismatched date!
            Batches =
            [
                new CoordinatedPreparationIssueBatchRequest
                {
                    ReconciliationBatchId = GuidHelper.ToGuidString(batchAId),
                    ExpectedVersion = 2,
                    Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineAId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyAId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 5m, IssuedQty = 5m }]
                }
            ]
        };

        var action = () => service.IssueCoordinatedAsync(request, fixture.UserIdString);
        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*Ngày xuất không thuộc nguồn định lượng*");
    }

    [Fact]
    public async Task IssueCoordinatedAsync_Rejects_Duplicate_BatchId_In_Request()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchAId, _, lineAId, _, dailyAId, _, serviceDate) = await SetupTwoCustomerBatchesAsync(fixture, context);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var requestContext = new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation, ExpectedModeVersion = 1 };
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouseResolver, requestContext);

        var batchStr = GuidHelper.ToGuidString(batchAId);
        var request = new CoordinatedPreparationIssueRequest
        {
            CommandId = "coordinated-dup-batch-" + Guid.NewGuid().ToString("N"),
            ServiceDate = serviceDate,
            Batches =
            [
                new CoordinatedPreparationIssueBatchRequest { ReconciliationBatchId = batchStr, ExpectedVersion = 2, Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineAId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyAId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 5m, IssuedQty = 5m }] },
                new CoordinatedPreparationIssueBatchRequest { ReconciliationBatchId = batchStr, ExpectedVersion = 2, Lines = [new CoordinatedPreparationIssueBatchLineRequest { ReconciliationBatchLineId = GuidHelper.ToGuidString(lineAId), ReconciliationBatchDailyLineId = GuidHelper.ToGuidString(dailyAId), IngredientId = fixture.IngredientIdString, UnitId = GuidHelper.ToGuidString(fixture.UnitId), RequestedQty = 5m, IssuedQty = 5m }] }
            ]
        };

        var action = () => service.IssueCoordinatedAsync(request, fixture.UserIdString);
        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*trùng lặp*");
    }

    [Fact]
    public async Task Preparation_week_includes_saturday_excludes_sunday_and_next_week_without_writes()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var (_, _, batchId, _, lineId, _, _, _, monday) = await SetupTwoCustomerBatchesAsync(fixture, context);
        context.Reconciliationbatchdailylines.AddRange(
            new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = monday.AddDays(5), RequiredQuantity = 2.123456m, Version = 1 },
            new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = monday.AddDays(6), RequiredQuantity = 42m, Version = 1 },
            new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = lineId, BatchId = batchId, IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId, ServiceDate = monday.AddDays(7), RequiredQuantity = 99m, Version = 1 });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        var service = new ReconciliationPreparationService(context, new ImmediateTransactionRunner(), warehouse,
            new SystemOperationRequestContext { Mode = SystemOperationEligibility.MaterialReconciliation });
        var result = await service.GetPreparationAsync(monday, wholeWeek: true);
        result.ServiceDate.Should().Be(monday);
        result.AggregatedLines.Should().ContainSingle().Which.TotalRequiredQuantity.Should().Be(10.123456m);
        result.Batches.Single(batch => batch.BatchId == GuidHelper.ToGuidString(batchId)).RequiredQuantity.Should().Be(7.123456m);
        context.ChangeTracker.HasChanges().Should().BeFalse();
        (await context.Inventoryissues.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        var invalid = () => service.GetPreparationAsync(monday.AddDays(1), wholeWeek: true);
        await invalid.Should().ThrowAsync<ArgumentException>();
        var sunday = () => service.GetPreparationAsync(monday.AddDays(6));
        await sunday.Should().ThrowAsync<ArgumentException>().WithMessage("*Thứ Hai*Thứ Bảy*");
        (await context.Reconciliationbatchdailylines.CountAsync(line => line.ServiceDate == monday.AddDays(6))).Should().Be(1);
    }

    private static Task EnsureSchemaAsync(IpcManagementContext context) => context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS systemoperationmodes (Id INTEGER PRIMARY KEY, Mode TEXT NOT NULL, Version INTEGER NOT NULL, UpdatedAt TEXT NOT NULL, UpdatedBy BLOB NOT NULL, Reason TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        """);
}
