using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Warehouse;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class WarehousesAuthorizationIntegrationTests
{
    [Fact]
    public async Task Selector_Should_AllowPurchasingRole_AndReturnEveryWarehousePage()
    {
        var warehouses = Enumerable.Range(1, 205)
            .Select(index => new WarehouseDto
            {
                WarehouseId = $"warehouse-{index}",
                WarehouseCode = $"WH-{index:000}",
                WarehouseName = $"Kho {index}"
            })
            .ToArray();
        var service = BuildPagedWarehouseService(warehouses);
        await using var app = await CreateAppAsync(service);
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, "Purchasing");

        var response = await client.GetAsync("/api/warehouses/selector");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<List<WarehouseDto>>>();
        payload!.Data.Should().HaveCount(205);
        payload.Data.Select(item => item.WarehouseId).Should().Contain("warehouse-205");
        await service.Received(3).GetPagedAsync(Arg.Any<PagedRequestDto>());
    }

    [Fact]
    public async Task Selector_Should_AllowPurchasingRole_WhenWarehouseCatalogIsEmpty()
    {
        var service = BuildPagedWarehouseService([]);
        await using var app = await CreateAppAsync(service);
        using var client = app.GetTestClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, "PurchaseStaff");

        var response = await client.GetAsync("/api/warehouses/selector");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payload = await response.Content.ReadFromJsonAsync<ApiResponse<List<WarehouseDto>>>();
        payload!.Data.Should().BeEmpty();
        await service.Received(1).GetPagedAsync(Arg.Any<PagedRequestDto>());
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Chef", HttpStatusCode.Forbidden)]
    public async Task Selector_Should_RejectCallersWithoutCatalogReadAccess(
        string? role,
        HttpStatusCode expectedStatus)
    {
        var service = BuildPagedWarehouseService([]);
        await using var app = await CreateAppAsync(service);
        using var client = app.GetTestClient();
        if (role is not null)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RoleHeader, role);
        }

        var response = await client.GetAsync("/api/warehouses/selector");

        response.StatusCode.Should().Be(expectedStatus);
        await service.DidNotReceive().GetPagedAsync(Arg.Any<PagedRequestDto>());
    }

    private static IWarehouseService BuildPagedWarehouseService(IReadOnlyList<WarehouseDto> warehouses)
    {
        var service = Substitute.For<IWarehouseService>();
        service.GetPagedAsync(Arg.Any<PagedRequestDto>()).Returns(callInfo =>
        {
            var request = callInfo.Arg<PagedRequestDto>();
            var items = warehouses
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToArray();
            return Task.FromResult(PagedResponseDto<WarehouseDto>.Create(
                items,
                warehouses.Count,
                request.PageNumber,
                request.PageSize));
        });
        return service;
    }

    private static async Task<WebApplication> CreateAppAsync(IWarehouseService warehouseService)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = "Development"
        });
        builder.WebHost.UseTestServer();
        builder.Services
            .AddAuthentication(TestAuthHandler.AuthScheme)
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(TestAuthHandler.AuthScheme, _ => { });
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.WarehouseCatalogAccess, policy =>
                policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.WarehouseCatalogRoles));
        });
        builder.Services.AddSingleton(warehouseService);
        builder.Services.AddControllers().AddApplicationPart(typeof(WarehousesController).Assembly);

        var app = builder.Build();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string AuthScheme = "WarehouseCatalogTest";
        public const string RoleHeader = "X-Test-Role";

        public TestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(RoleHeader, out var role) || string.IsNullOrWhiteSpace(role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "warehouse-test-user"), new Claim(ClaimTypes.Role, role.ToString())],
                AuthScheme);
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), AuthScheme);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
