using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishBomTemplateServiceTests
{
    [Fact]
    public async Task DishService_BuildTemplate_Should_DelegateToFocusedService()
    {
        var repository = Substitute.For<IDishRepository>();
        var catalogService = Substitute.For<IDishCatalogService>();
        var diagnosticsService = Substitute.For<IDishCatalogDiagnosticsService>();
        var templateService = Substitute.For<IDishBomTemplateService>();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishService(
            repository,
            null!,
            cache,
            catalogService,
            diagnosticsService,
            templateService);
        var query = new BomTemplateQueryDto { PriceTier = 30000m, TemplateType = "missing" };
        var expected = new byte[] { 1, 2, 3 };
        templateService.BuildAsync(query, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await service.BuildBomTemplateWorkbookAsync(query);

        result.Should().Equal(expected);
        await templateService.Received(1).BuildAsync(query, Arg.Any<CancellationToken>());
    }
}
