using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class UnitCatalogTests
{
    [Fact]
    public async Task GetAllAsync_Should_ReturnPersistedUnitsOrderedByCode()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"unit-catalog-{Guid.NewGuid()}")
            .Options;
        await using var context = new IpcManagementContext(options);
        var gramId = GuidHelper.NewId();
        var kilogramId = GuidHelper.NewId();
        context.Units.AddRange(
            new Unit
            {
                UnitId = kilogramId,
                UnitCode = "KG",
                UnitName = "Kilogram",
                ConvertRateToBase = 1m
            },
            new Unit
            {
                UnitId = gramId,
                UnitCode = "G",
                UnitName = "Gram",
                BaseUnitCode = "KG",
                ConvertRateToBase = 0.001m
            });
        await context.SaveChangesAsync();

        var controller = new UnitsController(new UnitService(context));

        var response = await controller.GetAllAsync(CancellationToken.None);

        var ok = response.Should().BeOfType<OkObjectResult>().Subject;
        var payload = ok.Value.Should()
            .BeOfType<ApiResponse<IReadOnlyList<UnitDto>>>().Subject;
        payload.Data.Should().BeEquivalentTo(
            [
                new UnitDto(
                    GuidHelper.ToGuidString(gramId),
                    "G",
                    "Gram",
                    "KG",
                    0.001m),
                new UnitDto(
                    GuidHelper.ToGuidString(kilogramId),
                    "KG",
                    "Kilogram",
                    null,
                    1m)
            ],
            options => options.WithStrictOrdering());
    }

    [Fact]
    public void GetAllAsync_Should_ExposeReadOnlyCatalogContract()
    {
        typeof(UnitsController).GetCustomAttributes(typeof(RouteAttribute), true)
            .Cast<RouteAttribute>()
            .Single()
            .Template.Should().Be("api/[controller]");
        typeof(UnitsController).GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single()
            .Policy.Should().Be(AuthorizationPolicies.CatalogReadAccess);
        typeof(UnitsController).GetCustomAttributes(typeof(EnableRateLimitingAttribute), true)
            .Cast<EnableRateLimitingAttribute>()
            .Single()
            .PolicyName.Should().Be("api-general");

        var method = typeof(UnitsController).GetMethod(nameof(UnitsController.GetAllAsync))!;
        method.GetCustomAttributes(typeof(HttpGetAttribute), true)
            .Cast<HttpGetAttribute>()
            .Should().ContainSingle();
        method.GetCustomAttributes(typeof(ProducesResponseTypeAttribute), true)
            .Cast<ProducesResponseTypeAttribute>()
            .Should().ContainSingle(attribute =>
                attribute.StatusCode == StatusCodes.Status200OK &&
                attribute.Type == typeof(ApiResponse<IReadOnlyList<UnitDto>>));
    }
}
