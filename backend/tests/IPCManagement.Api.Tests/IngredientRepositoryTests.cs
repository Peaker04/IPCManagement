using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class IngredientRepositoryTests
{
    [Fact]
    public async Task GetPagedAsync_Should_Search_ByNameOrCode_UsingEscapedLikePattern()
    {
        await using var fixture = await IngredientRepositoryFixture.CreateAsync();
        var repository = new IngredientRepository(fixture.Context);

        var (items, totalCount) = await repository.GetPagedAsync(1, 20, "%");

        totalCount.Should().Be(1);
        items.Should().ContainSingle(item => item.IngredientCode == "ING-%-SPECIAL");
    }

    [Fact]
    public async Task GetPagedAsync_Should_Search_CaseInsensitive_WhenDatabaseCollationSupportsIt()
    {
        await using var fixture = await IngredientRepositoryFixture.CreateAsync();
        var repository = new IngredientRepository(fixture.Context);

        var (items, totalCount) = await repository.GetPagedAsync(1, 20, "tomato");

        totalCount.Should().Be(1);
        items.Should().ContainSingle(item => item.IngredientName == "Tomato");
    }

    [Fact]
    public async Task GetPagedAsync_Should_ExcludeInactiveIngredients()
    {
        await using var fixture = await IngredientRepositoryFixture.CreateAsync();
        var repository = new IngredientRepository(fixture.Context);

        var (items, totalCount) = await repository.GetPagedAsync(1, 20);

        totalCount.Should().Be(3);
        items.Should().OnlyContain(item => item.IsActive != false);
    }

    private sealed class IngredientRepositoryFixture(
        SqliteConnection connection,
        IpcManagementContext context) : IAsyncDisposable
    {
        public IpcManagementContext Context { get; } = context;

        public static async Task<IngredientRepositoryFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IpcManagementContext(options);
            await CreateSchemaAsync(connection);

            var unitId = GuidHelper.NewId();
            var warehouseId = GuidHelper.NewId();
            context.Units.Add(new Unit
            {
                UnitId = unitId,
                UnitCode = "KG",
                UnitName = "Kilogram",
                ConvertRateToBase = 1
            });
            context.Warehouses.Add(new Warehouse
            {
                WarehouseId = warehouseId,
                WarehouseCode = "WH-ING",
                WarehouseName = "Kho nguyên liệu",
                WarehouseType = "KHAC"
            });
            context.Ingredients.AddRange(
                new Ingredient
                {
                    IngredientId = GuidHelper.NewId(),
                    IngredientCode = "ING-TOMATO",
                    IngredientName = "Tomato",
                    UnitId = unitId,
                    WarehouseId = warehouseId,
                    ReferencePrice = 1000,
                    IsFreshDaily = true,
                    IsActive = true
                },
                new Ingredient
                {
                    IngredientId = GuidHelper.NewId(),
                    IngredientCode = "ING-%-SPECIAL",
                    IngredientName = "Literal percent",
                    UnitId = unitId,
                    WarehouseId = warehouseId,
                    ReferencePrice = 2000,
                    IsFreshDaily = false,
                    IsActive = true
                },
                new Ingredient
                {
                    IngredientId = GuidHelper.NewId(),
                    IngredientCode = "ING-OTHER",
                    IngredientName = "Other",
                    UnitId = unitId,
                    WarehouseId = warehouseId,
                    ReferencePrice = 3000,
                    IsFreshDaily = false,
                    IsActive = true
                },
                new Ingredient
                {
                    IngredientId = GuidHelper.NewId(),
                    IngredientCode = "ING-INACTIVE",
                    IngredientName = "Inactive",
                    UnitId = unitId,
                    WarehouseId = warehouseId,
                    ReferencePrice = 4000,
                    IsFreshDaily = false,
                    IsActive = false
                });
            await context.SaveChangesAsync();

            return new IngredientRepositoryFixture(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE units (
                    unitId BLOB PRIMARY KEY,
                    unitCode TEXT NOT NULL,
                    unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL,
                    convertRateToBase TEXT NOT NULL
                );

                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY,
                    warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL,
                    warehouseType TEXT NOT NULL,
                    note TEXT NULL
                );

                CREATE TABLE ingredients (
                    ingredientId BLOB PRIMARY KEY,
                    ingredientCode TEXT NOT NULL,
                    ingredientName TEXT NOT NULL,
                    unitId BLOB NOT NULL,
                    warehouseId BLOB NOT NULL,
                    referencePrice TEXT NOT NULL,
                    isFreshDaily INTEGER NOT NULL,
                    isActive INTEGER NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
