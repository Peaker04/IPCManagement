using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Features.Planning.Controllers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace IPCManagement.Api.Tests;

public sealed class ServiceRunsControllerContractTests
{
    [Fact]
    public void Controller_Should_KeepPublishedRoutesAndPoliciesAcrossPartialFiles()
    {
        var controllerType = typeof(ServiceRunsController);

        controllerType.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/service-runs");
        controllerType.GetCustomAttributes<AuthorizeAttribute>()
            .Where(attribute => attribute.Policy is null)
            .Should().ContainSingle();

        var actions = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
            .Select(method => new
            {
                Method = method,
                Http = method.GetCustomAttribute<HttpMethodAttribute>()
            })
            .Where(action => action.Http is not null)
            .Select(action => new ActionContract(
                action.Method.Name,
                action.Http!.HttpMethods.Single(),
                action.Http.Template ?? string.Empty,
                action.Method.GetCustomAttributes<AuthorizeAttribute>()
                    .Select(attribute => attribute.Policy!)
                    .Order(StringComparer.Ordinal)
                    .ToArray()))
            .OrderBy(action => action.Name, StringComparer.Ordinal)
            .ToArray();

        actions.Should().BeEquivalentTo(ExpectedActions, options => options.WithStrictOrdering());
    }

    private static readonly string[] ProductionPolicy = [AuthorizationPolicies.ProductionAccess];

    private static readonly string[] CoordinationPolicies =
    [
        AuthorizationPolicies.CoordinationAccess,
        AuthorizationPolicies.ProductionAccess
    ];

    private static readonly string[] AdminPolicy = [AuthorizationPolicies.AdminAccess];

    private static readonly ActionContract[] ExpectedActions =
    [
        new(nameof(ServiceRunsController.ApproveVarianceWaiverAsync), "POST", "{id}/variance/declarations/{declarationId}/waive", AdminPolicy),
        new(nameof(ServiceRunsController.CloseAsync), "POST", "{id}/close", CoordinationPolicies),
        new(nameof(ServiceRunsController.ConfirmServiceAsync), "POST", "{id}/service-confirmation", ProductionPolicy),
        new(nameof(ServiceRunsController.CreateAdjustmentAsync), "POST", "{id}/adjustments", CoordinationPolicies),
        new(nameof(ServiceRunsController.DeclareVarianceAsync), "POST", "{id}/variance/declarations", ProductionPolicy),
        new(nameof(ServiceRunsController.GetAdjustmentsAsync), "GET", "{id}/adjustments", ProductionPolicy),
        new(nameof(ServiceRunsController.GetAsync), "GET", "{id}", ProductionPolicy),
        new(nameof(ServiceRunsController.GetByPlanAsync), "GET", "by-plan", ProductionPolicy),
        new(nameof(ServiceRunsController.GetPageAsync), "GET", "page", [AuthorizationPolicies.PurchaseOrderReadAccess]),
        new(nameof(ServiceRunsController.OpenAsync), "POST", string.Empty, ProductionPolicy),
        new(nameof(ServiceRunsController.RecordActualServingsAsync), "POST", "{id}/actual-servings", ProductionPolicy),
        new(nameof(ServiceRunsController.ResolveServingVarianceAsync), "POST", "{id}/serving-variance/resolve", CoordinationPolicies),
        new(nameof(ServiceRunsController.ResolveVarianceAsync), "POST", "{id}/variance/resolve", CoordinationPolicies),
        new(nameof(ServiceRunsController.StartAsync), "POST", "{id}/start", ProductionPolicy),
        new(nameof(ServiceRunsController.WaiveServiceConfirmationAsync), "POST", "{id}/service-confirmation/waive", CoordinationPolicies)
    ];

    private sealed record ActionContract(string Name, string HttpMethod, string Route, string[] Policies);
}
