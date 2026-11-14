using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Caching;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationQuantityImportApplicationPathTests
{
    [Fact]
    public async Task AspNetCore_service_provider_activates_controller_and_reaches_quantity_preview_endpoint()
    {
        await using var fixture = await Fixture.CreateAsync();

        var result = await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "DI activation regression"), default);

        Assert.IsType<QuantityImportPreviewDto>(Payload<QuantityImportPreviewDto>(result));
    }

    [Fact]
    public async Task Inspection_groups_before_paging_preserves_daily_rates_and_never_allocates_commit_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var context = fixture.Context;
        var firstBom = await context.Dishboms.SingleAsync();
        firstBom.EffectiveTo = new DateOnly(2026, 8, 25);
        var nextDay = new DateOnly(2026, 8, 26);
        var menu = await context.Menus.SingleAsync();
        var secondIngredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(), IngredientCode = "ING-2", IngredientName = "A second ingredient",
            UnitId = firstBom.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 1m, IsActive = true
        };
        var schedule = new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(), MenuVersionId = fixture.MenuVersionId,
            CustomerId = fixture.CustomerId, MenuId = menu.MenuId, MenuPrice = 25000m, ServiceDate = nextDay,
            WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "AFTERNOON", Status = "ACTIVE"
        };
        var plan = new MealQuantityPlan
        {
            QuantityPlanId = GuidHelper.NewId(), PlanCode = "QTY-2", ServiceDate = nextDay,
            Status = "COMPLETED", CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow
        };
        context.AddRange(secondIngredient, schedule, plan,
            new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = plan.QuantityPlanId,
                MenuScheduleId = schedule.MenuScheduleId, CustomerId = fixture.CustomerId, MenuId = menu.MenuId,
                ShiftName = "AFTERNOON", FinalServings = 20, SavoryServings = 20, VegetarianServings = 0, UpdatedAt = DateTime.UtcNow
            },
            new DishBom
            {
                BomId = GuidHelper.NewId(), DishId = fixture.DishId, IngredientId = fixture.IngredientId,
                UnitId = firstBom.UnitId, GrossQtyPerServing = 0.2m, PriceTierAmount = 25000m,
                BomStatus = "PUBLISHED", EffectiveFrom = nextDay
            },
            new DishBom
            {
                BomId = GuidHelper.NewId(), DishId = fixture.DishId, IngredientId = secondIngredient.IngredientId,
                UnitId = firstBom.UnitId, GrossQtyPerServing = 0.05m, PriceTierAmount = 25000m,
                BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 8, 1)
            });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var versionId = GuidHelper.ToGuidString(fixture.MenuVersionId);
        var first = Payload<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>(await fixture.InspectionController.MaterialInspection(
            versionId, new PagedRequestDto { PageSize = 1 }, default));
        Assert.Equal(2, first.Page.TotalCount);
        Assert.Equal("A second ingredient", Assert.Single(first.Page.Items).IngredientName);
        Assert.Equal(1.5m, Assert.Single(first.Page.Items).RequiredQuantity);
        var second = Payload<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>(await fixture.InspectionController.MaterialInspection(
            versionId, new PagedRequestDto { PageSize = 1, PageNumber = 2 }, default));
        var material = Assert.Single(second.Page.Items);
        Assert.Equal(5m, material.RequiredQuantity);
        Assert.Equal(new[] { 0.1m, 0.2m }, material.Contributions.Select(x => x.Material.GrossQuantityPerServing));
        Assert.Equal(new[] { 10, 20 }, material.Contributions.Select(x => x.FinalServings));
        Assert.Equal(new[] { new DateOnly(2026, 8, 25), nextDay }, material.Contributions.Select(x => x.ServiceDate));
        var searched = Payload<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>(await fixture.InspectionController.MaterialInspection(
            versionId, new PagedRequestDto { SearchKeyword = "ING-1", PageSize = 1 }, default));
        Assert.Equal(1, searched.Page.TotalCount);
        Assert.Equal(5m, Assert.Single(searched.Page.Items).RequiredQuantity);
        var shifts = Payload<QuantityInspectionPageDto<QuantityPlanInspectionDto>>(await fixture.InspectionController.PlanInspection(
            versionId, new PagedRequestDto { PageSize = 1, PageNumber = 2 }, default));
        Assert.Equal(2, shifts.Page.TotalCount);
        var shift = Assert.Single(shifts.Page.Items);
        Assert.Equal(nextDay, shift.ServiceDate);
        Assert.Equal("AFTERNOON", shift.Line.Shift);
        Assert.Equal(20, shift.Line.FinalServings);
        Assert.Equal(first.ContentFingerprint, second.ContentFingerprint);
        Assert.Equal(first.ContentFingerprint, shifts.ContentFingerprint);
        Assert.Equal(3, first.FingerprintFormatVersion);
        Assert.Equal(0, fixture.CacheEntryCount);
        Assert.False(context.ChangeTracker.HasChanges());
        Assert.Empty(context.Quantityimportbatches);
        Assert.Empty(context.Reconciliationbatches);
        Assert.Empty(context.Auditlogs);
        Assert.All(context.Mealquantityplans, item => Assert.Null(item.ImportBatchId));
    }

    [Fact]
    public async Task Inspection_reports_partial_BOM_diagnostics_and_preserves_source_prerequisite_errors()
    {
        await using var fixture = await Fixture.CreateAsync();
        fixture.Context.Dishboms.RemoveRange(fixture.Context.Dishboms);
        await fixture.Context.SaveChangesAsync();
        var versionId = GuidHelper.ToGuidString(fixture.MenuVersionId);
        var read = Payload<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>(await fixture.InspectionController.MaterialInspection(
            versionId, new PagedRequestDto(), default));
        Assert.NotEmpty(read.Diagnostics);
        Assert.Empty(read.Page.Items);
        var version = await fixture.Context.Menuversions.SingleAsync();
        version.Status = "DRAFT";
        await fixture.Context.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.InspectionController.PlanInspection(
            versionId, new PagedRequestDto(), default));
        Assert.Equal("Phiên bản thực đơn chưa được phát hành.", error.Message);
        Assert.Equal(0, fixture.CacheEntryCount);
    }

    [Theory]
    [InlineData(25000, 1)]
    [InlineData(30000, 2)]
    public async Task Imported_selected_tier_persists_and_projects_exact_customer_BOM_quantity(decimal tier, decimal expectedKilograms)
    {
        await using var fixture = await Fixture.CreateAsync();
        var context = fixture.Context;
        var customer = await context.Customers.SingleAsync();
        var dish = await context.Dishes.SingleAsync();
        var originalBom = await context.Dishboms.SingleAsync();
        var roleId = GuidHelper.NewId();
        context.Roles.Add(new Role { RoleId = roleId, RoleCode = "COORDINATOR", RoleName = "Coordinator" });
        context.Users.Add(new User { UserId = fixture.ActorId, RoleId = roleId, Username = "tier-importer", FullName = "Tier Importer", PasswordHash = "test-only", IsActive = true });
        var overrideBom = new DishBom
        {
            BomId = GuidHelper.NewId(), DishId = fixture.DishId, CustomerId = fixture.CustomerId,
            IngredientId = fixture.IngredientId, UnitId = originalBom.UnitId, GrossQtyPerServing = 0.2m,
            PriceTierAmount = 30000m, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 8, 1)
        };
        context.Dishboms.AddRange(overrideBom, new DishBom
        {
            BomId = GuidHelper.NewId(), DishId = fixture.DishId, IngredientId = fixture.IngredientId,
            UnitId = originalBom.UnitId, GrossQtyPerServing = 0.9m, PriceTierAmount = 30000m,
            BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 8, 1)
        });
        await context.SaveChangesAsync();
        var week = new DateOnly(2026, 8, 31);
        var day = new DateOnly(2026, 9, 1);
        var plan = new WeeklyMenuImportPlan("tier-menu.xlsx", "Customer tier sheet", "C", week, week.AddDays(6), 1,
            [new WeeklyMenuImportDayColumn("D", day, "t3", "Thứ ba", 7)], week);
        plan.Items.Add(new ParsedWeeklyMenuItem
        {
            SourceOrder = 1, ServiceDate = day, DayKey = "t3", SourceRowNumber = 9, SourceColumn = "D",
            SectionLabel = "MENU MẶN - CA SÁNG", SectionKey = "savory-morning", SourceShift = "MORNING",
            SourceShiftLabel = "Ca sáng", DbShiftName = "MORNING", VariantKey = "savory", VariantLabel = "Mặn",
            Slot = "main", SlotLabel = "Món chính", DishName = dish.DishName
        });
        var imported = await new WeeklyMenuImportPersistence(context, new WeeklyMenuImportResultBuilder(context), new WeeklyMenuAuditActorResolver(context))
            .CommitAsync(plan, customer, tier, GuidHelper.ToGuidString(fixture.ActorId), default);
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var versionId = GuidHelper.ParseGuidString(imported.MenuVersionId)!;
        var schedule = await context.Menuschedules.SingleAsync(item => item.MenuVersionId == versionId);
        Assert.Equal(tier, schedule.MenuPrice);
        Assert.Equal(fixture.DishId, await context.Menuitems.Where(item => item.MenuId == schedule.MenuId).Select(item => item.DishId).SingleAsync());
        await new MenuScheduleService(context, new ImmediateTransactionRunner()).UpdateMenuScheduleVersionAsync(
            GuidHelper.ToGuidString(schedule.MenuScheduleId), new UpdateMenuScheduleVersionRequest { Status = "ACTIVE", Reason = "Publish imported tier proof" }, GuidHelper.ToGuidString(fixture.ActorId));
        var quantityPlan = new MealQuantityPlan { QuantityPlanId = GuidHelper.NewId(), PlanCode = "QTY-TIER", ServiceDate = day, Status = "COMPLETED", CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow };
        context.AddRange(quantityPlan, new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = quantityPlan.QuantityPlanId,
            MenuScheduleId = schedule.MenuScheduleId, CustomerId = fixture.CustomerId, MenuId = schedule.MenuId,
            ShiftName = "MORNING", ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10,
            SavoryServings = 10, VegetarianServings = 0, UpdatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(new(imported.MenuVersionId!, "Selected tier source"), default));
        var committed = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(new(preview.Token, preview.ContentFingerprint, "Selected tier source"), default));
        context.ChangeTracker.Clear();
        var batch = Payload<ReconciliationBatchDto>(await fixture.Controller.Get(committed.ReconciliationBatchId, default));
        var line = Assert.Single(batch.Lines);
        Assert.Equal(expectedKilograms, line.RequiredQuantity);
        Assert.Equal(GuidHelper.ToGuidString(fixture.IngredientId), line.IngredientId);
        var persisted = await context.Reconciliationbatchcontributors.AsNoTracking().Where(item => item.BatchLineId == GuidHelper.ParseGuidString(line.BatchLineId)).ToListAsync();
        Assert.Equal(tier == 25000m ? fixture.BomId : overrideBom.BomId, Assert.Single(persisted).DishBomId);
        Assert.Equal(expectedKilograms, persisted[0].SourceQuantity);
    }

    [Fact]
    public async Task Draft_menu_preview_returns_a_business_error_instead_of_a_system_failure()
    {
        await using var fixture = await Fixture.CreateAsync();
        var menuVersion = await fixture.Context.Menuversions.SingleAsync(item => item.MenuVersionId == fixture.MenuVersionId);
        menuVersion.Status = "DRAFT";
        await fixture.Context.SaveChangesAsync();

        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chưa xuất bản"), default));

        Assert.Equal("Phiên bản thực đơn chưa được phát hành.", error.Message);
    }

    [Fact]
    public async Task Preview_returns_all_missing_BOM_diagnostics_and_blocks_commit()
    {
        await using var fixture = await Fixture.CreateAsync();
        fixture.Context.Dishboms.RemoveRange(fixture.Context.Dishboms);
        await fixture.Context.SaveChangesAsync();

        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn thiếu định mức"), default));

        Assert.NotEmpty(preview.Diagnostics);
        Assert.All(preview.Diagnostics, diagnostic => Assert.Contains("chưa có định mức nguyên liệu phù hợp", diagnostic));
        var error = await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Nguồn thiếu định mức"), default));
        Assert.Contains("hoàn tất định mức", error.Message);
        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
    }

    [Theory]
    [InlineData("100", 10, "0.1", "1")]
    [InlineData("0.0004", 1000, "0.0000004", "0.0004")]
    [InlineData("0.0005", 1, "0.0000005", "0.000001")]
    [InlineData("123.456781", 7, "0.123456781", "0.864197")]
    public async Task Committed_lineage_preserves_canonical_rate_before_serving_rounding(string raw, int servings, string rate, string total)
    {
        await using var fixture = await Fixture.CreateAsync();
        var context = fixture.Context;
        var bom = await context.Dishboms.SingleAsync();
        bom.UnitId = fixture.AlternateUnitId;
        bom.Unit = await context.Units.SingleAsync(unit => unit.UnitId == fixture.AlternateUnitId);
        bom.GrossQtyPerServing = decimal.Parse(raw, System.Globalization.CultureInfo.InvariantCulture);
        var plan = await context.Mealquantityplanlines.SingleAsync();
        plan.FinalServings = servings;
        plan.SavoryServings = servings;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Frozen conversion regression"), default));
        var committed = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Frozen conversion regression"), default));
        context.ChangeTracker.Clear();
        var expectedRate = decimal.Parse(rate, System.Globalization.CultureInfo.InvariantCulture);
        var expectedTotal = decimal.Parse(total, System.Globalization.CultureInfo.InvariantCulture);
        var contributor = Assert.Single(await context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync());
        Assert.Equal(expectedTotal, contributor.SourceQuantity);
        Assert.Equal(servings, contributor.FrozenServings);
        Assert.Equal(decimal.Parse(raw, System.Globalization.CultureInfo.InvariantCulture), contributor.FrozenBomQuantityPerServing);
        Assert.Equal(0.001m, contributor.FrozenBomUnitToBaseRate);
        Assert.Equal(1m, contributor.FrozenCanonicalUnitToBaseRate);
        var daily = Assert.Single(await context.Reconciliationbatchdailylines.AsNoTracking().ToListAsync());
        var weekly = Assert.Single(await context.Reconciliationbatchlines.AsNoTracking().ToListAsync());
        Assert.Equal(expectedTotal, daily.RequiredQuantity);
        Assert.Equal(expectedTotal, weekly.RequiredQuantity);
        Assert.Equal(daily.DailyLineId, contributor.DailyLineId);
        Assert.Equal(weekly.BatchLineId, daily.BatchLineId);
        Assert.Equal(fixture.IngredientId, daily.IngredientId);
        Assert.Equal(weekly.CanonicalUnitId, daily.CanonicalUnitId);
        Assert.Equal(await context.Ingredients.Where(item => item.IngredientId == fixture.IngredientId).Select(item => item.UnitId).SingleAsync(), weekly.CanonicalUnitId);
        Assert.Equal(new DateOnly(2026, 8, 25), daily.ServiceDate);
        var dishes = Payload<IReadOnlyList<ReconciliationBatchDishSummaryDto>>(await fixture.Controller.Dishes(committed.ReconciliationBatchId, default));
        Assert.Equal(expectedRate, Assert.Single(Assert.Single(dishes).Materials).CanonicalQtyPerServing);
        var kitchen = await new ReconciliationKitchenExportService(context).GetAsync(committed.ReconciliationBatchId);
        Assert.Equal(expectedRate, Assert.Single(kitchen!.Rows).BomQuantityPerServing);
        Assert.Equal(expectedTotal, Assert.Single(kitchen.Rows).TotalRequiredQuantity);

        bom = await context.Dishboms.SingleAsync();
        bom.GrossQtyPerServing = 999m;
        (await context.Units.SingleAsync(unit => unit.UnitId == fixture.AlternateUnitId)).ConvertRateToBase = 2m;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        dishes = Payload<IReadOnlyList<ReconciliationBatchDishSummaryDto>>(await fixture.Controller.Dishes(committed.ReconciliationBatchId, default));
        Assert.Equal(expectedRate, Assert.Single(Assert.Single(dishes).Materials).CanonicalQtyPerServing);
    }

    [Fact]
    public async Task Preview_then_commit_creates_one_confirmed_import_and_one_draft_batch_idempotently()
    {
        await using var fixture = await Fixture.CreateAsync();
        var controller = fixture.Controller;
        // HTTP preview starts with database-hydrated values, not tracked seed values.
        fixture.Context.ChangeTracker.Clear();

        var previewResult = await controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn số suất chuẩn"), default);
        var preview = Payload<QuantityImportPreviewDto>(previewResult);

        Assert.NotEmpty(preview.Token);
        Assert.Equal(64, preview.ContentFingerprint.Length);
        Assert.Single(preview.Plans);
        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));

        var request = new CommitQuantityImportRequest(preview.Token, preview.ContentFingerprint, "Nguồn số suất chuẩn");
        fixture.ClearPreviewCache();
        // A second service has no state from the preview service, only the shared DB and signing configuration.
        var requestContext = new SystemOperationRequestContext { OperationKey = "reconciliation.quantity-import.commit", ExpectedModeVersion = 1 };
        var runner = new ImmediateTransactionRunner();
        await using var secondContext = new ImportTestContext(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(fixture.Context.Database.GetDbConnection()).Options);
        var batches = new ReconciliationBatchService(secondContext, runner, requestContext);
        var secondInstance = new ReconciliationQuantityImportService(secondContext, runner, requestContext,
            Microsoft.Extensions.Options.Options.Create(new JwtSettings { SecretKey = new string('q', 64), Issuer = "test" }), batches);
        var first = await secondInstance.CommitAsync(request, GuidHelper.ToGuidString(fixture.ActorId));
        var replay = Payload<QuantityImportCommitDto>(await controller.CommitQuantityImport(request, default));
        fixture.Context.ChangeTracker.Clear();

        Assert.Equal(first.ImportBatchId, replay.ImportBatchId);
        Assert.Equal(first.ReconciliationBatchId, replay.ReconciliationBatchId);
        Assert.True(replay.IdempotentReplay);
        var import = Assert.Single(fixture.Context.Quantityimportbatches);
        Assert.Equal("CONFIRMED", import.Status);
        Assert.Equal(preview.ContentFingerprint, import.ContentFingerprint);
        Assert.Equal(fixture.MenuVersionId, import.MenuVersionId);
        Assert.Single(fixture.Context.Reconciliationbatches);
        Assert.Equal("DRAFT", fixture.Context.Reconciliationbatches.Single().Status);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Equal(import.ImportBatchId, plan.ImportBatchId));
        Assert.Single(fixture.Context.Auditlogs.Where(audit => audit.EntityName == nameof(QuantityImportBatch)));

        var manualReplay = Payload<ReconciliationBatchDto>(await controller.Create(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), first.ImportBatchId), default));
        Assert.Equal(first.ReconciliationBatchId, manualReplay.BatchId);
        Assert.Equal("DRAFT", manualReplay.Status);
        Assert.Single(fixture.Context.Reconciliationbatches);

        var readback = Payload<ReconciliationBatchDto>(await controller.Get(first.ReconciliationBatchId, default));
        Assert.Equal(first.ImportBatchId, readback.QuantityImportBatchId);
        Assert.NotEmpty(readback.Lines);
        Assert.All(readback.Lines, line => Assert.True(line.RequiredQuantity > 0));
        var contributors = await fixture.Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync();
        Assert.NotEmpty(contributors);
        Assert.All(contributors, contributor => Assert.True(contributor.SourceQuantity > 0));

        var ready = Payload<ReconciliationBatchDto>(await controller.Ready(
            first.ReconciliationBatchId, new ReadyReconciliationBatchRequest(readback.Version), default));
        Assert.Equal("READY", ready.Status);
    }

    [Fact]
    public async Task Ready_projection_is_frozen_after_authorized_master_edits_and_new_source_version_uses_new_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Frozen authority source"), default));
        var committed = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Frozen authority source"), default));
        var draft = Payload<ReconciliationBatchDto>(await fixture.Controller.Get(committed.ReconciliationBatchId, default));
        var ready = Payload<ReconciliationBatchDto>(await fixture.Controller.Ready(
            draft.BatchId, new ReadyReconciliationBatchRequest(draft.Version), default));
        Assert.Equal("READY", ready.Status);
        var frozen = await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId);

        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        await new IngredientService(new IngredientRepository(fixture.Context), warehouseResolver,
            fixture.Context, new EfTransactionRunner(fixture.Context)).UpdateAsync(
            GuidHelper.ToGuidString(fixture.IngredientId), new UpdateIngredientRequest
            {
                IngredientName = "Ingredient edited",
                ReferencePrice = 999m,
                UnitId = GuidHelper.ToGuidString(fixture.AlternateUnitId)
            });
        fixture.Context.ChangeTracker.Clear();
        Assert.Equal(frozen, await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId));

        var customer = await new CustomerContractService(fixture.Context).UpdateCustomerContractAsync(
            GuidHelper.ToGuidString(fixture.CustomerId),
            new UpdateCustomerContractRequest
            {
                CustomerName = "Customer edited",
                Note = "Authorized Plan 30-11 frozen snapshot proof",
                IsActive = true
            },
            GuidHelper.ToGuidString(fixture.ActorId));
        Assert.NotNull(customer);
        fixture.Context.ChangeTracker.Clear();
        Assert.Equal(frozen, await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId));

        var cache = new MemoryCache(new MemoryCacheOptions());
        await new DishCatalogService(new DishRepository(fixture.Context), fixture.Context, cache).UpdateAsync(
            GuidHelper.ToGuidString(fixture.DishId), new UpdateDishRequest { DishName = "Dish edited" });
        await new DishBomService(fixture.Context, cache).UpdateBomLineAsync(
            GuidHelper.ToGuidString(fixture.DishId), GuidHelper.ToGuidString(fixture.BomId),
            new UpdateDishBomLineRequest { GrossQtyPerServing = 0.2m, EffectiveFrom = new DateOnly(2026, 8, 26), Reason = "Phase 30 frozen snapshot proof" },
            GuidHelper.ToGuidString(fixture.ActorId));
        fixture.Context.ChangeTracker.Clear();
        Assert.Equal(frozen, await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId));

        var newVersionId = await fixture.CreateNextMenuSourceVersionAsync();
        var nextPreview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(newVersionId), "New authority source"), default));
        var nextCommit = Payload<QuantityImportCommitDto>(await fixture.Controller.CommitQuantityImport(
            new(nextPreview.Token, nextPreview.ContentFingerprint, "New authority source"), default));
        var next = Payload<ReconciliationBatchDto>(await fixture.Controller.Get(nextCommit.ReconciliationBatchId, default));

        Assert.NotEqual(committed.ImportBatchId, nextCommit.ImportBatchId);
        Assert.NotEqual(committed.ReconciliationBatchId, nextCommit.ReconciliationBatchId);
        var nextLine = Assert.Single(next.Lines);
        Assert.Equal(GuidHelper.ToGuidString(fixture.AlternateUnitId), nextLine.CanonicalUnitId);
        Assert.Equal("Gram", nextLine.CanonicalUnitName);
        Assert.Equal(2000m, nextLine.RequiredQuantity);
        Assert.Equal(1m, Assert.Single(ready.Lines).RequiredQuantity);
        Assert.Equal(frozen, await fixture.PersistedIdentityProjectionAsync(committed.ReconciliationBatchId));
    }

    [Fact]
    public async Task Manual_materialization_of_valid_committed_import_matches_auto_projection_and_ready_semantics()
    {
        await using var autoFixture = await Fixture.CreateAsync();
        await using var manualFixture = await Fixture.CreateAsync();

        var autoPreview = Payload<QuantityImportPreviewDto>(await autoFixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(autoFixture.MenuVersionId), "Nguồn tương đương"), default));
        var autoCommit = Payload<QuantityImportCommitDto>(await autoFixture.Controller.CommitQuantityImport(
            new(autoPreview.Token, autoPreview.ContentFingerprint, "Nguồn tương đương"), default));
        var autoDraft = Payload<ReconciliationBatchDto>(await autoFixture.Controller.Get(autoCommit.ReconciliationBatchId, default));

        var manualImportId = await manualFixture.CreateCommittedImportWithoutBatchAsync("Nguồn tương đương");
        var manualDraft = Payload<ReconciliationBatchDto>(await manualFixture.Controller.Create(
            new(GuidHelper.ToGuidString(manualFixture.MenuVersionId), GuidHelper.ToGuidString(manualImportId)), default));

        Assert.Equal(Projection(autoDraft), Projection(manualDraft));
        Assert.Equal(await autoFixture.PersistedProjectionAsync(), await manualFixture.PersistedProjectionAsync());
        Assert.Equal("DRAFT", manualDraft.Status);
        Assert.Single(manualFixture.Context.Reconciliationbatches);
        Assert.NotEmpty(manualFixture.Context.Reconciliationbatchcontributors);

        var autoReady = Payload<ReconciliationBatchDto>(await autoFixture.Controller.Ready(
            autoDraft.BatchId, new ReadyReconciliationBatchRequest(autoDraft.Version), default));
        var manualReady = Payload<ReconciliationBatchDto>(await manualFixture.Controller.Ready(
            manualDraft.BatchId, new ReadyReconciliationBatchRequest(manualDraft.Version), default));
        Assert.Equal("READY", autoReady.Status);
        Assert.Equal(autoReady.Status, manualReady.Status);
    }

    private static IReadOnlyList<string> Projection(ReconciliationBatchDto batch) => batch.Lines
        .Select(line => $"{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}")
        .OrderBy(value => value, StringComparer.Ordinal)
        .ToList();

    [Theory]
    [InlineData("expired")]
    [InlineData("other-purpose")]
    [InlineData("other-key")]
    [InlineData("tampered")]
    public async Task Commit_rejects_invalid_preview_proof_without_writes(string scenario)
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Preview proof"), default));
        var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var original = handler.ReadJwtToken(preview.Token);
        var now = DateTime.UtcNow;
        var proof = scenario == "tampered"
            ? preview.Token[..(preview.Token.LastIndexOf('.') + 1)] + new string('A', 43)
            : handler.WriteToken(new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
                issuer: "test",
                audience: scenario == "other-purpose" ? "access-token-audience" : original.Audiences.Single(),
                claims: original.Claims.Where(claim => claim.Type is "menuVersionId" or "fingerprint"),
                notBefore: now.AddHours(-1),
                expires: scenario == "expired" ? now.AddMinutes(-1) : now.AddMinutes(15),
                signingCredentials: new Microsoft.IdentityModel.Tokens.SigningCredentials(
                    new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(new string(scenario == "other-key" ? 'z' : 'q', 64))),
                    Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256)));

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Controller.CommitQuantityImport(
            new(proof, preview.ContentFingerprint, "Preview proof"), default));
        Assert.Equal("Phiên xem trước đã hết hạn hoặc không hợp lệ.", error.Message);
        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));
    }

    [Fact]
    public async Task Commit_rejects_stale_source_without_persisting_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
        var staleLine = fixture.Context.Mealquantityplanlines.Single();
        staleLine.FinalServings++;
        staleLine.SavoryServings++; // giữ số suất Mặn/Chay khớp tổng để kiểm đúng nguồn cũ (stale).
        await fixture.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));
    }

    [Fact]
    public async Task Commit_rejects_plan_code_mutation_as_stale_preview_content()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
        fixture.Context.Mealquantityplans.Single().PlanCode = "QTY-CHANGED";
        await fixture.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, preview.ContentFingerprint, "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
    }

    [Fact]
    public async Task Commit_rejects_token_fingerprint_mismatch_without_persisting_authority()
    {
        await using var fixture = await Fixture.CreateAsync();
        var preview = Payload<QuantityImportPreviewDto>(await fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));

        await Assert.ThrowsAsync<InvalidOperationException>(() => fixture.Controller.CommitQuantityImport(
            new(preview.Token, new string('0', 64), "Nguồn chuẩn"), default));

        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.Empty(fixture.Context.Reconciliationbatches);
    }

    [Fact]
    public async Task Preview_rejects_incomplete_or_unpublished_sources()
    {
        await using var fixture = await Fixture.CreateAsync();
        fixture.Context.Mealquantityplans.Single().Status = "FORECASTED";
        await fixture.Context.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));

        fixture.Context.Mealquantityplans.Single().Status = "COMPLETED";
        fixture.Context.Menuversions.Single().Status = "DRAFT";
        await fixture.Context.SaveChangesAsync();
        await Assert.ThrowsAsync<BusinessRuleException>(() => fixture.Controller.PreviewQuantityImport(
            new(GuidHelper.ToGuidString(fixture.MenuVersionId), "Nguồn chuẩn"), default));
    }

    private static T Payload<T>(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<ApiResponse<T>>(ok.Value).Data!;
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly ServiceProvider serviceProvider;
        public ImportTestContext Context { get; }
        public ReconciliationBatchesController Controller { get; }
        public ReconciliationQuantityInspectionController InspectionController { get; private init; } = null!;
        public byte[] MenuVersionId { get; }
        public byte[] ActorId { get; }
        public byte[] CustomerId { get; }
        public byte[] IngredientId { get; }
        public byte[] AlternateUnitId { get; }
        public byte[] DishId { get; }
        public byte[] BomId { get; }
        public byte[] WarehouseId { get; }

        private Fixture(SqliteConnection connection, ServiceProvider serviceProvider, ImportTestContext context, ReconciliationBatchesController controller, byte[] menuVersionId, byte[] actorId, byte[] customerId, byte[] ingredientId, byte[] alternateUnitId, byte[] dishId, byte[] bomId, byte[] warehouseId)
        {
            this.connection = connection;
            this.serviceProvider = serviceProvider;
            Context = context;
            Controller = controller;
            MenuVersionId = menuVersionId;
            ActorId = actorId;
            CustomerId = customerId;
            IngredientId = ingredientId;
            AlternateUnitId = alternateUnitId;
            DishId = dishId;
            BomId = bomId;
            WarehouseId = warehouseId;
        }

        public int CacheEntryCount => serviceProvider.GetRequiredService<MemoryCache>().Count;
        public void ClearPreviewCache() => serviceProvider.GetRequiredService<MemoryCache>().Compact(1);

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
            var context = new ImportTestContext(options);
            await context.Database.EnsureCreatedAsync();
            await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
            var menuVersionId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var planId = GuidHelper.NewId();
            var actorId = GuidHelper.NewId();
            var unit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "KG", UnitName = "Kilogram", BaseUnitCode = "KG", ConvertRateToBase = 1m };
            var alternateUnit = new Unit { UnitId = GuidHelper.NewId(), UnitCode = "G", UnitName = "Gram", BaseUnitCode = "KG", ConvertRateToBase = 0.001m };
            var customer = new Customer { CustomerId = customerId, CustomerCode = "CUS-1", CustomerName = "Customer", IsActive = true };
            var warehouseId = GuidHelper.NewId();
            var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "ING-1", IngredientName = "Ingredient", UnitId = unit.UnitId, WarehouseId = warehouseId, ReferencePrice = 1m, IsActive = true, Unit = unit };
            var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = "DISH-1", DishName = "Dish", IsActive = true };
            var menu = new Menu { MenuId = menuId, MenuCode = "MENU-1", MenuName = "Menu", IsActive = true };
            var menuItem = new MenuItem { MenuItemId = GuidHelper.NewId(), MenuId = menuId, Menu = menu, DishId = dish.DishId, Dish = dish, DisplayOrder = 1 };
            var bom = new DishBom { BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish, IngredientId = ingredient.IngredientId, Ingredient = ingredient, UnitId = unit.UnitId, Unit = unit, GrossQtyPerServing = 0.1m, PriceTierAmount = 25000m, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 8, 1) };
            var tolerance = new ReconciliationTolerance { ToleranceId = GuidHelper.NewId(), ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope, Value = ReconciliationToleranceAuthority.SystemDefaultValue, Version = ReconciliationToleranceAuthority.SystemDefaultVersion, CreatedBy = actorId, CreatedAt = DateTime.UtcNow };
            var menuVersion = new MenuVersion { MenuVersionId = menuVersionId, CustomerId = customerId, WeekStartDate = new DateOnly(2026, 8, 24), VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
            var schedule = new MenuSchedule { MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = menuId, Menu = menu, MenuVersionId = menuVersionId, MenuVersion = menuVersion, MenuPrice = 25000m, ServiceDate = new DateOnly(2026, 8, 25), WeekStartDate = new DateOnly(2026, 8, 24), ShiftName = "MORNING", Status = "ACTIVE" };
            var plan = new MealQuantityPlan { QuantityPlanId = planId, PlanCode = "QTY-1", ServiceDate = schedule.ServiceDate, Status = "COMPLETED", CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow };
            var line = new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan, MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = customerId, MenuId = menuId, Menu = menu, ShiftName = "MORNING", ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10, SavoryServings = 10, VegetarianServings = 0, UpdatedAt = DateTime.UtcNow };
            context.AddRange(unit, alternateUnit, customer, ingredient, dish, menu, menuItem, bom, tolerance, menuVersion, schedule, plan, line);
            await context.SaveChangesAsync();

            var requestContext = new SystemOperationRequestContext { OperationKey = "reconciliation.quantity-import.commit", ExpectedModeVersion = 1, Disposition = IPCManagement.Api.Features.SystemOperation.Services.OperationDisposition.Retained };
            var runner = new ImmediateTransactionRunner();
            var batchService = new ReconciliationBatchService(context, runner, requestContext);
            var cache = new MemoryCache(new MemoryCacheOptions());
            var importService = new ReconciliationQuantityImportService(context, runner, requestContext, Microsoft.Extensions.Options.Options.Create(new JwtSettings { SecretKey = new string('q', 64), Issuer = "test" }), batchService);
            var completionService = new ReconciliationCompletionService(context, batchService, runner, requestContext);
            var services = new ServiceCollection();
            services.AddControllers().AddApplicationPart(typeof(ReconciliationBatchesController).Assembly).AddControllersAsServices();
            services.AddSingleton(batchService);
            services.AddSingleton(importService);
            services.AddSingleton(cache);
            services.AddSingleton(completionService);
            services.AddSingleton<ICurrentUserService>(new StubCurrentUser(GuidHelper.ToGuidString(actorId)));
            var serviceProvider = services.BuildServiceProvider();
            var controller = serviceProvider.GetRequiredService<ReconciliationBatchesController>();
            return new Fixture(connection, serviceProvider, context, controller, menuVersionId, actorId, customerId, ingredient.IngredientId, alternateUnit.UnitId, dish.DishId, bom.BomId, warehouseId)
            { InspectionController = new ReconciliationQuantityInspectionController(importService) };
        }

        public async Task<IReadOnlyList<string>> PersistedIdentityProjectionAsync(string batchId)
        {
            var parsed = GuidHelper.ParseGuidString(batchId)!;
            var batch = await Context.Reconciliationbatches.AsNoTracking().SingleAsync(item => item.BatchId == parsed);
            var sourceCustomerId = await Context.Menuversions.AsNoTracking()
                .Where(version => version.MenuVersionId == batch.MenuVersionId)
                .Select(version => version.CustomerId)
                .SingleAsync();
            var lines = await Context.Reconciliationbatchlines.AsNoTracking()
                .Where(line => line.BatchId == parsed)
                .OrderBy(line => line.BatchLineId)
                .Select(line => new
                {
                    line.BatchLineId, line.BatchId, line.IngredientId,
                    line.CanonicalUnitId,
                    CanonicalUnitCode = line.CanonicalUnit.UnitCode,
                    CanonicalUnitName = line.CanonicalUnit.UnitName,
                    line.RequiredQuantity, line.FrozenTolerance, line.ToleranceSourceKind, line.ToleranceSourceVersion, line.Version
                }).ToListAsync();
            var contributors = await Context.Reconciliationbatchcontributors.AsNoTracking()
                .Where(item => lines.Select(line => line.BatchLineId).Contains(item.BatchLineId))
                .OrderBy(item => item.ContributorId)
                .Select(item => new { item.ContributorId, item.BatchLineId, item.MenuScheduleId, item.MealQuantityPlanLineId, item.DishBomId, item.SourceQuantity })
                .ToListAsync();
            return
            [
                $"B|{GuidHelper.ToGuidString(batch.BatchId)}|{GuidHelper.ToGuidString(batch.MenuVersionId)}|{GuidHelper.ToGuidString(batch.QuantityImportBatchId)}|{Convert.ToHexString(sourceCustomerId)}|{batch.Status}|{batch.Version}|{batch.CreatedAt:O}|{Convert.ToHexString(batch.CreatedBy)}",
                .. lines.Select(line => $"L|{Convert.ToHexString(line.BatchLineId)}|{Convert.ToHexString(line.BatchId)}|{Convert.ToHexString(line.IngredientId)}|{Convert.ToHexString(line.CanonicalUnitId)}|{line.CanonicalUnitCode}|{line.CanonicalUnitName}|{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}|{line.ToleranceSourceKind}|{line.ToleranceSourceVersion}|{line.Version}"),
                .. contributors.Select(item => $"C|{Convert.ToHexString(item.ContributorId)}|{Convert.ToHexString(item.BatchLineId)}|{Convert.ToHexString(item.MenuScheduleId)}|{Convert.ToHexString(item.MealQuantityPlanLineId)}|{Convert.ToHexString(item.DishBomId)}|{item.SourceQuantity:F6}")
            ];
        }

        public async Task<byte[]> CreateNextMenuSourceVersionAsync()
        {
            var existingVersion = await Context.Menuversions.AsNoTracking().SingleAsync(item => item.MenuVersionId == MenuVersionId);
            var existingSchedule = await Context.Menuschedules.AsNoTracking().SingleAsync(item => item.MenuVersionId == MenuVersionId);
            var existingLine = await Context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == existingSchedule.MenuScheduleId);
            var versionId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var planId = GuidHelper.NewId();
            var serviceDate = existingSchedule.ServiceDate.AddDays(7);
            var version = new MenuVersion
            {
                MenuVersionId = versionId, CustomerId = existingVersion.CustomerId, WeekStartDate = existingVersion.WeekStartDate.AddDays(7),
                VersionNo = existingVersion.VersionNo + 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            var schedule = new MenuSchedule
            {
                MenuScheduleId = scheduleId, CustomerId = existingSchedule.CustomerId, MenuId = existingSchedule.MenuId,
                MenuVersionId = versionId, MenuVersion = version, MenuPrice = existingSchedule.MenuPrice, ServiceDate = serviceDate,
                WeekStartDate = existingSchedule.WeekStartDate.AddDays(7), ShiftName = existingSchedule.ShiftName, Status = "ACTIVE"
            };
            var plan = new MealQuantityPlan
            {
                QuantityPlanId = planId, PlanCode = "QTY-2", ServiceDate = serviceDate, Status = "COMPLETED",
                CompletedAt = DateTime.UtcNow, RowVersion = DateTime.UtcNow
            };
            var line = new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = planId, QuantityPlan = plan,
                MenuScheduleId = scheduleId, MenuSchedule = schedule, CustomerId = existingLine.CustomerId, MenuId = existingLine.MenuId,
                ShiftName = existingLine.ShiftName, ForecastServings = 10, ConfirmedServings = 10, FinalServings = 10, SavoryServings = 10, VegetarianServings = 0, UpdatedAt = DateTime.UtcNow
            };
            Context.AddRange(version, schedule, plan, line);
            await Context.SaveChangesAsync();
            return versionId;
        }

        public async Task<IReadOnlyList<string>> PersistedProjectionAsync()
        {
            var lines = await Context.Reconciliationbatchlines.AsNoTracking()
                .Include(line => line.Contributors)
                .ToListAsync();
            return lines.Select(line =>
                    $"{line.RequiredQuantity:F6}|{line.FrozenTolerance:F6}|{line.ToleranceSourceKind}|{line.ToleranceSourceVersion}|{string.Join(',', line.Contributors.Select(contributor => contributor.SourceQuantity).OrderBy(quantity => quantity).Select(quantity => quantity.ToString("F6")))}")
                .OrderBy(value => value, StringComparer.Ordinal)
                .ToList();
        }

        public async Task<byte[]> CreateCommittedImportWithoutBatchAsync(string sourceLabel)
        {
            var preview = Payload<QuantityImportPreviewDto>(await Controller.PreviewQuantityImport(
                new(GuidHelper.ToGuidString(MenuVersionId), sourceLabel), default));
            var importId = GuidHelper.NewId();
            var now = DateTime.UtcNow;
            Context.Quantityimportbatches.Add(new QuantityImportBatch
            {
                ImportBatchId = importId, BatchCode = $"MANUAL-{preview.ContentFingerprint[..8]}",
                SourceType = "API", SourceCompanyName = sourceLabel, SourceLabel = sourceLabel,
                MenuVersionId = MenuVersionId, ContentFingerprint = preview.ContentFingerprint,
                FingerprintFormatVersion = preview.FingerprintFormatVersion, ImportedBy = ActorId,
                ImportedAt = now, Status = "CONFIRMED"
            });
            foreach (var plan in Context.Mealquantityplans) plan.ImportBatchId = importId;
            Context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = ActorId,
                BusinessArea = "Reconciliation", EntityName = nameof(QuantityImportBatch), EntityId = importId,
                FieldName = "Commit", NewValue = preview.ContentFingerprint, Reason = "Fixture committed import authority"
            });
            await Context.SaveChangesAsync();
            Assert.Empty(Context.Reconciliationbatches);
            return importId;
        }

        public async ValueTask DisposeAsync()
        {
            await serviceProvider.DisposeAsync();
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private sealed class StubCurrentUser(string id) : IPCManagement.Api.Security.ICurrentUserService
    {
        public string? GetUserId(System.Security.Claims.ClaimsPrincipal user) => id;
        public IReadOnlyList<string> GetRoleNames(System.Security.Claims.ClaimsPrincipal user) => ["Coordinator"];
        public string? GetWarehouseId(System.Security.Claims.ClaimsPrincipal user) => null;
    }

    private sealed class ImmediateTransactionRunner : IEfTransactionRunner
    {
        public async Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => await operation(cancellationToken);
        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => operation(cancellationToken);
        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => operation(cancellationToken);
    }

    private sealed class ImportTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.UseCollation("BINARY");
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var index in entity.GetIndexes())
                    index.SetDatabaseName($"{entity.GetTableName()}_{index.GetDatabaseName()}");
            }
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
}
