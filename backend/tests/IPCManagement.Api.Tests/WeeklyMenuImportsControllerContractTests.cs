using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Tests;

public sealed class WeeklyMenuImportsControllerContractTests
{
    [Fact]
    public void Controller_Should_KeepPublishedRoutesAndAuthorizationAcrossPartialFiles()
    {
        var controllerType = typeof(WeeklyMenuImportsController);

        controllerType.GetCustomAttribute<ApiControllerAttribute>().Should().NotBeNull();
        controllerType.GetCustomAttribute<RouteAttribute>()!.Template.Should().Be("api/coordination");
        controllerType.GetCustomAttribute<TagsAttribute>()!.Tags.Should().Equal("Coordination");
        controllerType.GetCustomAttributes<AuthorizeAttribute>()
            .Select(attribute => new AuthorizationContract(attribute.Policy, attribute.Roles))
            .Should().Equal(new AuthorizationContract(AuthorizationPolicies.CoordinationAccess, null));
        controllerType.GetCustomAttribute<EnableRateLimitingAttribute>()!.PolicyName.Should().Be("api-general");

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
                    .Select(attribute => new AuthorizationContract(attribute.Policy, attribute.Roles))
                    .OrderBy(attribute => attribute.Policy, StringComparer.Ordinal)
                    .ThenBy(attribute => attribute.Roles, StringComparer.Ordinal)
                    .ToArray()))
            .OrderBy(action => action.Name, StringComparer.Ordinal)
            .ToArray();

        actions.Should().BeEquivalentTo(ExpectedActions, options => options.WithStrictOrdering());
    }

    [Theory]
    [InlineData(nameof(WeeklyMenuImportsController.ImportWeeklyMenuAsync))]
    [InlineData(nameof(WeeklyMenuImportsController.PreviewWeeklyMenuImportAsync))]
    [InlineData(nameof(WeeklyMenuImportsController.CommitWeeklyMenuImportAsync))]
    public void UploadActions_Should_KeepMultipartAndSharedSizeLimit(string methodName)
    {
        var method = typeof(WeeklyMenuImportsController).GetMethod(methodName)!;

        method.GetCustomAttribute<ConsumesAttribute>()!
            .ContentTypes.Should().ContainSingle("multipart/form-data");
        method.GetCustomAttributes<RequestSizeLimitAttribute>()
            .Cast<IRequestSizeLimitMetadata>()
            .Single()
            .MaxRequestBodySize.Should().Be(XlsxSecurityLimits.MaxUploadBytes);
    }

    private static readonly AuthorizationContract[] AdminPolicy =
    [
        new(AuthorizationPolicies.AdminAccess, null)
    ];

    private static readonly AuthorizationContract[] AdminRoles =
    [
        new(null, "Admin,ADMIN,Quản trị")
    ];

    private static readonly AuthorizationContract[] ManagerRoles =
    [
        new(null, "Manager,MANAGER,Quản lý")
    ];

    private static readonly ActionContract[] ExpectedActions =
    [
        new(nameof(WeeklyMenuImportsController.BreakGlassExecuteMenuAmendmentAsync), "POST", "weekly-menu/amendments/{amendmentId}/break-glass-execute", AdminPolicy),
        new(nameof(WeeklyMenuImportsController.BulkUpdateWeeklyMenuAsync), "PUT", "weekly-menu/bulk-update", []),
        new(nameof(WeeklyMenuImportsController.CommitWeeklyMenuImportAsync), "POST", "weekly-menu/import/commit", []),
        new(nameof(WeeklyMenuImportsController.CreateMenuAmendmentAsync), "POST", "weekly-menu/amendments", []),
        new(nameof(WeeklyMenuImportsController.DownloadWeeklyMenuTemplateAsync), "GET", "weekly-menu/template", []),
        new(nameof(WeeklyMenuImportsController.ExecuteMenuAmendmentAsync), "POST", "weekly-menu/amendments/{amendmentId}/execute", AdminRoles),
        new(nameof(WeeklyMenuImportsController.GetCustomerImportMappingAsync), "GET", "customers/{customerId}/import-mapping", []),
        new(nameof(WeeklyMenuImportsController.GetCustomersAsync), "GET", "customers", []),
        new(nameof(WeeklyMenuImportsController.GetMenuAmendmentsAsync), "GET", "weekly-menu/amendments", []),
        new(nameof(WeeklyMenuImportsController.GetWeeklyMenuAsync), "GET", "weekly-menu", []),
        new(nameof(WeeklyMenuImportsController.GetWeeklyMenuImportHistoryAsync), "GET", "weekly-menu/import-history", []),
        new(nameof(WeeklyMenuImportsController.ImportWeeklyMenuAsync), "POST", "weekly-menu/import", []),
        new(nameof(WeeklyMenuImportsController.PreviewWeeklyMenuImportAsync), "POST", "weekly-menu/import/preview", []),
        new(nameof(WeeklyMenuImportsController.ReviewMenuAmendmentAsync), "POST", "weekly-menu/amendments/{amendmentId}/review", ManagerRoles),
        new(nameof(WeeklyMenuImportsController.RollbackWeeklyMenuImportAsync), "POST", "weekly-menu/import/{menuVersionId}/rollback", []),
        new(nameof(WeeklyMenuImportsController.SaveCustomerImportMappingAsync), "PUT", "customers/{customerId}/import-mapping", [])
    ];

    private sealed record AuthorizationContract(string? Policy, string? Roles);

    private sealed record ActionContract(
        string Name,
        string HttpMethod,
        string Route,
        AuthorizationContract[] Authorization);
}
