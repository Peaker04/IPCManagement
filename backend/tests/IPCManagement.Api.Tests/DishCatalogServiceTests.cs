using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class DishCatalogServiceTests
{
    [Fact]
    public async Task DishService_CatalogMethods_Should_DelegateToFocusedService()
    {
        var catalogService = Substitute.For<IDishCatalogService>();
        var repository = Substitute.For<IDishRepository>();
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishService(repository, null!, cache, catalogService);
        var request = new PagedRequestDto { PageNumber = 2, PageSize = 10, SearchKeyword = "canh" };
        var createRequest = new CreateDishRequest { DishCode = "DISH-1", DishName = "Món 1" };
        var updateRequest = new UpdateDishRequest { DishName = "Món 1 mới" };
        var dishId = GuidHelper.ToGuidString(GuidHelper.NewId());

        catalogService.GetPagedAsync(request)
            .Returns(PagedResponseDto<DishDto>.Create([], 0, request.PageNumber, request.PageSize));
        catalogService.GetCatalogAsync(true).Returns(Array.Empty<DishCatalogDto>());
        catalogService.GetByIdAsync(dishId).Returns(Task.FromResult<DishDto?>(null));
        catalogService.CreateAsync(createRequest).Returns(new DishDto { DishId = dishId });
        catalogService.UpdateAsync(dishId, updateRequest).Returns(Task.FromResult<DishDto?>(null));
        catalogService.DeleteAsync(dishId).Returns(true);

        await service.GetPagedAsync(request);
        await service.GetCatalogAsync(includeInactive: true);
        await service.GetByIdAsync(dishId);
        await service.CreateAsync(createRequest);
        await service.UpdateAsync(dishId, updateRequest);
        await service.DeleteAsync(dishId);

        await catalogService.Received(1).GetPagedAsync(request);
        await catalogService.Received(1).GetCatalogAsync(true);
        await catalogService.Received(1).GetByIdAsync(dishId);
        await catalogService.Received(1).CreateAsync(createRequest);
        await catalogService.Received(1).UpdateAsync(dishId, updateRequest);
        await catalogService.Received(1).DeleteAsync(dishId);
    }

    [Fact]
    public async Task GetCatalogAsync_Should_KeepActiveAndAllCachesSeparate()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-catalog-{Guid.NewGuid():N}")
            .Options;
        await using var context = new IpcManagementContext(options);
        var activeDish = NewDish("DISH-ACTIVE", isActive: true);
        var inactiveDish = NewDish("DISH-INACTIVE", isActive: false);
        context.Dishes.AddRange(activeDish, inactiveDish);
        await context.SaveChangesAsync();

        var repository = Substitute.For<IDishRepository>();
        repository.GetCatalogAsync().Returns([activeDish]);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var service = new DishCatalogService(repository, context, cache);

        var activeFirst = await service.GetCatalogAsync();
        var activeSecond = await service.GetCatalogAsync();
        var allFirst = await service.GetCatalogAsync(includeInactive: true);
        var allSecond = await service.GetCatalogAsync(includeInactive: true);

        activeFirst.Select(dish => dish.DishCode).Should().Equal("DISH-ACTIVE");
        activeSecond.Should().BeSameAs(activeFirst);
        allFirst.Select(dish => dish.DishCode).Should().Equal("DISH-ACTIVE", "DISH-INACTIVE");
        allSecond.Should().BeSameAs(allFirst);
        await repository.Received(1).GetCatalogAsync();
    }

    [Fact]
    public async Task DeleteAsync_Should_SoftDeleteAndClearBothCatalogCaches()
    {
        var dish = NewDish("DISH-DELETE", isActive: true);
        var repository = Substitute.For<IDishRepository>();
        repository.GetByIdAsync(Arg.Any<byte[]>()).Returns(dish);
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"dish-delete-{Guid.NewGuid():N}")
            .Options;
        await using var context = new IpcManagementContext(options);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        cache.Set("DishCatalog", new object());
        cache.Set("DishCatalog:all", new object());
        var service = new DishCatalogService(repository, context, cache);

        var deleted = await service.DeleteAsync(GuidHelper.ToGuidString(dish.DishId));

        deleted.Should().BeTrue();
        dish.IsActive.Should().BeFalse();
        await repository.Received(1).UpdateAsync(dish);
        cache.TryGetValue("DishCatalog", out _).Should().BeFalse();
        cache.TryGetValue("DishCatalog:all", out _).Should().BeFalse();
    }

    private static Dish NewDish(string code, bool isActive) => new()
    {
        DishId = GuidHelper.NewId(),
        DishCode = code,
        DishName = code,
        IsActive = isActive
    };
}
