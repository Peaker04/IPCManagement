using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishBomServiceTests
{
    [Fact]
    public async Task DishService_ManualBomMethods_Should_DelegateToFocusedService()
    {
        var repository = Substitute.For<IDishRepository>();
        var catalog = Substitute.For<IDishCatalogService>();
        var diagnostics = Substitute.For<IDishCatalogDiagnosticsService>();
        var template = Substitute.For<IDishBomTemplateService>();
        var import = Substitute.For<IDishBomImportService>();
        var bom = Substitute.For<IDishBomService>();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishService(repository, null!, cache, catalog, diagnostics, template, import, bom);
        var dishId = Guid.NewGuid().ToString();
        var bomId = Guid.NewGuid().ToString();
        var create = new CreateDishBomLineRequest();
        var update = new UpdateDishBomLineRequest();
        bom.GetBomLinesAsync(dishId).Returns(Array.Empty<DishCatalogBomLineDto>());
        bom.AddBomLineAsync(dishId, create).Returns(new DishCatalogBomLineDto());
        bom.UpdateBomLineAsync(dishId, bomId, update, "actor").Returns(new DishCatalogBomLineDto());
        bom.CloseBomLineAsync(dishId, bomId).Returns(true);

        (await service.GetBomLinesAsync(dishId)).Should().BeEmpty();
        await service.AddBomLineAsync(dishId, create);
        await service.UpdateBomLineAsync(dishId, bomId, update, "actor");
        (await service.CloseBomLineAsync(dishId, bomId)).Should().BeTrue();

        await bom.Received(1).GetBomLinesAsync(dishId);
        await bom.Received(1).AddBomLineAsync(dishId, create);
        await bom.Received(1).UpdateBomLineAsync(dishId, bomId, update, "actor");
        await bom.Received(1).CloseBomLineAsync(dishId, bomId);
    }
}
