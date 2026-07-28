using FluentAssertions;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.Metadata;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Tests;

public class CatalogControllerContractTests
{
    private static readonly IReadOnlyList<RouteContract> ExpectedRoutes =
    [
        new("GET", "api/Dishes/catalog", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/bom-coverage", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/bom-validation", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/import-history", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/sample-import-status", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/bom-template", AuthorizationPolicies.CatalogReadAccess),
        new("POST", "api/Dishes/bom-import/preview", AuthorizationPolicies.CatalogAccess),
        new("POST", "api/Dishes/bom-import/commit", AuthorizationPolicies.CatalogAccess),
        new("GET", "api/Dishes", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/{id}", AuthorizationPolicies.CatalogReadAccess),
        new("GET", "api/Dishes/{id}/bom", AuthorizationPolicies.CatalogReadAccess),
        new("POST", "api/Dishes", AuthorizationPolicies.CatalogAccess),
        new("PUT", "api/Dishes/{id}", AuthorizationPolicies.CatalogAccess),
        new("POST", "api/Dishes/{id}/bom", AuthorizationPolicies.CatalogAccess),
        new("PUT", "api/Dishes/{id}/bom/{bomId}", AuthorizationPolicies.CatalogAccess),
        new("DELETE", "api/Dishes/{id}/bom/{bomId}", AuthorizationPolicies.CatalogAccess),
        new("DELETE", "api/Dishes/{id}", AuthorizationPolicies.CatalogAccess)
    ];

    [Fact]
    public void CatalogRoutes_Should_PreserveVerbTemplateAuthorizationAndResponseMetadata()
    {
        var actual = CatalogControllerTypes()
            .SelectMany(type => type.GetMethods()
                .SelectMany(method => method.GetCustomAttributes(typeof(HttpMethodAttribute), true)
                    .Cast<HttpMethodAttribute>()
                    .SelectMany(attribute => attribute.HttpMethods.Select(verb => new
                    {
                        Contract = new RouteContract(
                            verb,
                            BuildRoute(type, attribute.Template),
                            method.GetCustomAttributes(typeof(AuthorizeAttribute), true)
                                .Cast<AuthorizeAttribute>()
                                .Single()
                                .Policy!),
                        ControllerType = type,
                        Method = method
                    }))))
            .ToList();

        actual.Select(item => item.Contract)
            .Should().BeEquivalentTo(ExpectedRoutes);
        actual.Should().OnlyContain(item =>
            item.ControllerType.GetCustomAttributes(typeof(AuthorizeAttribute), true).Any() &&
            item.ControllerType.GetCustomAttributes(typeof(EnableRateLimitingAttribute), true)
                .Cast<EnableRateLimitingAttribute>()
                .Single()
                .PolicyName == "api-general" &&
            item.Method.GetCustomAttributes(typeof(ProducesResponseTypeAttribute), true).Any());
    }

    [Theory]
    [InlineData("PreviewBomImportAsync")]
    [InlineData("CommitBomImportAsync")]
    public void BomUploadRoutes_Should_PreserveMultipartAndTenMegabyteLimit(string methodName)
    {
        var method = CatalogControllerTypes()
            .Select(type => type.GetMethod(methodName))
            .Single(candidate => candidate is not null)!;

        method.GetCustomAttributes(typeof(ConsumesAttribute), true)
            .Cast<ConsumesAttribute>()
            .Single()
            .ContentTypes.Should().ContainSingle("multipart/form-data");
        method.GetCustomAttributes(typeof(RequestSizeLimitAttribute), true)
            .Cast<IRequestSizeLimitMetadata>()
            .Single()
            .MaxRequestBodySize.Should().Be(XlsxSecurityLimits.MaxUploadBytes);
    }

    private static IReadOnlyList<Type> CatalogControllerTypes()
        => typeof(DishesController).Assembly.GetTypes()
            .Where(type =>
                type.IsSubclassOf(typeof(ControllerBase)) &&
                type.Namespace == typeof(DishesController).Namespace &&
                string.Equals(ControllerPrefix(type), "api/Dishes", StringComparison.Ordinal))
            .OrderBy(type => type.Name, StringComparer.Ordinal)
            .ToList();

    private static string BuildRoute(Type controllerType, string? actionTemplate)
    {
        var prefix = ControllerPrefix(controllerType);
        return string.IsNullOrWhiteSpace(actionTemplate)
            ? prefix
            : $"{prefix.TrimEnd('/')}/{actionTemplate.TrimStart('/')}";
    }

    private static string ControllerPrefix(Type controllerType)
    {
        var controllerTemplate = controllerType
            .GetCustomAttributes(typeof(RouteAttribute), true)
            .Cast<RouteAttribute>()
            .Single()
            .Template;
        var controllerName = controllerType.Name.EndsWith("Controller", StringComparison.Ordinal)
            ? controllerType.Name[..^"Controller".Length]
            : controllerType.Name;
        return controllerTemplate.Replace("[controller]", controllerName, StringComparison.Ordinal);
    }

    private sealed record RouteContract(string Verb, string Route, string Policy);
}
