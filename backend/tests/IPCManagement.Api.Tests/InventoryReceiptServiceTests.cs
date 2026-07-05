using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
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

    private IpcManagementContext CreateInMemoryContext()
    {
        var connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:");
        connection.Open();
        
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE purchaserequests (
                purchaseRequestId BLOB PRIMARY KEY,
                purchaseRequestCode TEXT,
                requestDate TEXT,
                purchaseForDate TEXT,
                shiftName TEXT,
                status TEXT,
                createdBy BLOB,
                approvedBy BLOB,
                approvedAt TEXT
            );

            CREATE TABLE purchaserequestlines (
                purchaseRequestLineId BLOB PRIMARY KEY,
                purchaseRequestId BLOB,
                materialRequestLineId BLOB,
                ingredientId BLOB,
                supplierId BLOB,
                unitId BLOB,
                requiredQty REAL,
                currentStockQty REAL,
                purchaseQty REAL,
                estimatedUnitPrice REAL,
                expectedDeliveryDate TEXT,
                note TEXT
            );

            CREATE TABLE inventoryreceipts (
                receiptId BLOB PRIMARY KEY,
                receiptCode TEXT,
                receiptDate TEXT,
                warehouseId BLOB,
                supplierId BLOB,
                purchaseRequestId BLOB,
                createdBy BLOB,
                createdAt TEXT
            );

            CREATE TABLE inventoryreceiptlines (
                receiptLineId BLOB PRIMARY KEY,
                receiptId BLOB,
                ingredientId BLOB,
                unitId BLOB,
                quantity REAL,
                unitPrice REAL,
                amount REAL,
                lotNumber TEXT,
                manufactureDate TEXT,
                expiredDate TEXT
            );

            CREATE TABLE auditlogs (
                auditId BLOB PRIMARY KEY,
                changedAt TEXT,
                changedBy BLOB,
                businessArea TEXT,
                entityName TEXT,
                entityId BLOB,
                fieldName TEXT,
                oldValue TEXT,
                newValue TEXT,
                reason TEXT
            );
        """;
        command.ExecuteNonQuery();

        var options = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        var context = new IpcManagementContext(options);
        return context;
    }

    [Fact]
    public async Task CreateFromPurchaseRequestAsync_Should_Throw_When_ContextIsNull()
    {
        var dto = new CreateInventoryReceiptFromPurchaseDto();
        var action = () => _service.CreateFromPurchaseRequestAsync(dto, Guid.NewGuid().ToString());
        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("Chưa cấu hình dữ liệu để nhập kho từ phiếu mua.");
    }

    [Fact]
    public async Task CreateFromPurchaseRequestAsync_Should_Throw_When_PurchaseRequest_NotFound()
    {
        using var context = CreateInMemoryContext();
        var service = new InventoryReceiptService(_receiptRepository, _unitOfWork, _stockLedgerService, context);
        
        var dto = new CreateInventoryReceiptFromPurchaseDto
        {
            PurchaseRequestId = Guid.NewGuid().ToString(),
            SupplierId = Guid.NewGuid().ToString(),
            WarehouseId = Guid.NewGuid().ToString(),
            Lines = new List<CreateInventoryReceiptFromPurchaseLineDto> { new() }
        };

        var action = () => service.CreateFromPurchaseRequestAsync(dto, Guid.NewGuid().ToString());
        await action.Should().ThrowAsync<ArgumentException>().WithMessage("Không tìm thấy phiếu mua.");
    }

    [Fact]
    public async Task CreateFromPurchaseRequestAsync_Should_CreateReceipt_UpdateStock_And_ChangeStatus()
    {
        using var context = CreateInMemoryContext();
        var service = new InventoryReceiptService(_receiptRepository, _unitOfWork, _stockLedgerService, context);

        var userId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var purchaseRequestId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var purchaseLineId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var supplierId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var warehouseId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var ingredientId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        var unitId = IPCManagement.Api.Helpers.GuidHelper.NewId();

        // Arrange database state
        var pr = new Purchaserequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = "PR-123",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = "SENTTOSUPPLIER",
            CreatedBy = userId
        };
        pr.Purchaserequestlines.Add(new Purchaserequestline
        {
            PurchaseRequestLineId = purchaseLineId,
            PurchaseRequestId = purchaseRequestId,
            MaterialRequestLineId = IPCManagement.Api.Helpers.GuidHelper.NewId(),
            IngredientId = ingredientId,
            PurchaseQty = 100,
            RequiredQty = 100,
            CurrentStockQty = 0,
            UnitId = unitId,
            SupplierId = supplierId,
            EstimatedUnitPrice = 5000
        });

        context.Purchaserequests.Add(pr);
        await context.SaveChangesAsync();

        var dto = new CreateInventoryReceiptFromPurchaseDto
        {
            PurchaseRequestId = IPCManagement.Api.Helpers.GuidHelper.ToGuidString(purchaseRequestId),
            SupplierId = IPCManagement.Api.Helpers.GuidHelper.ToGuidString(supplierId),
            WarehouseId = IPCManagement.Api.Helpers.GuidHelper.ToGuidString(warehouseId),
            ReceiptDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Lines = new List<CreateInventoryReceiptFromPurchaseLineDto>
            {
                new()
                {
                    PurchaseRequestLineId = IPCManagement.Api.Helpers.GuidHelper.ToGuidString(purchaseLineId),
                    ReceivedQty = 50,
                    UnitId = IPCManagement.Api.Helpers.GuidHelper.ToGuidString(unitId)
                }
            }
        };

        // Act
        var result = await service.CreateFromPurchaseRequestAsync(dto, IPCManagement.Api.Helpers.GuidHelper.ToGuidString(userId));

        // Assert
        result.Should().NotBeNull();
        result!.ReceiptCode.Should().StartWith("RCP-");

        // Verify status changed to PARTIALRECEIVED
        pr.Status.Should().Be("PARTIALRECEIVED");

        // Verify receipt is added
        _receiptRepository.Received(1).Add(Arg.Is<Inventoryreceipt>(r =>
            r.PurchaseRequestId != null &&
            r.Inventoryreceiptlines.Count == 1 &&
            r.Inventoryreceiptlines.First().Quantity == 50));

        // Verify stock ledger service is called
        await _stockLedgerService.Received(1).AddStockAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            50,
            "RECEIPT",
            "inventoryreceipts",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Nhập kho từ phiếu mua",
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<DateOnly?>(),
            Arg.Any<DateOnly?>());

        // Verify transaction
        await _unitOfWork.Received(1).SaveChangesAsync();
        await _transaction.Received(1).CommitAsync();
    }
}
