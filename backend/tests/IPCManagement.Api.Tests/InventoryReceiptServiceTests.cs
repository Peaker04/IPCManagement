using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public class InventoryReceiptServiceTests
{
    private readonly IInventoryReceiptRepository _receiptRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IDbContextTransaction _transaction;
    private readonly InventoryReceiptService _service;

    public InventoryReceiptServiceTests()
    {
        _receiptRepository = Substitute.For<IInventoryReceiptRepository>();
        _unitOfWork = Substitute.For<IUnitOfWork>();
        _stockLedgerService = Substitute.For<IStockLedgerService>();
        _transaction = Substitute.For<IDbContextTransaction>();

        _unitOfWork.BeginTransactionAsync().Returns(_transaction);

        _service = new InventoryReceiptService(
            _receiptRepository,
            _unitOfWork,
            _stockLedgerService);
    }

    [Fact]
    public async Task CreateAsync_Should_CreateReceipt_UpdateCurrentStock_And_CommitTransaction()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var supplierId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        var dto = new CreateInventoryReceiptDto
        {
            ReceiptDate = DateOnly.FromDateTime(DateTime.UtcNow),
            SupplierId = supplierId,
            WarehouseId = warehouseId,
            Lines = new List<CreateInventoryReceiptLineDto>
            {
                new()
                {
                    IngredientId = ingredientId,
                    Quantity = 10,
                    UnitId = unitId,
                    UnitPrice = 1000
                }
            }
        };

        // Act
        var result = await _service.CreateAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.ReceiptCode.Should().StartWith("RCP-");

        // Verify receipt is added
        _receiptRepository.Received(1).Add(Arg.Is<Inventoryreceipt>(r =>
            r.WarehouseId != null &&
            r.SupplierId != null &&
            r.Inventoryreceiptlines.Count == 1));

        // Verify stock ledger service is called to add stock
        await _stockLedgerService.Received(1).AddStockAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            10,
            "RECEIPT",
            "inventoryreceipts",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Nhập kho mua hàng",
            Arg.Any<string>());

        // Verify UnitOfWork saved changes and transaction committed
        await _unitOfWork.Received(1).SaveChangesAsync();
        await _transaction.Received(1).CommitAsync();
    }
}
