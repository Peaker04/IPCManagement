using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.Workflow;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class WorkflowReportPaginationTests
{
    [Fact]
    public async Task GetCurrentStockPageAsync_Should_Return_Page_Metadata_And_Only_Page_Rows()
    {
        await using var connection = new SqliteConnection("DataSource=:memory:");
        await connection.OpenAsync();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                CREATE TABLE units (unitId BLOB PRIMARY KEY, unitCode TEXT NOT NULL, unitName TEXT NOT NULL, baseUnitCode TEXT, convertRateToBase REAL NOT NULL);
                CREATE TABLE warehouses (warehouseId BLOB PRIMARY KEY, warehouseCode TEXT NOT NULL, warehouseName TEXT NOT NULL, warehouseType TEXT NOT NULL, note TEXT);
                CREATE TABLE ingredients (ingredientId BLOB PRIMARY KEY, ingredientCode TEXT NOT NULL, ingredientName TEXT NOT NULL, unitId BLOB NOT NULL, warehouseId BLOB NOT NULL, referencePrice REAL NOT NULL, isFreshDaily INTEGER NOT NULL, isActive INTEGER NOT NULL);
                CREATE TABLE currentstock (warehouseId BLOB NOT NULL, ingredientId BLOB NOT NULL, unitId BLOB NOT NULL, currentQty REAL NOT NULL, lastUpdated TEXT NOT NULL, rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (warehouseId, ingredientId));
                """;
            await command.ExecuteNonQueryAsync();
        }

        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;

        await using var context = new IpcManagementContext(options);
        var warehouseId = Guid.NewGuid().ToByteArray();
        var unitId = Guid.NewGuid().ToByteArray();
        var ingredientIds = Enumerable.Range(1, 3).Select(_ => Guid.NewGuid().ToByteArray()).ToArray();

        var warehouse = new Warehouse
        {
            WarehouseId = warehouseId,
            WarehouseCode = "WH-1",
            WarehouseName = "Kho chính",
            WarehouseType = "KHO_BEP",
        };
        var unit = new Unit
        {
            UnitId = unitId,
            UnitCode = "KG",
            UnitName = "Kilogram",
            BaseUnitCode = "KG",
            ConvertRateToBase = 1,
        };
        var ingredients = ingredientIds.Select((ingredientId, index) => new Ingredient
        {
            IngredientId = ingredientId,
            IngredientCode = $"ING-{index + 1}",
            IngredientName = $"Nguyên liệu {index + 1}",
            UnitId = unitId,
            WarehouseId = warehouseId,
            IsActive = true,
            Warehouse = warehouse,
            Unit = unit,
        }).ToArray();
        context.Warehouses.Add(warehouse);
        context.Units.Add(unit);
        context.Ingredients.AddRange(ingredients);
        context.Currentstocks.AddRange(ingredientIds.Select((ingredientId, index) => new Currentstock
        {
            WarehouseId = warehouseId,
            IngredientId = ingredientId,
            UnitId = unitId,
            CurrentQty = index + 1,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow,
            Warehouse = warehouse,
            Ingredient = ingredients[index],
            Unit = unit,
        }));
        await context.SaveChangesAsync();
        (await context.Currentstocks.CountAsync()).Should().Be(3);

        var result = await new WorkflowReportService(context).GetCurrentStockPageAsync(new CurrentStockPageQueryDto
        {
            PageNumber = 1,
            PageSize = 2,
        });

        result.TotalCount.Should().Be(3);
        result.PageNumber.Should().Be(1);
        result.PageSize.Should().Be(2);
        result.TotalPages.Should().Be(2);
        result.HasPrev.Should().BeFalse();
        result.HasNext.Should().BeTrue();
        result.Items.Should().HaveCount(2);
        result.Items.Select(row => row.IngredientName).Should().ContainInOrder("Nguyên liệu 1", "Nguyên liệu 2");
    }
}
