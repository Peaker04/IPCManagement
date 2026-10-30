using System.Data;
using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

/// <summary>
/// BR-MRX-EDIT-1..9: đường ghi duy nhất cho sửa nguồn MRX (áp dụng trực tiếp, duyệt yêu cầu).
/// Lô có hai ngày 2026-06-15 (đã xuất, khóa) và 2026-06-17 (mở), một nguyên liệu, 100 suất mặn mỗi ngày, BOM 2 kg/suất.
/// </summary>
public sealed class MrxSourceChangeApplierTests
{
    private static readonly DateOnly LockedDay = new(2026, 6, 15);
    private static readonly DateOnly OpenDay = new(2026, 6, 17);
    private static readonly string[] ManagerRoles = ["Quản lý"];

    [Fact]
    public async Task Manager_direct_apply_updates_open_day()
    {
        await using var scenario = await Scenario.CreateAsync();

        var result = await scenario.Service().ApplyMrxAsync(scenario.Request(Servings(OpenDay, 150, 0)), scenario.ManagerIdString, ManagerRoles);

        result.Status.Should().Be("EXECUTED");
        await using var verify = scenario.Fixture.CreateContext();
        var openPlan = await verify.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == scenario.OpenPlanLine.QuantityPlanLineId);
        openPlan.SavoryServings.Should().Be(150);
        openPlan.VegetarianServings.Should().Be(0);
        openPlan.FinalServings.Should().Be(150);
        var openDaily = await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId);
        openDaily.RequiredQuantity.Should().Be(300m);
        openDaily.Version.Should().Be(2);
        var lockedDaily = await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.LockedDaily.DailyLineId);
        lockedDaily.RequiredQuantity.Should().Be(200m);
        lockedDaily.Version.Should().Be(1);
        (await verify.Reconciliationbatchlines.AsNoTracking().SingleAsync()).RequiredQuantity.Should().Be(500m);
        var contributor = await verify.Reconciliationbatchcontributors.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId);
        contributor.FrozenServings.Should().Be(150);
        var batch = await verify.Reconciliationbatches.AsNoTracking().SingleAsync();
        batch.Version.Should().Be(2);
        batch.MenuVersionId.Should().Equal(GuidHelper.ParseGuidString(result.AppliedMenuVersionId)!);
        var revision = await verify.Reconciliationsourcerevisions.AsNoTracking().SingleAsync();
        revision.AppliedByRole.Should().Be("MANAGER");
        revision.ApplyMode.Should().Be("DIRECT");
        revision.AppliedBy.Should().Equal(scenario.ManagerId);
        var amendment = await verify.Menuamendments.AsNoTracking().SingleAsync();
        amendment.Status.Should().Be("EXECUTED");
        amendment.CreatedBy.Should().Equal(scenario.ManagerId);
        amendment.ExecutedBy.Should().Equal(scenario.ManagerId);
        var savoryAudit = await verify.Auditlogs.AsNoTracking().SingleAsync(item =>
            item.EntityName == nameof(MealQuantityPlanLine) && item.FieldName == nameof(MealQuantityPlanLine.SavoryServings));
        savoryAudit.OldValue.Should().Be("100");
        savoryAudit.NewValue.Should().Be("150");
        savoryAudit.Reason.Should().Be(Scenario.Reason);
        savoryAudit.EntityId.Should().Equal(scenario.OpenPlanLine.QuantityPlanLineId);
        (await verify.Auditlogs.AsNoTracking().AnyAsync(item => item.FieldName == nameof(MealQuantityPlanLine.VegetarianServings))).Should().BeFalse();
        result.LockedDates.Should().Equal(LockedDay);
        result.MaterialImpact.Should().ContainSingle().Which.Should().Be(
            new MrxMaterialImpactDto(OpenDay, "ING", "Ingredient", "kg", 200m, 300m));
    }

    [Fact]
    public async Task Change_touching_locked_day_is_rejected_and_writes_nothing()
    {
        await using var scenario = await Scenario.CreateAsync();
        var before = await scenario.CountsAsync();

        var action = () => scenario.Service().ApplyMrxAsync(
            scenario.Request(Servings(OpenDay, 150, 0), Servings(LockedDay, 120, 0)), scenario.ManagerIdString, ManagerRoles);

        var error = (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which;
        error.Code.Should().Be(MrxErrorCodes.DayLocked);
        error.StatusCode.Should().Be(409);
        error.LockedDates.Should().Equal(LockedDay);
        (await scenario.CountsAsync()).Should().Be(before);
        await scenario.AssertSourceUnchangedAsync();
    }

    [Fact]
    public async Task Unchanged_locked_day_line_is_ignored()
    {
        await using var scenario = await Scenario.CreateAsync();

        // Lưới tuần gửi cả ô của ngày khóa với giá trị y như nguồn: không phải "chạm ngày khóa".
        var result = await scenario.Service().ApplyMrxAsync(
            scenario.Request(Servings(LockedDay, 100, 0), Servings(OpenDay, 150, 0)), scenario.ManagerIdString, ManagerRoles);

        result.Status.Should().Be("EXECUTED");
        result.ImpactLines.Should().ContainSingle().Which.ServiceDate.Should().Be(OpenDay);
        await using var verify = scenario.Fixture.CreateContext();
        var lockedDaily = await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.LockedDaily.DailyLineId);
        lockedDaily.RequiredQuantity.Should().Be(200m);
        lockedDaily.Version.Should().Be(1);
        (await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId))
            .RequiredQuantity.Should().Be(300m);
        (await verify.Auditlogs.AsNoTracking().CountAsync(item => item.FieldName == nameof(MealQuantityPlanLine.SavoryServings))).Should().Be(1);
    }

    [Fact]
    public async Task Replacement_without_bom_writes_nothing()
    {
        await using var scenario = await Scenario.CreateAsync();
        var before = await scenario.CountsAsync();
        var dishWithoutBom = await scenario.Context.Dishes.AsNoTracking()
            .Where(dish => !scenario.Context.Dishboms.Any(bom => bom.DishId == dish.DishId)).Select(dish => dish.DishId).FirstAsync();

        var action = () => scenario.Service().ApplyMrxAsync(
            scenario.Request(Servings(LockedDay, 100, 0), Dish(OpenDay, dishWithoutBom)), scenario.ManagerIdString, ManagerRoles);

        var error = (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which;
        error.Code.Should().Be(MrxErrorCodes.BomMissing);
        error.StatusCode.Should().Be(422);
        (await scenario.CountsAsync()).Should().Be(before);
        await scenario.AssertSourceUnchangedAsync();
    }

    [Fact]
    public async Task Double_apply_with_same_versions_creates_one_revision()
    {
        await using var scenario = await Scenario.CreateAsync();
        var request = scenario.Request(Servings(OpenDay, 150, 0));
        await scenario.Service().ApplyMrxAsync(request, scenario.ManagerIdString, ManagerRoles);

        await using var secondContext = scenario.Fixture.CreateContext();
        var action = () => new MenuAmendmentService(secondContext).ApplyMrxAsync(request, scenario.ManagerIdString, ManagerRoles);

        (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which.Code.Should().Be(MrxErrorCodes.SourceStale);
        await using var verify = scenario.Fixture.CreateContext();
        (await verify.Reconciliationsourcerevisions.CountAsync()).Should().Be(1);
        (await verify.Menuversions.CountAsync()).Should().Be(2);
        (await verify.Menuamendments.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Completed_batch_is_rejected()
    {
        await using var scenario = await Scenario.CreateAsync();
        (await scenario.Context.Reconciliationbatches.SingleAsync()).Status = "COMPLETED";
        await scenario.Context.SaveChangesAsync();
        scenario.Context.ChangeTracker.Clear();
        var before = await scenario.CountsAsync();

        var action = () => scenario.Service().ApplyMrxAsync(scenario.Request(Servings(OpenDay, 150, 0)), scenario.ManagerIdString, ManagerRoles);

        var error = (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which;
        error.Code.Should().Be(MrxErrorCodes.BatchCompleted);
        error.StatusCode.Should().Be(409);
        (await scenario.CountsAsync()).Should().Be(before);
        await scenario.AssertSourceUnchangedAsync();
    }

    [Fact]
    public async Task Second_edit_after_issue_still_reaches_batch()
    {
        await using var scenario = await Scenario.CreateAsync();
        var first = await scenario.Service().ApplyMrxAsync(scenario.Request(Servings(OpenDay, 150, 0)), scenario.ManagerIdString, ManagerRoles);

        // P2: lần sửa thứ hai dựa trên phiên bản mới và version lô mới vẫn phải tới được lô (tìm theo căn tin × tuần).
        await using var secondContext = scenario.Fixture.CreateContext();
        var second = scenario.Request(Servings(OpenDay, 120, 10));
        second.ExpectedBaseMenuVersionId = first.AppliedMenuVersionId;
        second.ExpectedBatchVersion = 2;
        var result = await new MenuAmendmentService(secondContext).ApplyMrxAsync(second, scenario.ManagerIdString, ManagerRoles);

        result.Status.Should().Be("EXECUTED");
        await using var verify = scenario.Fixture.CreateContext();
        var openDaily = await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId);
        openDaily.RequiredQuantity.Should().Be(240m);
        openDaily.Version.Should().Be(3);
        (await verify.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(item => item.DailyLineId == scenario.LockedDaily.DailyLineId))
            .RequiredQuantity.Should().Be(200m);
        var batch = await verify.Reconciliationbatches.AsNoTracking().SingleAsync();
        batch.Version.Should().Be(3);
        batch.MenuVersionId.Should().Equal(GuidHelper.ParseGuidString(result.AppliedMenuVersionId)!);
        (await verify.Reconciliationsourcerevisions.CountAsync()).Should().Be(2);
        var openPlan = await verify.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == scenario.OpenPlanLine.QuantityPlanLineId);
        openPlan.FinalServings.Should().Be(130);
        openPlan.VegetarianServings.Should().Be(10);
    }

    [Fact]
    public async Task Approval_after_day_became_locked_sets_correction_required()
    {
        await using var scenario = await Scenario.CreateAsync();
        var submitted = await scenario.Service().SubmitMrxAsync(scenario.Request(Servings(OpenDay, 150, 0)), scenario.CoordinatorIdString);
        submitted.Status.Should().Be("PENDING_REVIEW");
        // Thủ kho xuất ngày 17 sau khi Điều phối gửi yêu cầu.
        await scenario.AddIssueAsync(OpenDay);

        await using var approverContext = scenario.Fixture.CreateContext();
        var action = () => new MenuAmendmentService(approverContext).DecideMrxAsync(
            submitted.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, scenario.ManagerIdString, ManagerRoles);

        var error = (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which;
        error.Code.Should().Be(MrxErrorCodes.DayLocked);
        error.LockedDates.Should().Equal(OpenDay);
        await using var verify = scenario.Fixture.CreateContext();
        var amendment = await verify.Menuamendments.AsNoTracking().SingleAsync();
        amendment.Status.Should().Be("CORRECTION_REQUIRED");
        amendment.ReviewedBy.Should().Equal(scenario.ManagerId);
        (await verify.Auditlogs.AsNoTracking().AnyAsync(item => item.EntityName == nameof(MenuAmendment) && item.NewValue == "CORRECTION_REQUIRED")).Should().BeTrue();
        (await verify.Reconciliationsourcerevisions.CountAsync()).Should().Be(0);
        (await verify.Menuversions.CountAsync()).Should().Be(1);
        (await verify.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == scenario.OpenPlanLine.QuantityPlanLineId))
            .SavoryServings.Should().Be(100);
    }

    [Fact]
    public async Task Preview_returns_material_impact_and_locked_dates_without_writes()
    {
        await using var scenario = await Scenario.CreateAsync();
        var before = await scenario.CountsAsync();

        var preview = await scenario.Service().PreviewMrxAsync(scenario.Request(Servings(LockedDay, 100, 0), Servings(OpenDay, 150, 0)));

        preview.Status.Should().Be("PREVIEW");
        preview.LockedDates.Should().Equal(LockedDay);
        preview.MaterialImpact.Should().ContainSingle().Which.Should().Be(
            new MrxMaterialImpactDto(OpenDay, "ING", "Ingredient", "kg", 200m, 300m));
        var line = preview.ImpactLines.Should().ContainSingle().Subject;
        line.ServiceDate.Should().Be(OpenDay);
        line.CurrentSavoryServings.Should().Be(100);
        line.CurrentVegetarianServings.Should().Be(0);
        line.NewSavoryServings.Should().Be(150);
        line.NewVegetarianServings.Should().Be(0);
        line.NewServings.Should().Be(150);
        preview.AffectedReconciliationBatchIds.Should().Equal(GuidHelper.ToGuidString(scenario.Batch.BatchId));
        (await scenario.CountsAsync()).Should().Be(before);
        await scenario.AssertSourceUnchangedAsync();
    }

    [Fact]
    public void Endpoints_use_expected_policies()
    {
        static string? Policy(string template)
        {
            var method = typeof(WeeklyMenuImportsController).GetMethods(BindingFlags.Instance | BindingFlags.Public)
                .Where(item => item.GetCustomAttributes<HttpMethodAttribute>().Any(attribute => attribute.Template == template))
                .Should().ContainSingle($"route {template} must exist exactly once").Subject;
            return method.GetCustomAttribute<AuthorizeAttribute>()?.Policy;
        }

        Policy("weekly-menu/amendments/mrx-apply").Should().Be(AuthorizationPolicies.ReconciliationSourceEditAccess);
        Policy("weekly-menu/amendments/{amendmentId}/mrx-decision").Should().Be(AuthorizationPolicies.ReconciliationSourceEditAccess);
        Policy("weekly-menu/amendments/mrx-inbox").Should().Be(AuthorizationPolicies.ReconciliationSourceEditAccess);
        Policy("weekly-menu/amendments/mrx-submit").Should().Be(AuthorizationPolicies.ReconciliationSourceReadAccess);
        typeof(WeeklyMenuImportsController).GetMethods()
            .SelectMany(item => item.GetCustomAttributes<HttpMethodAttribute>())
            .Should().NotContain(attribute => attribute.Template != null && attribute.Template.Contains("admin-confirm"));
        AuthorizationPolicies.ReconciliationSourceEditRoles.Should().BeEquivalentTo(
            ["Admin", "ADMIN", "Quản trị", "Manager", "MANAGER", "Quản lý"]);
    }

    [Fact]
    public async Task Issue_and_apply_race_has_one_winner()
    {
        await using var scenario = await Scenario.CreateAsync();
        var databasePath = Path.Combine(Path.GetTempPath(), $"mrx-issue-apply-{Guid.NewGuid():N}.db");
        try
        {
            await using (var destination = new SqliteConnection($"Data Source={databasePath}"))
            {
                await destination.OpenAsync();
                ((SqliteConnection)scenario.Context.Database.GetDbConnection()).BackupDatabase(destination);
            }

            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite($"Data Source={databasePath};Default Timeout=30")
                .Options;
            await using var issueContext = new IpcManagementContext(options);
            await using var applyContext = new IpcManagementContext(options);
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var issue = Task.Run(async () =>
            {
                await gate.Task;
                return await Record.ExceptionAsync(async () =>
                {
                    // Cùng hợp đồng với tạo phiếu xuất: kiểm tra version lô đã đọc, tăng version, ghi phiếu.
                    await using var transaction = await issueContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                    var batch = await issueContext.Reconciliationbatches.SingleAsync(item => item.BatchId == scenario.Batch.BatchId);
                    issueContext.Entry(batch).Property(item => item.Version).OriginalValue = 1;
                    batch.Version++;
                    issueContext.Inventoryissues.Add(NewIssue(scenario, OpenDay, "ISS-RACE-0617"));
                    await issueContext.SaveChangesAsync();
                    await transaction.CommitAsync();
                });
            });
            var apply = Task.Run(async () =>
            {
                await gate.Task;
                return await Record.ExceptionAsync(() => new MenuAmendmentService(applyContext).ApplyMrxAsync(
                    scenario.Request(Servings(OpenDay, 150, 0)), scenario.ManagerIdString, ManagerRoles));
            });
            gate.SetResult();
            var outcomes = await Task.WhenAll(issue, apply);

            outcomes.Count(item => item is null).Should().Be(1, "exactly one of issue and source apply may commit");
            await using var verify = new IpcManagementContext(options);
            var issued = await verify.Inventoryissues.AnyAsync(item => item.IssueDate == OpenDay);
            var revisions = await verify.Reconciliationsourcerevisions.CountAsync();
            if (outcomes[1] is null)
            {
                issued.Should().BeFalse();
                revisions.Should().Be(1);
                (await verify.Reconciliationbatchdailylines.SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId)).RequiredQuantity.Should().Be(300m);
            }
            else
            {
                outcomes[1].Should().BeOfType<MrxSourceChangeException>()
                    .Which.Code.Should().BeOneOf(MrxErrorCodes.DayLocked, MrxErrorCodes.SourceStale);
                issued.Should().BeTrue();
                revisions.Should().Be(0);
                (await verify.Menuversions.CountAsync()).Should().Be(1);
                (await verify.Reconciliationbatchdailylines.SingleAsync(item => item.DailyLineId == scenario.OpenDaily.DailyLineId)).RequiredQuantity.Should().Be(200m);
            }
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
    }

    private static CreateMenuAmendmentLineRequest Servings(DateOnly date, int savory, int vegetarian) => new()
    {
        ServiceDate = date, ShiftName = "MORNING", DishSlot = "savory-main",
        NewSavoryServings = savory, NewVegetarianServings = vegetarian
    };

    private static CreateMenuAmendmentLineRequest Dish(DateOnly date, byte[] dishId) => new()
    {
        ServiceDate = date, ShiftName = "MORNING", DishSlot = "savory-main", NewDishId = GuidHelper.ToGuidString(dishId)
    };

    private static InventoryIssue NewIssue(Scenario scenario, DateOnly date, string code) => new()
    {
        IssueId = GuidHelper.NewId(), IssueCode = code, IssueDate = date, WarehouseId = scenario.Fixture.WarehouseId,
        ReconciliationBatchId = scenario.Batch.BatchId, IssuedBy = scenario.Fixture.UserId, CreatedAt = DateTime.UtcNow
    };

    private sealed record Counts(int MenuVersions, int Amendments, int Revisions, int Deltas, int Audits, int Adjustments, int Menus, long BatchVersion);

    private sealed class Scenario : IAsyncDisposable
    {
        public const string Reason = "Khách hàng báo tăng suất thứ tư.";

        public required WorkflowGenerationTests.WorkflowFixture Fixture { get; init; }
        public required IpcManagementContext Context { get; init; }
        public required ReconciliationBatch Batch { get; init; }
        public required ReconciliationBatchDailyLine LockedDaily { get; init; }
        public required ReconciliationBatchDailyLine OpenDaily { get; init; }
        public required MenuVersion BaseVersion { get; init; }
        public required MealQuantityPlanLine LockedPlanLine { get; init; }
        public required MealQuantityPlanLine OpenPlanLine { get; init; }
        public required byte[] OpenMenuId { get; init; }
        public required byte[] ManagerId { get; init; }
        public required byte[] CoordinatorId { get; init; }
        public string ManagerIdString => GuidHelper.ToGuidString(ManagerId);
        public string CoordinatorIdString => GuidHelper.ToGuidString(CoordinatorId);

        public MenuAmendmentService Service() => new(Context);

        public CreateMenuAmendmentRequest Request(params CreateMenuAmendmentLineRequest[] lines) => new()
        {
            CustomerId = Fixture.CustomerIdString, WeekStartDate = LockedDay,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(BaseVersion.MenuVersionId),
            ExpectedBatchVersion = 1, Reason = Reason, Lines = [.. lines]
        };

        public async Task<Counts> CountsAsync()
        {
            await using var verify = Fixture.CreateContext();
            return new Counts(
                await verify.Menuversions.CountAsync(), await verify.Menuamendments.CountAsync(),
                await verify.Reconciliationsourcerevisions.CountAsync(), await verify.Reconciliationsourcedeltas.CountAsync(),
                await verify.Auditlogs.CountAsync(), await verify.Quantityadjustments.CountAsync(), await verify.Menus.CountAsync(),
                (await verify.Reconciliationbatches.AsNoTracking().SingleAsync()).Version);
        }

        public async Task AssertSourceUnchangedAsync()
        {
            await using var verify = Fixture.CreateContext();
            var openPlan = await verify.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == OpenPlanLine.QuantityPlanLineId);
            openPlan.SavoryServings.Should().Be(100);
            openPlan.FinalServings.Should().Be(100);
            openPlan.MenuId.Should().Equal(OpenMenuId);
            (await verify.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == LockedPlanLine.QuantityPlanLineId))
                .SavoryServings.Should().Be(100);
            (await verify.Menuschedules.AsNoTracking().Where(item => item.MenuVersionId != BaseVersion.MenuVersionId).CountAsync()).Should().Be(0);
            foreach (var daily in await verify.Reconciliationbatchdailylines.AsNoTracking().ToListAsync())
            {
                daily.RequiredQuantity.Should().Be(200m);
                daily.Version.Should().Be(1);
            }
        }

        public async Task AddIssueAsync(DateOnly date)
        {
            await using var issueContext = Fixture.CreateContext();
            issueContext.Inventoryissues.Add(NewIssue(this, date, $"ISS-{date:MMdd}-LATE"));
            var batch = await issueContext.Reconciliationbatches.SingleAsync(item => item.BatchId == Batch.BatchId);
            batch.Version++;
            await issueContext.SaveChangesAsync();
        }

        public static async Task<Scenario> CreateAsync()
        {
            var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
            await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
            var context = fixture.CreateContext();
            await WorkflowGenerationTests.EnsureMrxRevisionSchemaAsync(context);

            var lockedSchedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
                .SingleAsync(item => item.ServiceDate == LockedDay);
            var lockedMenuItem = lockedSchedule.Menu.Menuitems.Single();
            lockedMenuItem.DishSlot = "savory-main";
            var lockedPlanLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == lockedSchedule.MenuScheduleId);
            var batchImportId = GuidHelper.NewId();
            (await context.Mealquantityplans.SingleAsync(item => item.QuantityPlanId == lockedPlanLine.QuantityPlanId)).ImportBatchId = batchImportId;
            lockedPlanLine.SavoryServings = 100;
            lockedPlanLine.VegetarianServings = 0;
            var dish = lockedMenuItem.Dish;
            var bom = await context.Dishboms.Include(item => item.Ingredient).SingleAsync(item => item.DishId == dish.DishId);

            var baseVersion = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(), CustomerId = lockedSchedule.CustomerId, WeekStartDate = LockedDay,
                VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            };
            context.Menuversions.Add(baseVersion);
            lockedSchedule.MenuVersionId = baseVersion.MenuVersionId;

            var openMenu = new Menu { MenuId = GuidHelper.NewId(), MenuCode = "MENU-WED", MenuName = "Menu thứ tư", IsActive = true };
            var openSchedule = new MenuSchedule
            {
                MenuScheduleId = GuidHelper.NewId(), CustomerId = lockedSchedule.CustomerId, MenuId = openMenu.MenuId,
                ServiceDate = OpenDay, WeekStartDate = LockedDay, ShiftName = "MORNING", MenuPrice = lockedSchedule.MenuPrice,
                BomRatePercent = 100, Status = "ACTIVE", MenuVersionId = baseVersion.MenuVersionId
            };
            var openPlan = new MealQuantityPlan
            {
                QuantityPlanId = GuidHelper.NewId(), ImportBatchId = batchImportId, PlanCode = "QTY-20260617", ServiceDate = OpenDay,
                Status = "COMPLETED", ConfirmationTime = new TimeOnly(9, 0), ConfirmedBy = fixture.UserId
            };
            var openPlanLine = new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = openPlan.QuantityPlanId, MenuScheduleId = openSchedule.MenuScheduleId,
                CustomerId = lockedSchedule.CustomerId, MenuId = openMenu.MenuId, ShiftName = "MORNING",
                ForecastServings = 100, ConfirmedServings = 100, FinalServings = 100, SavoryServings = 100, VegetarianServings = 0
            };
            context.Menus.Add(openMenu);
            context.Menuitems.Add(new MenuItem { MenuItemId = GuidHelper.NewId(), MenuId = openMenu.MenuId, DishId = dish.DishId, DisplayOrder = 1, DishSlot = "savory-main" });
            context.Menuschedules.Add(openSchedule);
            context.Mealquantityplans.Add(openPlan);
            context.Mealquantityplanlines.Add(openPlanLine);

            var batch = new ReconciliationBatch
            {
                BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = batchImportId,
                Status = "IN_PROGRESS", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
            };
            var batchLine = new ReconciliationBatchLine
            {
                BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, IngredientId = bom.IngredientId,
                CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = 400m, FrozenTolerance = 0.5m,
                ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1, Batch = batch
            };
            batch.Lines.Add(batchLine);
            ReconciliationBatchDailyLine Daily(DateOnly date, MenuSchedule schedule, MealQuantityPlanLine planLine)
            {
                var daily = new ReconciliationBatchDailyLine
                {
                    DailyLineId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, BatchId = batch.BatchId,
                    IngredientId = batchLine.IngredientId, CanonicalUnitId = batchLine.CanonicalUnitId,
                    ServiceDate = date, RequiredQuantity = 200m, Version = 1, BatchLine = batchLine
                };
                batchLine.DailyLines.Add(daily);
                batchLine.Contributors.Add(new ReconciliationBatchContributor
                {
                    ContributorId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, DailyLineId = daily.DailyLineId,
                    MenuScheduleId = schedule.MenuScheduleId, MealQuantityPlanLineId = planLine.QuantityPlanLineId,
                    DishBomId = bom.BomId, DishId = dish.DishId, FrozenShiftName = "MORNING", FrozenDishCode = dish.DishCode,
                    FrozenDishName = dish.DishName, FrozenMenuVariant = "savory", FrozenServings = 100,
                    FrozenBomQuantityPerServing = bom.GrossQtyPerServing, FrozenWasteRatePercent = bom.WasteRatePercent, SourceQuantity = 200m
                });
                return daily;
            }
            var lockedDaily = Daily(LockedDay, lockedSchedule, lockedPlanLine);
            var openDaily = Daily(OpenDay, openSchedule, openPlanLine);
            context.Reconciliationbatches.Add(batch);
            context.Reconciliationtolerances.Add(new ReconciliationTolerance
            {
                ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
                CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
            });

            var managerRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "MANAGER", RoleName = "Quản lý" };
            var coordinatorRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "COORDINATOR", RoleName = "Điều phối" };
            var manager = new User { UserId = GuidHelper.NewId(), Username = "mrx-manager", FullName = "Quản lý MRX", PasswordHash = "hash", RoleId = managerRole.RoleId, IsActive = true, CreatedAt = DateTime.UtcNow };
            var coordinator = new User { UserId = GuidHelper.NewId(), Username = "mrx-coordinator", FullName = "Điều phối MRX", PasswordHash = "hash", RoleId = coordinatorRole.RoleId, IsActive = true, CreatedAt = DateTime.UtcNow };
            context.Roles.AddRange(managerRole, coordinatorRole);
            context.Users.AddRange(manager, coordinator);
            await context.SaveChangesAsync();

            var scenario = new Scenario
            {
                Fixture = fixture, Context = context, Batch = batch, LockedDaily = lockedDaily, OpenDaily = openDaily,
                BaseVersion = baseVersion, LockedPlanLine = lockedPlanLine, OpenPlanLine = openPlanLine, OpenMenuId = openMenu.MenuId,
                ManagerId = manager.UserId, CoordinatorId = coordinator.UserId
            };
            context.Inventoryissues.Add(NewIssue(scenario, LockedDay, "ISS-MRX-0615"));
            await context.SaveChangesAsync();
            context.ChangeTracker.Clear();
            return scenario;
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await Fixture.DisposeAsync();
        }
    }
}
