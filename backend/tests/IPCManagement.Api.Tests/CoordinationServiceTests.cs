using System;
using FluentAssertions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Xunit;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;

namespace IPCManagement.Api.Tests;

public class CoordinationServiceTests
{
    [Fact]
    public void MapOrder_Should_ExposeMenuAndDishItems_Without_UsingMenuIdAsDishId()
    {
        // Arrange
        var menuId = Guid.NewGuid();
        var firstDishId = Guid.NewGuid();
        var secondDishId = Guid.NewGuid();

        var line = new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.ToBytes(Guid.NewGuid()),
            QuantityPlanId = GuidHelper.ToBytes(Guid.NewGuid()),
            MenuScheduleId = GuidHelper.ToBytes(Guid.NewGuid()),
            CustomerId = GuidHelper.ToBytes(Guid.NewGuid()),
            MenuId = GuidHelper.ToBytes(menuId),
            ShiftName = "MORNING",
            ForecastServings = 120,
            FinalServings = 118,
            Customer = new Customer
            {
                CustomerId = GuidHelper.ToBytes(Guid.NewGuid()),
                CustomerCode = "DAV",
                CustomerName = "Draxlmaier",
                Note = "Ít cay"
            },
            Menu = new Menu
            {
                MenuId = GuidHelper.ToBytes(menuId),
                MenuCode = "MENU-001",
                MenuName = "Menu ca sáng",
                Menuitems =
                [
                    new MenuItem
                    {
                        MenuId = GuidHelper.ToBytes(menuId),
                        DishId = GuidHelper.ToBytes(secondDishId),
                        DishSlot = "savory-canh",
                        DisplayOrder = 2,
                        Dish = new Dish
                        {
                            DishId = GuidHelper.ToBytes(secondDishId),
                            DishCode = "DISH-002",
                            DishName = "Canh rau"
                        }
                    },
                    new MenuItem
                    {
                        MenuId = GuidHelper.ToBytes(menuId),
                        DishId = GuidHelper.ToBytes(firstDishId),
                        DishSlot = "savory-main",
                        DisplayOrder = 1,
                        Dish = new Dish
                        {
                            DishId = GuidHelper.ToBytes(firstDishId),
                            DishCode = "DISH-001",
                            DishName = "Cơm gà"
                        }
                    }
                ]
            },
            MenuSchedule = new MenuSchedule
            {
                MenuScheduleId = GuidHelper.ToBytes(Guid.NewGuid()),
                MenuPrice = 35000,
                BomRatePercent = 100
            },
            QuantityPlan = new MealQuantityPlan
            {
                QuantityPlanId = GuidHelper.ToBytes(Guid.NewGuid()),
                ServiceDate = new DateOnly(2026, 6, 15)
            }
        };

        // Act
        var result = OrderLifecyclePolicy.MapOrder(line);

        // Assert
        result.MenuId.Should().Be(menuId.ToString());
        result.MenuCode.Should().Be("MENU-001");
        result.MenuName.Should().Be("Menu ca sáng");
        result.DishId.Should().Be(firstDishId.ToString());
        result.DishId.Should().NotBe(result.MenuId);
        result.Dishes.Select(dish => dish.DishId).Should().Equal(
            firstDishId.ToString(),
            secondDishId.ToString());
        result.Dishes.Select(dish => dish.DishName).Should().Equal("Cơm gà", "Canh rau");
        result.Dishes.Select(dish => dish.DishSlot).Should().Equal("savory-main", "savory-canh");
        result.Dishes.Select(dish => dish.DisplayOrder).Should().Equal(1, 2);
    }
}
