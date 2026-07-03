using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class RepositorySearchTests
{
    [Fact]
    public async Task DishRepository_GetPagedAsync_Should_EscapeLikePattern_AndExcludeInactive()
    {
        await using var fixture = await RepositorySearchFixture.CreateAsync();
        var repository = new DishRepository(fixture.Context);

        var (literalItems, literalCount) = await repository.GetPagedAsync(1, 20, "%");
        var (allItems, allCount) = await repository.GetPagedAsync(1, 20);

        literalCount.Should().Be(1);
        literalItems.Should().ContainSingle(item => item.DishCode == "DISH-%-SPECIAL");
        allCount.Should().Be(2);
        allItems.Should().OnlyContain(item => item.IsActive != false);
    }

    [Fact]
    public async Task WarehouseRepository_GetPagedAsync_Should_EscapeLikePattern_AndSearchCode()
    {
        await using var fixture = await RepositorySearchFixture.CreateAsync();
        var repository = new WarehouseRepository(fixture.Context);

        var (literalItems, literalCount) = await repository.GetPagedAsync(1, 20, "%");
        var (codeItems, codeCount) = await repository.GetPagedAsync(1, 20, "WH-COLD");

        literalCount.Should().Be(1);
        literalItems.Should().ContainSingle(item => item.WarehouseCode == "WH-%-SPECIAL");
        codeCount.Should().Be(1);
        codeItems.Should().ContainSingle(item => item.WarehouseName == "Kho lạnh");
    }

    private sealed class RepositorySearchFixture(
        SqliteConnection connection,
        IpcManagementContext context) : IAsyncDisposable
    {
        public IpcManagementContext Context { get; } = context;

        public static async Task<RepositorySearchFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IpcManagementContext(options);
            await CreateSchemaAsync(connection);

            context.Dishes.AddRange(
                new Dish
                {
                    DishId = GuidHelper.NewId(),
                    DishCode = "DISH-PHO",
                    DishName = "Phở",
                    DishGroup = "Món chính",
                    IsActive = true
                },
                new Dish
                {
                    DishId = GuidHelper.NewId(),
                    DishCode = "DISH-%-SPECIAL",
                    DishName = "Món ký tự phần trăm",
                    DishGroup = "Món chính",
                    IsActive = true
                },
                new Dish
                {
                    DishId = GuidHelper.NewId(),
                    DishCode = "DISH-INACTIVE",
                    DishName = "Món ngừng dùng",
                    DishGroup = "Món chính",
                    IsActive = false
                });
            context.Warehouses.AddRange(
                new Warehouse
                {
                    WarehouseId = GuidHelper.NewId(),
                    WarehouseCode = "WH-COLD",
                    WarehouseName = "Kho lạnh",
                    WarehouseType = "MAIN"
                },
                new Warehouse
                {
                    WarehouseId = GuidHelper.NewId(),
                    WarehouseCode = "WH-%-SPECIAL",
                    WarehouseName = "Kho ký tự phần trăm",
                    WarehouseType = "MAIN"
                },
                new Warehouse
                {
                    WarehouseId = GuidHelper.NewId(),
                    WarehouseCode = "WH-DRY",
                    WarehouseName = "Kho khô",
                    WarehouseType = "MAIN"
                });
            await context.SaveChangesAsync();

            return new RepositorySearchFixture(connection, context);
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
                CREATE TABLE dishes (
                    dishId BLOB PRIMARY KEY,
                    dishCode TEXT NOT NULL,
                    dishName TEXT NOT NULL,
                    dishGroup TEXT NULL,
                    dishType TEXT NULL,
                    isActive INTEGER NULL
                );

                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY,
                    warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL,
                    warehouseType TEXT NOT NULL,
                    note TEXT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
