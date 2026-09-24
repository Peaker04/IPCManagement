using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using IPCManagement.Api.Data.Transactions;

namespace IPCManagement.Api.Tests;

public sealed partial class ReconciliationServiceTests
{
    [Fact]
    public async Task ListDishes_Should_PreserveConvertedRateUntilServingsAreApplied()
    {
        await using var context = CreateContext();
        var (batch, bom) = Seed(context);
        bom.GrossQtyPerServing = 0.0004m; // grams: 1000 servings require 0.0004 kg, not zero.
        await context.SaveChangesAsync();

        var dishes = await Service(context).ListDishesAsync(GuidHelper.ToGuidString(batch.BatchId));

        var material = Assert.Single(Assert.Single(dishes).Materials);
        Assert.Equal(0.0000004m, material.GrossQtyPerServing);
        Assert.Equal(0.0004m, DecimalPolicy.RoundQuantity(material.GrossQtyPerServing * 1000));
        Assert.Equal(10m, batch.Lines.Single().RequiredQuantity);
    }

    [Fact]
    public async Task ListDishes_Should_PreserveFrozenLineageAfterBomIngredientChanges()
    {
        await using var context = CreateContext();
        var (batch, bom) = Seed(context);
        var replacement = new Ingredient
        {
            IngredientId = GuidHelper.NewId(), IngredientCode = "OTHER", IngredientName = "Nguyên liệu khác",
            UnitId = bom.UnitId, Unit = bom.Unit, WarehouseId = GuidHelper.NewId(), IsActive = true,
        };
        bom.Ingredient = replacement;
        bom.IngredientId = replacement.IngredientId;
        context.Add(replacement);
        await context.SaveChangesAsync();

        var dishes = await Service(context).ListDishesAsync(GuidHelper.ToGuidString(batch.BatchId));
        Assert.Equal(GuidHelper.ToGuidString(batch.Lines.Single().IngredientId), Assert.Single(Assert.Single(dishes).Materials).IngredientId);
    }

    [Fact]
    public async Task ListDishes_Should_RejectOneFrozenBomMappedToMultipleBatchLines()
    {
        await using var context = CreateContext();
        var (batch, bom) = Seed(context);
        var sourceLine = batch.Lines.Single();
        var conflictingLine = new ReconciliationBatchLine
        {
            BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch,
            IngredientId = sourceLine.IngredientId, Ingredient = sourceLine.Ingredient,
            CanonicalUnitId = sourceLine.CanonicalUnitId, CanonicalUnit = sourceLine.CanonicalUnit,
            RequiredQuantity = 1m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1"
        };
        conflictingLine.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = conflictingLine.BatchLineId, BatchLine = conflictingLine,
            DishBomId = bom.BomId, MenuScheduleId = GuidHelper.NewId(),
            MealQuantityPlanLineId = GuidHelper.NewId(), SourceQuantity = 1m
        });
        batch.Lines.Add(conflictingLine);
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            Service(context).ListDishesAsync(GuidHelper.ToGuidString(batch.BatchId)));
    }

    private static ReconciliationBatchService Service(IpcManagementContext context) =>
        new(context, Substitute.For<IEfTransactionRunner>(), new SystemOperationRequestContext());

    private static (ReconciliationBatch Batch, DishBom Bom) Seed(IpcManagementContext context)
    {
        var kg = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1m };
        var gram = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "G", UnitName = "g", BaseUnitCode = "KG", ConvertRateToBase = 0.001m };
        var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "SPICE", IngredientName = "Gia vị", UnitId = kg.UnitId, Unit = kg, WarehouseId = GuidHelper.NewId(), IsActive = true };
        var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = "DISH", DishName = "Món", IsActive = true };
        var bom = new DishBom { BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish, IngredientId = ingredient.IngredientId, Ingredient = ingredient, UnitId = gram.UnitId, Unit = gram, GrossQtyPerServing = 1m };
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "IN_PROGRESS", Version = 4, CreatedBy = GuidHelper.NewId(), CreatedAt = DateTime.UtcNow };
        var line = new ReconciliationBatchLine { BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, Batch = batch, IngredientId = ingredient.IngredientId, Ingredient = ingredient, CanonicalUnitId = kg.UnitId, CanonicalUnit = kg, RequiredQuantity = 10m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1" };
        var dailyLine = new ReconciliationBatchDailyLine { DailyLineId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, BatchId = batch.BatchId, IngredientId = ingredient.IngredientId, CanonicalUnitId = kg.UnitId, ServiceDate = new DateOnly(2026, 8, 25), RequiredQuantity = 10m, Version = 1 };
        line.DailyLines.Add(dailyLine);
        line.Contributors.Add(new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchLine = line, DailyLineId = dailyLine.DailyLineId, DailyLine = dailyLine, DishBomId = bom.BomId, DishId = dish.DishId, FrozenShiftName = "MORNING", FrozenDishCode = dish.DishCode, FrozenDishName = dish.DishName, FrozenServings = 1000, FrozenBomQuantityPerServing = 0.0000004m, FrozenWasteRatePercent = 0m, MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), SourceQuantity = 10m });
        batch.Lines.Add(line);
        context.AddRange(kg, gram, ingredient, dish, bom, batch);
        return (batch, bom);
    }
}
