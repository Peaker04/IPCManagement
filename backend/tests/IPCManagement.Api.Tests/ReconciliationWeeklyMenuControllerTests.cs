using System.Reflection;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationWeeklyMenuControllerTests
{
    [Fact]
    public void Reconciliation_read_is_mrx_only_and_legacy_coordination_read_is_explicitly_excluded()
    {
        var reconciliationOnly = typeof(ReconciliationWeeklyMenuController)
            .GetCustomAttribute<SystemOperationAttribute>();
        Assert.NotNull(reconciliationOnly);
        Assert.Equal(OperationDisposition.ReconciliationOnly, reconciliationOnly.Disposition);
        Assert.True(SystemOperationEligibility.IsAllowed(
            SystemOperationEligibility.MaterialReconciliation,
            reconciliationOnly.Disposition));
        Assert.False(SystemOperationEligibility.IsAllowed(
            SystemOperationEligibility.Default,
            reconciliationOnly.Disposition));

        var legacyMethod = typeof(WeeklyMenuImportsController)
            .GetMethod(nameof(WeeklyMenuImportsController.GetWeeklyMenuAsync));
        var excluded = legacyMethod!.GetCustomAttribute<SystemOperationAttribute>();
        Assert.NotNull(excluded);
        Assert.Equal(OperationDisposition.ExcludedInMaterialReconciliation, excluded.Disposition);
        Assert.False(SystemOperationEligibility.IsAllowed(
            SystemOperationEligibility.MaterialReconciliation,
            excluded.Disposition));
    }

    [Fact]
    public void Reconciliation_read_keeps_coordination_authorization_policy()
    {
        var authorize = typeof(ReconciliationWeeklyMenuController)
            .GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal(AuthorizationPolicies.CoordinationAccess, authorize.Policy);
    }

    [Fact]
    public async Task Get_forwards_customer_and_week_to_the_canonical_query_service()
    {
        var queryService = Substitute.For<IWeeklyMenuQueryService>();
        queryService
            .GetCommittedWeeklyMenuAsync("customer-1", new DateOnly(2026, 8, 24), Arg.Any<CancellationToken>())
            .Returns((IPCManagement.Api.Features.SampleData.Contracts.WeeklyMenuImportResultDto?)null);
        await using var context = CreateContext();
        var controller = new ReconciliationWeeklyMenuController(queryService, new MrxEditScopeQuery(context));

        var action = await controller.GetAsync("customer-1", "2026-08-24", CancellationToken.None);

        Assert.IsType<OkObjectResult>(action);
        await queryService.Received(1).GetCommittedWeeklyMenuAsync(
            "customer-1",
            new DateOnly(2026, 8, 24),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Edit_scope_marks_issued_day_locked_and_returns_split_servings()
    {
        await using var scenario = await MrxSourceChangeApplierTests.Scenario.CreateAsync();
        var controller = new ReconciliationWeeklyMenuController(
            Substitute.For<IWeeklyMenuQueryService>(),
            new MrxEditScopeQuery(scenario.Context));

        var action = await controller.GetEditScopeAsync(
            scenario.Fixture.CustomerIdString,
            MrxSourceChangeApplierTests.LockedDay.ToString("yyyy-MM-dd"),
            CancellationToken.None);

        var response = Assert.IsType<ApiResponse<MrxEditScopeDto>>(
            Assert.IsType<OkObjectResult>(action).Value);
        var scope = Assert.IsType<MrxEditScopeDto>(response.Data);
        Assert.Equal(GuidHelper.ToGuidString(scenario.Batch.BatchId), scope.BatchId);
        Assert.Equal("IN_PROGRESS", scope.BatchStatus);
        Assert.Equal(1, scope.BatchVersion);
        var locked = Assert.Single(scope.Days, day => day.ServiceDate == MrxSourceChangeApplierTests.LockedDay);
        Assert.True(locked.IsLocked);
        Assert.Equal("Đã xuất kho", locked.LockReason);
        var open = Assert.Single(scope.Days, day => day.ServiceDate == MrxSourceChangeApplierTests.OpenDay);
        Assert.False(open.IsLocked);
        var shift = Assert.Single(open.Shifts);
        Assert.Equal(100, shift.SavoryServings);
        Assert.Equal(0, shift.VegetarianServings);
        var slot = Assert.Single(shift.Slots);
        Assert.Equal("savory-main", slot.DishSlot);
        Assert.Equal("savory", slot.MenuVariant);
        Assert.Equal("Món chính", slot.SlotLabel);
        Assert.NotNull(slot.DishId);
        Assert.NotEmpty(slot.DishCode!);
        Assert.NotEmpty(slot.DishName!);
    }

    [Fact]
    public async Task Edit_scope_completed_batch_locks_all_days()
    {
        await using var scenario = await MrxSourceChangeApplierTests.Scenario.CreateAsync();
        var batch = await scenario.Context.Reconciliationbatches.SingleAsync();
        batch.Status = "COMPLETED";
        await scenario.Context.SaveChangesAsync();
        var controller = new ReconciliationWeeklyMenuController(
            Substitute.For<IWeeklyMenuQueryService>(),
            new MrxEditScopeQuery(scenario.Context));

        var action = await controller.GetEditScopeAsync(
            scenario.Fixture.CustomerIdString,
            MrxSourceChangeApplierTests.LockedDay.ToString("yyyy-MM-dd"),
            CancellationToken.None);

        var scope = Assert.IsType<ApiResponse<MrxEditScopeDto>>(
            Assert.IsType<OkObjectResult>(action).Value).Data!;
        Assert.NotEmpty(scope.Days);
        Assert.All(scope.Days, day =>
        {
            Assert.True(day.IsLocked);
            Assert.Equal("Lô đã hoàn tất", day.LockReason);
        });
    }

    [Fact]
    public async Task Get_rejects_invalid_week_instead_of_silently_loading_latest_menu()
    {
        var queryService = Substitute.For<IWeeklyMenuQueryService>();
        await using var context = CreateContext();
        var controller = new ReconciliationWeeklyMenuController(queryService, new MrxEditScopeQuery(context));

        var action = await controller.GetAsync("customer-1", "not-a-date", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(action);
        await queryService.DidNotReceiveWithAnyArgs()
            .GetCommittedWeeklyMenuAsync(default!, default, default);
    }

    private static IpcManagementContext CreateContext()
        => new(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"weekly-menu-controller-{Guid.NewGuid():N}")
            .Options);
}
