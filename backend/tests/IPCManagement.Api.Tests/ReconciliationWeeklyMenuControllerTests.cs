using System.Reflection;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationWeeklyMenuControllerTests
{
    [Fact]
    public void Reconciliation_read_is_retained_and_legacy_coordination_read_is_explicitly_excluded()
    {
        var retained = typeof(ReconciliationWeeklyMenuController)
            .GetCustomAttribute<SystemOperationAttribute>();
        Assert.NotNull(retained);
        Assert.Equal(OperationDisposition.Retained, retained.Disposition);
        Assert.True(SystemOperationEligibility.IsAllowed(
            SystemOperationEligibility.MaterialReconciliation,
            retained.Disposition));

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
        var controller = new ReconciliationWeeklyMenuController(queryService);

        var action = await controller.GetAsync("customer-1", "2026-08-24", CancellationToken.None);

        Assert.IsType<OkObjectResult>(action);
        await queryService.Received(1).GetCommittedWeeklyMenuAsync(
            "customer-1",
            new DateOnly(2026, 8, 24),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Get_rejects_invalid_week_instead_of_silently_loading_latest_menu()
    {
        var queryService = Substitute.For<IWeeklyMenuQueryService>();
        var controller = new ReconciliationWeeklyMenuController(queryService);

        var action = await controller.GetAsync("customer-1", "not-a-date", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(action);
        await queryService.DidNotReceiveWithAnyArgs()
            .GetCommittedWeeklyMenuAsync(default!, default, default);
    }
}
