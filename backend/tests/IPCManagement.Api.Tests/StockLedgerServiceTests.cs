using FluentAssertions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class StockLedgerServiceTests
{
    private readonly ICurrentStockRepository _currentStockRepository = Substitute.For<ICurrentStockRepository>();
    private readonly IStockMovementRepository _stockMovementRepository = Substitute.For<IStockMovementRepository>();

    [Fact]
    public async Task RemoveStockWithCheckAsync_Should_DecreaseCurrentStockAtomically_Then_RecordMovement()
    {
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var refId = GuidHelper.NewId();
        var performedBy = GuidHelper.NewId();

        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns(new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                CurrentQty = 10m
            });
        _currentStockRepository
            .ConvertQuantityAsync(unitId, unitId, 3.5m)
            .Returns(3.5m);
        _currentStockRepository
            .ConvertQuantityAsync(unitId, unitId, 10m)
            .Returns(10m);
        _currentStockRepository
            .TryDecreaseAsync(warehouseId, ingredientId, 3.5m, Arg.Any<DateTime>())
            .Returns(true);

        await service.RemoveStockWithCheckAsync(
            warehouseId,
            ingredientId,
            unitId,
            3.5m,
            "ISSUE",
            "inventoryissues",
            refId,
            performedBy,
            "Xuất kho sản xuất",
            "Phiếu xuất ISS-TEST");

        await _currentStockRepository.Received(1)
            .TryDecreaseAsync(warehouseId, ingredientId, 3.5m, Arg.Any<DateTime>());
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.WarehouseId == warehouseId &&
            movement.IngredientId == ingredientId &&
            movement.UnitId == unitId &&
            movement.RefId == refId &&
            movement.PerformedBy == performedBy &&
            movement.QuantityIn == 0 &&
            movement.QuantityOut == 3.5m &&
            movement.BeforeQty == 10m &&
            movement.AfterQty == 6.5m));
    }

    [Fact]
    public async Task RemoveStockWithCheckAsync_Should_Not_RecordMovement_When_DecreaseFails()
    {
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();

        _currentStockRepository
            .TryDecreaseAsync(warehouseId, ingredientId, 10m, Arg.Any<DateTime>())
            .Returns(false);
        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns(new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                CurrentQty = 4m
            });
        _currentStockRepository
            .ConvertQuantityAsync(unitId, unitId, 10m)
            .Returns(10m);
        _currentStockRepository
            .ConvertQuantityAsync(unitId, unitId, 4m)
            .Returns(4m);

        var act = async () => await service.RemoveStockWithCheckAsync(
            warehouseId,
            ingredientId,
            unitId,
            10m,
            "ISSUE",
            "inventoryissues",
            GuidHelper.NewId(),
            GuidHelper.NewId(),
            "Xuất kho sản xuất",
            "Phiếu xuất ISS-TEST");

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*không đủ tồn kho*Hiện có: 4*");
        _stockMovementRepository.DidNotReceive().Add(Arg.Any<Stockmovement>());
    }

    [Fact]
    public async Task AddStockAsync_Should_ConvertIncomingQuantity_ToExistingCurrentStockUnit()
    {
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var gramUnitId = GuidHelper.NewId();
        var kilogramUnitId = GuidHelper.NewId();
        var currentStock = new Currentstock
        {
            WarehouseId = warehouseId,
            IngredientId = ingredientId,
            UnitId = kilogramUnitId,
            CurrentQty = 5m
        };

        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns(currentStock);
        _currentStockRepository
            .ConvertQuantityAsync(gramUnitId, kilogramUnitId, 1000m)
            .Returns(1m);
        _currentStockRepository
            .ConvertQuantityAsync(kilogramUnitId, gramUnitId, 5m)
            .Returns(5000m);

        await service.AddStockAsync(
            warehouseId,
            ingredientId,
            gramUnitId,
            1000m,
            "RECEIPT",
            "inventoryreceipts",
            GuidHelper.NewId(),
            GuidHelper.NewId(),
            "Nhập kho mua hàng",
            "Phiếu nhập RCP-TEST");

        currentStock.CurrentQty.Should().Be(6m);
        _currentStockRepository.Received(1).Update(currentStock);
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.UnitId == gramUnitId &&
            movement.QuantityIn == 1000m &&
            movement.QuantityOut == 0 &&
            movement.BeforeQty == 5000m &&
            movement.AfterQty == 6000m));
    }

    [Fact]
    public async Task RemoveStockWithCheckAsync_Should_DecreaseConvertedQuantity_But_RecordOriginalMovementQuantity()
    {
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var gramUnitId = GuidHelper.NewId();
        var kilogramUnitId = GuidHelper.NewId();

        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns(new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = gramUnitId,
                CurrentQty = 5000m
            });
        _currentStockRepository
            .ConvertQuantityAsync(kilogramUnitId, gramUnitId, 1.5m)
            .Returns(1500m);
        _currentStockRepository
            .ConvertQuantityAsync(gramUnitId, kilogramUnitId, 5000m)
            .Returns(5m);
        _currentStockRepository
            .TryDecreaseAsync(warehouseId, ingredientId, 1500m, Arg.Any<DateTime>())
            .Returns(true);

        await service.RemoveStockWithCheckAsync(
            warehouseId,
            ingredientId,
            kilogramUnitId,
            1.5m,
            "ISSUE",
            "inventoryissues",
            GuidHelper.NewId(),
            GuidHelper.NewId(),
            "Xuất kho sản xuất",
            "Phiếu xuất ISS-TEST");

        await _currentStockRepository.Received(1)
            .TryDecreaseAsync(warehouseId, ingredientId, 1500m, Arg.Any<DateTime>());
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.UnitId == kilogramUnitId &&
            movement.QuantityOut == 1.5m &&
            movement.QuantityIn == 0 &&
            movement.BeforeQty == 5m &&
            movement.AfterQty == 3.5m));
    }

    [Fact]
    public async Task AddStockAsync_Should_CreateLotBalance_When_LotMetadataIsProvided()
    {
        await using var fixture = await LotFixture.CreateAsync();
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository, fixture.Context);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();

        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns((Currentstock?)null);

        await service.AddStockAsync(
            warehouseId,
            ingredientId,
            unitId,
            12m,
            "RECEIPT",
            "inventoryreceipts",
            GuidHelper.NewId(),
            GuidHelper.NewId(),
            "Nhập kho mua hàng",
            "Phiếu nhập RCP-LOT",
            " LOT-A ",
            new DateOnly(2026, 7, 1),
            new DateOnly(2026, 7, 31));

        var lot = fixture.Context.ChangeTracker.Entries<Currentstocklot>()
            .Select(entry => entry.Entity)
            .Single();
        lot.WarehouseId.Should().Equal(warehouseId);
        lot.IngredientId.Should().Equal(ingredientId);
        lot.UnitId.Should().Equal(unitId);
        lot.CurrentQty.Should().Be(12m);
        lot.LotNumber.Should().Be("LOT-A");
        lot.ExpiredDate.Should().Be(new DateOnly(2026, 7, 31));
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.QuantityIn == 12m &&
            movement.BeforeQty == 0m &&
            movement.AfterQty == 12m &&
            movement.LotNumber == "LOT-A" &&
            movement.ExpiredDate == new DateOnly(2026, 7, 31)));
    }

    [Fact]
    public async Task RemoveStockWithCheckAsync_Should_DecreaseLots_ByFefo_And_RecordLotMovements()
    {
        await using var fixture = await LotFixture.CreateAsync();
        var service = new StockLedgerService(_currentStockRepository, _stockMovementRepository, fixture.Context);
        var warehouseId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        fixture.Context.Currentstocklots.AddRange(
            new Currentstocklot
            {
                LotStockId = GuidHelper.NewId(),
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                LotNumber = "LOT-LATE",
                ExpiredDate = new DateOnly(2026, 8, 31),
                CurrentQty = 10m,
                LastUpdated = DateTime.UtcNow
            },
            new Currentstocklot
            {
                LotStockId = GuidHelper.NewId(),
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                LotNumber = "LOT-EARLY",
                ExpiredDate = new DateOnly(2026, 7, 31),
                CurrentQty = 5m,
                LastUpdated = DateTime.UtcNow
            });
        await fixture.Context.SaveChangesAsync();

        _currentStockRepository
            .GetByWarehouseAndIngredientAsync(warehouseId, ingredientId)
            .Returns(new Currentstock
            {
                WarehouseId = warehouseId,
                IngredientId = ingredientId,
                UnitId = unitId,
                CurrentQty = 15m
            });
        _currentStockRepository.ConvertQuantityAsync(unitId, unitId, Arg.Any<decimal>())
            .Returns(call => call.ArgAt<decimal>(2));
        _currentStockRepository
            .TryDecreaseAsync(warehouseId, ingredientId, 8m, Arg.Any<DateTime>())
            .Returns(true);

        await service.RemoveStockWithCheckAsync(
            warehouseId,
            ingredientId,
            unitId,
            8m,
            "ISSUE",
            "inventoryissues",
            GuidHelper.NewId(),
            GuidHelper.NewId(),
            "Xuất kho sản xuất",
            "Phiếu xuất ISS-LOT");

        var lots = await fixture.Context.Currentstocklots
            .OrderBy(item => item.LotNumber)
            .ToListAsync();
        lots.Single(item => item.LotNumber == "LOT-EARLY").CurrentQty.Should().Be(0m);
        lots.Single(item => item.LotNumber == "LOT-LATE").CurrentQty.Should().Be(7m);
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.LotNumber == "LOT-EARLY" &&
            movement.QuantityOut == 5m &&
            movement.BeforeQty == 15m &&
            movement.AfterQty == 10m));
        _stockMovementRepository.Received(1).Add(Arg.Is<Stockmovement>(movement =>
            movement.LotNumber == "LOT-LATE" &&
            movement.QuantityOut == 3m &&
            movement.BeforeQty == 10m &&
            movement.AfterQty == 7m));
    }

    private sealed class LotFixture(
        SqliteConnection connection,
        IPCManagement.Api.Data.IpcManagementContext context) : IAsyncDisposable
    {
        public IPCManagement.Api.Data.IpcManagementContext Context { get; } = context;

        public static async Task<LotFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IPCManagement.Api.Data.IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IPCManagement.Api.Data.IpcManagementContext(options);
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE currentstocklots (
                    lotStockId BLOB PRIMARY KEY,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();

            return new LotFixture(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }
}
