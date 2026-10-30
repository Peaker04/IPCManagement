using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

/// <summary>
/// BR-MRX-EDIT-3/5/7/8: khóa theo ngày đã có phiếu xuất và tính lại tại chỗ chỉ các ngày còn mở.
/// Lô có hai ngày 2026-06-15 (đã xuất, khóa) và 2026-06-17 (mở), một nguyên liệu, 100 suất mặn mỗi ngày.
/// </summary>
public sealed class MrxBatchRecomputerTests
{
    private static readonly DateOnly LockedDay = new(2026, 6, 15);
    private static readonly DateOnly OpenDay = new(2026, 6, 17);

    [Fact]
    public async Task Lock_reader_returns_issued_service_dates()
    {
        await using var scenario = await Scenario.CreateAsync();

        var locked = await MrxDayLockReader.GetLockedDatesAsync(scenario.Context, scenario.Batch.BatchId, CancellationToken.None);

        locked.Should().BeEquivalentTo([LockedDay]);
    }

    [Fact]
    public async Task Lock_reader_includes_service_date_of_daily_line_referenced_by_issue_line()
    {
        await using var scenario = await Scenario.CreateAsync();
        // Phiếu lập ngày 16 nhưng dòng phiếu trỏ daily line ngày 17 → cả 16 và 17 đều khóa (bảo thủ).
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-MRX-LATE", IssueDate = new DateOnly(2026, 6, 16),
            WarehouseId = scenario.Fixture.WarehouseId, ReconciliationBatchId = scenario.Batch.BatchId,
            IssuedBy = scenario.Fixture.UserId, CreatedAt = DateTime.UtcNow
        };
        issue.Inventoryissuelines.Add(new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId, IngredientId = scenario.Ingredient.IngredientId,
            UnitId = scenario.Ingredient.UnitId, ReconciliationBatchLineId = scenario.BatchLine.BatchLineId,
            ReconciliationBatchDailyLineId = scenario.OpenDaily.DailyLineId, RequestedQty = 1m, IssuedQty = 1m
        });
        scenario.Context.Inventoryissues.Add(issue);
        await scenario.Context.SaveChangesAsync();

        var locked = await MrxDayLockReader.GetLockedDatesAsync(scenario.Context, scenario.Batch.BatchId, CancellationToken.None);

        locked.Should().BeEquivalentTo([LockedDay, new DateOnly(2026, 6, 16), OpenDay]);
    }

    [Fact]
    public async Task Open_day_requirement_and_contributors_are_replaced()
    {
        await using var scenario = await Scenario.CreateAsync();
        var oldOpenContributorId = scenario.OpenContributor.ContributorId;
        scenario.OpenPlanLine.SavoryServings = 150;
        scenario.OpenPlanLine.FinalServings = 150;
        await scenario.Context.SaveChangesAsync();

        await scenario.ApplyAsync();

        scenario.OpenDaily.RequiredQuantity.Should().Be(300m);
        scenario.OpenDaily.Version.Should().Be(2);
        var contributor = (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(item => item.DailyLineId == scenario.OpenDaily.DailyLineId).ToListAsync()).Should().ContainSingle().Subject;
        contributor.ContributorId.Should().NotEqual(oldOpenContributorId);
        contributor.FrozenMenuVariant.Should().Be("savory");
        contributor.FrozenServings.Should().Be(150);
        contributor.SourceQuantity.Should().Be(300m);
        contributor.MealQuantityPlanLineId.Should().Equal(scenario.OpenPlanLine.QuantityPlanLineId);
        (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking().AnyAsync(item => item.ContributorId == oldOpenContributorId))
            .Should().BeFalse();
        scenario.BatchLine.RequiredQuantity.Should().Be(500m);
    }

    [Fact]
    public async Task Locked_day_lines_and_contributors_are_untouched()
    {
        await using var scenario = await Scenario.CreateAsync();
        var dailyBefore = await scenario.Context.Reconciliationbatchdailylines.AsNoTracking()
            .SingleAsync(item => item.DailyLineId == scenario.LockedDaily.DailyLineId);
        var contributorsBefore = await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(item => item.DailyLineId == scenario.LockedDaily.DailyLineId).ToListAsync();
        // Nguồn của ngày khóa cũng đổi, nhưng ngày khóa phải giữ nguyên số đóng băng (BR-MRX-EDIT-7).
        scenario.LockedPlanLine.SavoryServings = 150;
        scenario.LockedPlanLine.FinalServings = 150;
        scenario.OpenPlanLine.SavoryServings = 150;
        scenario.OpenPlanLine.FinalServings = 150;
        await scenario.Context.SaveChangesAsync();

        await scenario.ApplyAsync();

        scenario.Context.ChangeTracker.Clear();
        var dailyAfter = await scenario.Context.Reconciliationbatchdailylines.AsNoTracking()
            .SingleAsync(item => item.DailyLineId == scenario.LockedDaily.DailyLineId);
        dailyAfter.Should().BeEquivalentTo(dailyBefore, options => options.Excluding(item => item.BatchLine)
            .Excluding(item => item.Contributors).Excluding(item => item.InventoryIssueLines).Excluding(item => item.Disposition));
        var contributorsAfter = await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(item => item.DailyLineId == scenario.LockedDaily.DailyLineId).ToListAsync();
        contributorsAfter.Should().BeEquivalentTo(contributorsBefore, options => options
            .Excluding(item => item.BatchLine).Excluding(item => item.DailyLine));
        (await scenario.Context.Reconciliationdailydispositions.SingleAsync()).InvalidatedAt.Should().BeNull();
        (await scenario.Context.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId))
            .RequiredQuantity.Should().Be(300m);
    }

    [Fact]
    public async Task Removed_ingredient_zeroes_open_day_and_keeps_locked_day()
    {
        await using var scenario = await Scenario.CreateAsync();
        var replacement = await scenario.AddDishWithNewIngredientAsync("REPLACE", grossPerServing: 3m);
        // Ngày mở đổi món: nguyên liệu cũ bị bỏ ở ngày 17 nhưng vẫn còn ở ngày 15 (khóa).
        scenario.OpenMenuItem.DishId = replacement.Dish.DishId;
        await scenario.Context.SaveChangesAsync();

        await scenario.ApplyAsync();

        scenario.OpenDaily.RequiredQuantity.Should().Be(0m);
        scenario.OpenDaily.Version.Should().Be(2);
        scenario.LockedDaily.RequiredQuantity.Should().Be(200m);
        scenario.LockedDaily.Version.Should().Be(1);
        scenario.BatchLine.RequiredQuantity.Should().Be(200m);
        scenario.BatchLine.RequiredQuantity.Should().Be(scenario.BatchLine.DailyLines.Sum(item => item.RequiredQuantity));
        (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .AnyAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId)).Should().BeFalse();
        var newLine = scenario.Batch.Lines.Single(item => item.IngredientId.SequenceEqual(replacement.Ingredient.IngredientId));
        newLine.RequiredQuantity.Should().Be(300m);
        newLine.RequiredQuantity.Should().Be(newLine.DailyLines.Sum(item => item.RequiredQuantity));
    }

    [Fact]
    public async Task New_ingredient_creates_batch_line_and_daily_line()
    {
        await using var scenario = await Scenario.CreateAsync();
        var vegetarian = await scenario.AddDishWithNewIngredientAsync("VEG", grossPerServing: 0.5m);
        scenario.Context.Menuitems.Add(new MenuItem
        {
            MenuItemId = GuidHelper.NewId(), MenuId = scenario.OpenSchedule.MenuId, DishId = vegetarian.Dish.DishId,
            DisplayOrder = 2, DishSlot = "vegetarian-main"
        });
        scenario.OpenPlanLine.SavoryServings = 80;
        scenario.OpenPlanLine.VegetarianServings = 20;
        await scenario.Context.SaveChangesAsync();

        await scenario.ApplyAsync();

        var newLine = scenario.Batch.Lines.Should().ContainSingle(item => item.IngredientId.SequenceEqual(vegetarian.Ingredient.IngredientId)).Subject;
        newLine.FrozenTolerance.Should().Be(0.5m);
        newLine.ToleranceSourceKind.Should().Be("SYSTEM_DEFAULT");
        newLine.RequiredQuantity.Should().Be(10m);
        var daily = newLine.DailyLines.Should().ContainSingle().Subject;
        daily.ServiceDate.Should().Be(OpenDay);
        daily.RequiredQuantity.Should().Be(10m);
        var contributor = (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(item => item.DailyLineId == daily.DailyLineId).ToListAsync()).Should().ContainSingle().Subject;
        contributor.FrozenMenuVariant.Should().Be("vegetarian");
        contributor.FrozenServings.Should().Be(20);
        scenario.OpenDaily.RequiredQuantity.Should().Be(160m);
        (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId)).FrozenServings.Should().Be(80);
    }

    [Fact]
    public async Task Batch_points_to_applied_menu_version_and_version_increments()
    {
        await using var scenario = await Scenario.CreateAsync();
        scenario.OpenPlanLine.SavoryServings = 120;
        scenario.OpenPlanLine.FinalServings = 120;
        await scenario.Context.SaveChangesAsync();

        var revision = await scenario.ApplyAsync();

        scenario.Batch.MenuVersionId.Should().Equal(scenario.AppliedVersion.MenuVersionId);
        scenario.Batch.Version.Should().Be(2);
        var persisted = await scenario.Context.Reconciliationsourcerevisions.AsNoTracking().SingleAsync();
        persisted.SourceRevisionId.Should().Equal(revision.SourceRevisionId);
        persisted.Status.Should().Be("APPLIED");
        persisted.RevisionNumber.Should().Be(1);
        persisted.AppliedBy.Should().Equal(scenario.Fixture.UserId);
        persisted.AppliedByRole.Should().Be("ADMIN");
        persisted.ApplyMode.Should().Be("DIRECT");
        persisted.Reason.Should().Be("Tăng số suất ngày 17.");
        persisted.PreviousMenuVersionId.Should().Equal(scenario.BaseVersion.MenuVersionId);
        persisted.AppliedMenuVersionId.Should().Equal(scenario.AppliedVersion.MenuVersionId);
        persisted.MenuAmendmentId.Should().BeNull();
    }

    [Fact]
    public async Task No_supplemental_or_return_deltas_are_created()
    {
        await using var scenario = await Scenario.CreateAsync();
        var replacement = await scenario.AddDishWithNewIngredientAsync("SWAP", grossPerServing: 1m);
        scenario.OpenMenuItem.DishId = replacement.Dish.DishId;
        scenario.LockedPlanLine.SavoryServings = 150;
        scenario.LockedPlanLine.FinalServings = 150;
        await scenario.Context.SaveChangesAsync();

        var revision = await scenario.ApplyAsync();

        var deltas = await scenario.Context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(item => item.SourceRevisionId == revision.SourceRevisionId).ToListAsync();
        deltas.Should().HaveCount(2, "only the two changed open-day (date, ingredient) pairs produce history");
        deltas.Should().OnlyContain(item => item.Status == "APPLIED" && item.WorkKind == "SOURCE_CHANGE" && item.ServiceDate == OpenDay);
        deltas.Should().ContainSingle(item => item.IngredientId.SequenceEqual(scenario.Ingredient.IngredientId)
            && item.PreviousRequiredQuantity == 200m && item.NewRequiredQuantity == 0m && item.DeltaQuantity == -200m);
        deltas.Should().ContainSingle(item => item.IngredientId.SequenceEqual(replacement.Ingredient.IngredientId)
            && item.PreviousRequiredQuantity == 0m && item.NewRequiredQuantity == 100m && item.DeltaQuantity == 100m);
        (await scenario.Context.Reconciliationsourcedeltas.AnyAsync(item =>
            item.WorkKind == "SUPPLEMENTAL_ISSUE" || item.WorkKind == "RETURN_REQUIRED" || item.Status == "PENDING")).Should().BeFalse();
    }

    [Fact]
    public async Task Unchanged_open_day_creates_no_delta_and_keeps_daily_version()
    {
        await using var scenario = await Scenario.CreateAsync();

        var revision = await scenario.ApplyAsync();

        (await scenario.Context.Reconciliationsourcedeltas.CountAsync(item => item.SourceRevisionId == revision.SourceRevisionId)).Should().Be(0);
        scenario.OpenDaily.Version.Should().Be(1);
        scenario.OpenDaily.RequiredQuantity.Should().Be(200m);
        (await scenario.Context.Reconciliationbatchcontributors.AsNoTracking()
            .SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId)).FrozenMenuVariant.Should().Be("savory");
    }

    [Fact]
    public async Task Completed_batch_is_rejected_with_batch_completed_code()
    {
        await using var scenario = await Scenario.CreateAsync();
        scenario.Batch.Status = "COMPLETED";
        await scenario.Context.SaveChangesAsync();

        var act = () => scenario.ApplyAsync();

        (await act.Should().ThrowAsync<MrxSourceChangeException>()).Which.Code.Should().Be(MrxErrorCodes.BatchCompleted);
        (await scenario.Context.Reconciliationsourcerevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Replay_with_same_amendment_returns_existing_revision_without_rewriting()
    {
        await using var scenario = await Scenario.CreateAsync();
        scenario.OpenPlanLine.SavoryServings = 150;
        scenario.OpenPlanLine.FinalServings = 150;
        await scenario.Context.SaveChangesAsync();
        var amendmentId = GuidHelper.NewId();

        var first = await scenario.ApplyAsync(amendmentId);
        var replay = await scenario.ApplyAsync(amendmentId);

        replay.SourceRevisionId.Should().Equal(first.SourceRevisionId);
        (await scenario.Context.Reconciliationsourcerevisions.CountAsync()).Should().Be(1);
        scenario.Batch.Version.Should().Be(2);
        scenario.OpenDaily.Version.Should().Be(2);
    }

    private sealed class Scenario : IAsyncDisposable
    {
        public required WorkflowGenerationTests.WorkflowFixture Fixture { get; init; }
        public required IpcManagementContext Context { get; init; }
        public required ReconciliationBatch Batch { get; init; }
        public required ReconciliationBatchLine BatchLine { get; init; }
        public required ReconciliationBatchDailyLine LockedDaily { get; init; }
        public required ReconciliationBatchDailyLine OpenDaily { get; init; }
        public required ReconciliationBatchContributor OpenContributor { get; init; }
        public required MenuVersion BaseVersion { get; init; }
        public required MenuVersion AppliedVersion { get; init; }
        public required MenuSchedule LockedSchedule { get; init; }
        public required MenuSchedule OpenSchedule { get; init; }
        public required MenuItem OpenMenuItem { get; init; }
        public required MealQuantityPlanLine LockedPlanLine { get; init; }
        public required MealQuantityPlanLine OpenPlanLine { get; init; }
        public required DishBom Bom { get; init; }
        public required Ingredient Ingredient { get; init; }

        public static async Task<Scenario> CreateAsync()
        {
            var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
            await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
            var context = fixture.CreateContext();
            await WorkflowGenerationTests.EnsureMrxRevisionSchemaAsync(context);

            var lockedSchedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
                .SingleAsync(item => item.ServiceDate == LockedDay);
            var lockedPlanLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == lockedSchedule.MenuScheduleId);
            lockedPlanLine.SavoryServings = 100;
            lockedPlanLine.VegetarianServings = 0;
            var dish = lockedSchedule.Menu.Menuitems.Single().Dish;
            var bom = await context.Dishboms.Include(item => item.Ingredient).ThenInclude(item => item.Unit).Include(item => item.Unit)
                .SingleAsync(item => item.DishId == dish.DishId);

            var baseVersion = NewVersion(lockedSchedule.CustomerId, 1);
            var appliedVersion = NewVersion(lockedSchedule.CustomerId, 2);
            context.Menuversions.AddRange(baseVersion, appliedVersion);
            lockedSchedule.MenuVersionId = baseVersion.MenuVersionId;

            var openMenu = new Menu { MenuId = GuidHelper.NewId(), MenuCode = "MENU-WED", MenuName = "Menu thứ tư", IsActive = true };
            var openMenuItem = new MenuItem { MenuItemId = GuidHelper.NewId(), MenuId = openMenu.MenuId, DishId = dish.DishId, DisplayOrder = 1, DishSlot = "savory-main" };
            var openSchedule = new MenuSchedule
            {
                MenuScheduleId = GuidHelper.NewId(), CustomerId = lockedSchedule.CustomerId, MenuId = openMenu.MenuId,
                ServiceDate = OpenDay, WeekStartDate = LockedDay, ShiftName = "MORNING", MenuPrice = lockedSchedule.MenuPrice,
                BomRatePercent = 100, Status = "ACTIVE", MenuVersionId = baseVersion.MenuVersionId
            };
            var openPlan = new MealQuantityPlan
            {
                QuantityPlanId = GuidHelper.NewId(), PlanCode = "QTY-20260617", ServiceDate = OpenDay, Status = "COMPLETED",
                ConfirmationTime = new TimeOnly(9, 0), ConfirmedBy = fixture.UserId
            };
            var openPlanLine = new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = openPlan.QuantityPlanId, MenuScheduleId = openSchedule.MenuScheduleId,
                CustomerId = lockedSchedule.CustomerId, MenuId = openMenu.MenuId, ShiftName = "MORNING",
                ForecastServings = 100, ConfirmedServings = 100, FinalServings = 100, SavoryServings = 100, VegetarianServings = 0
            };
            context.Menus.Add(openMenu);
            context.Menuitems.Add(openMenuItem);
            context.Menuschedules.Add(openSchedule);
            context.Mealquantityplans.Add(openPlan);
            context.Mealquantityplanlines.Add(openPlanLine);

            var batch = new ReconciliationBatch
            {
                BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
                Status = "IN_PROGRESS", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
            };
            var batchLine = new ReconciliationBatchLine
            {
                BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, IngredientId = bom.IngredientId,
                CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = 400m, FrozenTolerance = 0.5m,
                ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1, Batch = batch
            };
            batch.Lines.Add(batchLine);
            ReconciliationBatchDailyLine Daily(DateOnly date)
            {
                var daily = new ReconciliationBatchDailyLine
                {
                    DailyLineId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, BatchId = batch.BatchId,
                    IngredientId = batchLine.IngredientId, CanonicalUnitId = batchLine.CanonicalUnitId,
                    ServiceDate = date, RequiredQuantity = 200m, Version = 1, BatchLine = batchLine
                };
                batchLine.DailyLines.Add(daily);
                return daily;
            }
            ReconciliationBatchContributor Contributor(ReconciliationBatchDailyLine daily, MenuSchedule schedule, MealQuantityPlanLine planLine)
            {
                var contributor = new ReconciliationBatchContributor
                {
                    ContributorId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, DailyLineId = daily.DailyLineId,
                    MenuScheduleId = schedule.MenuScheduleId, MealQuantityPlanLineId = planLine.QuantityPlanLineId,
                    DishBomId = bom.BomId, DishId = dish.DishId, FrozenShiftName = "MORNING", FrozenDishCode = dish.DishCode,
                    FrozenDishName = dish.DishName, FrozenMenuVariant = "savory", FrozenServings = 100,
                    FrozenBomQuantityPerServing = bom.GrossQtyPerServing, FrozenWasteRatePercent = bom.WasteRatePercent, SourceQuantity = 200m
                };
                batchLine.Contributors.Add(contributor);
                return contributor;
            }
            var lockedDaily = Daily(LockedDay);
            var openDaily = Daily(OpenDay);
            Contributor(lockedDaily, lockedSchedule, lockedPlanLine);
            var openContributor = Contributor(openDaily, openSchedule, openPlanLine);
            context.Reconciliationbatches.Add(batch);

            var issue = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(), IssueCode = "ISS-MRX-0615", IssueDate = LockedDay, WarehouseId = fixture.WarehouseId,
                ReconciliationBatchId = batch.BatchId, IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
            };
            issue.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId, IngredientId = batchLine.IngredientId, UnitId = batchLine.CanonicalUnitId,
                ReconciliationBatchLineId = batchLine.BatchLineId, ReconciliationBatchDailyLineId = lockedDaily.DailyLineId,
                ReconciliationServiceDate = LockedDay, RequestedQty = 200m, IssuedQty = 200m
            });
            context.Inventoryissues.Add(issue);
            context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
            {
                DispositionId = GuidHelper.NewId(), DailyLineId = lockedDaily.DailyLineId, Category = "ACCEPTED_VARIANCE",
                Reason = "Quyết định ngày đã xuất", Version = 1, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow
            });
            context.Reconciliationtolerances.Add(new ReconciliationTolerance
            {
                ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
                CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();

            return new Scenario
            {
                Fixture = fixture, Context = context, Batch = batch, BatchLine = batchLine, LockedDaily = lockedDaily, OpenDaily = openDaily,
                OpenContributor = openContributor, BaseVersion = baseVersion, AppliedVersion = appliedVersion,
                LockedSchedule = lockedSchedule, OpenSchedule = openSchedule, OpenMenuItem = openMenuItem,
                LockedPlanLine = lockedPlanLine, OpenPlanLine = openPlanLine, Bom = bom, Ingredient = bom.Ingredient
            };
        }

        public async Task<(Dish Dish, Ingredient Ingredient)> AddDishWithNewIngredientAsync(string code, decimal grossPerServing)
        {
            var ingredient = new Ingredient
            {
                IngredientId = GuidHelper.NewId(), IngredientCode = $"ING-{code}", IngredientName = $"Nguyên liệu {code}",
                UnitId = Fixture.UnitId, WarehouseId = Fixture.WarehouseId, ReferencePrice = 1000m, IsFreshDaily = true, IsActive = true
            };
            var dish = new Dish { DishId = GuidHelper.NewId(), DishCode = $"DISH-{code}", DishName = $"Món {code}", IsActive = true };
            Context.Ingredients.Add(ingredient);
            Context.Dishes.Add(dish);
            Context.Dishboms.Add(new DishBom
            {
                BomId = GuidHelper.NewId(), DishId = dish.DishId, IngredientId = ingredient.IngredientId, UnitId = Fixture.UnitId,
                CustomerId = Bom.CustomerId, PriceTierAmount = Bom.PriceTierAmount, GrossQtyPerServing = grossPerServing,
                WasteRatePercent = 0, BomStatus = "PUBLISHED", EffectiveFrom = new DateOnly(2026, 1, 1)
            });
            await Context.SaveChangesAsync();
            return (dish, ingredient);
        }

        public async Task<ReconciliationSourceRevision> ApplyAsync(byte[]? menuAmendmentId = null)
        {
            var requirements = await MrxBatchRecomputer.LoadRequirementsAsync(
                Context, [LockedSchedule.MenuScheduleId, OpenSchedule.MenuScheduleId], CancellationToken.None);
            var locked = await MrxDayLockReader.GetLockedDatesAsync(Context, Batch.BatchId, CancellationToken.None);
            var batch = await MrxBatchRecomputer.LoadBatchAsync(Context, Batch.BatchId, CancellationToken.None);
            return await new MrxBatchRecomputer(Context).ApplyAsync(batch, requirements, locked,
                new MrxRevisionStamp(Fixture.UserId, "ADMIN", "DIRECT", "Tăng số suất ngày 17.",
                    BaseVersion.MenuVersionId, AppliedVersion.MenuVersionId, menuAmendmentId),
                CancellationToken.None);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await Fixture.DisposeAsync();
        }

        private static MenuVersion NewVersion(byte[] customerId, int versionNo) => new()
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = LockedDay,
            VersionNo = versionNo, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
    }
}
