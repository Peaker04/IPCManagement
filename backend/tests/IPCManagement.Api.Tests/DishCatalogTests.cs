using FluentAssertions;
using IPCManagement.Api.Controllers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public class DishCatalogTests
{
    [Fact]
    public async Task DishService_GetCatalogAsync_Should_Map_MenuSlots_And_BomDetails()
    {
        var repository = Substitute.For<IDishRepository>();
        var dishId = Guid.NewGuid();
        var bomId = Guid.NewGuid();
        var ingredientId = Guid.NewGuid();
        var unitId = Guid.NewGuid();

        repository.GetCatalogAsync().Returns(new List<Dish>
        {
            new()
            {
                DishId = GuidHelper.ToBytes(dishId),
                DishCode = "DISH-001",
                DishName = "Cơm gà",
                DishType = "MORNING",
                DishGroup = "Mặn",
                IsActive = true,
                Menuitems =
                [
                    new Menuitem { DishSlot = "Món mặn", DisplayOrder = 2 },
                    new Menuitem { DishSlot = "Món mặn", DisplayOrder = 1 },
                    new Menuitem { DishSlot = "Canh", DisplayOrder = 3 }
                ],
                Dishboms =
                [
                    new Dishbom
                    {
                        BomId = GuidHelper.ToBytes(bomId),
                        DishId = GuidHelper.ToBytes(dishId),
                        IngredientId = GuidHelper.ToBytes(ingredientId),
                        UnitId = GuidHelper.ToBytes(unitId),
                        GrossQtyPerServing = 0.12m,
                        WasteRatePercent = 5,
                        EffectiveFrom = new DateOnly(2026, 6, 15),
                        Ingredient = new Ingredient
                        {
                            IngredientId = GuidHelper.ToBytes(ingredientId),
                            IngredientCode = "ING-001",
                            IngredientName = "Thịt gà",
                            UnitId = GuidHelper.ToBytes(unitId),
                            WarehouseId = GuidHelper.NewId(),
                            ReferencePrice = 65000,
                            IsFreshDaily = true
                        },
                        Unit = new IPCManagement.Api.Models.Entities.Unit
                        {
                            UnitId = GuidHelper.ToBytes(unitId),
                            UnitCode = "KG",
                            UnitName = "Kilogram",
                            ConvertRateToBase = 1
                        }
                    }
                ]
            }
        });
        var service = new DishService(repository);

        var result = await service.GetCatalogAsync();

        result.Should().ContainSingle();
        var catalogDish = result[0];
        catalogDish.DishId.Should().Be(dishId.ToString());
        catalogDish.MenuSlots.Should().Equal("Món mặn", "Canh");
        catalogDish.BomLines.Should().ContainSingle();
        catalogDish.BomLines[0].BomId.Should().Be(bomId.ToString());
        catalogDish.BomLines[0].IngredientName.Should().Be("Thịt gà");
        catalogDish.BomLines[0].UnitCode.Should().Be("KG");
        catalogDish.BomLines[0].GrossQtyPerServing.Should().Be(0.12m);
        catalogDish.BomLines[0].ReferencePrice.Should().Be(65000);
    }

    [Fact]
    public async Task DishesController_GetCatalog_Should_Return_ApiResponseShape()
    {
        var service = Substitute.For<IDishService>();
        service.GetCatalogAsync().Returns(new List<DishCatalogDto>
        {
            new()
            {
                DishId = Guid.NewGuid().ToString(),
                DishCode = "DISH-001",
                DishName = "Cơm gà",
                IsActive = true
            }
        });
        var controller = new DishesController(service);

        var actionResult = await controller.GetCatalog();

        var ok = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var response = ok.Value.Should()
            .BeAssignableTo<ApiResponse<IReadOnlyList<DishCatalogDto>>>()
            .Subject;
        response.Success.Should().BeTrue();
        response.Data.Should().ContainSingle();
        response.Data![0].DishCode.Should().Be("DISH-001");
    }

    [Fact]
    public async Task SampleDataProductionGuard_Should_Return404_Before_NextMiddleware_InProduction()
    {
        var environment = Substitute.For<IWebHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Production);
        var nextCalled = false;
        var middleware = new SampleDataProductionGuardMiddleware(
            _ =>
            {
                nextCalled = true;
                return Task.CompletedTask;
            },
            environment);
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/sample-data/import";

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        nextCalled.Should().BeFalse();
    }
}
