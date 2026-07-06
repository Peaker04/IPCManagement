using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public class InventoryReturnServiceTests
{
    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IDbContextTransaction _transaction;
    private readonly InventoryReturnService _service;

    public InventoryReturnServiceTests()
    {
        _returnRepository = Substitute.For<IInventoryReturnRepository>();
        _issueRepository = Substitute.For<IInventoryIssueRepository>();
        _unitOfWork = Substitute.For<IUnitOfWork>();
        _stockLedgerService = Substitute.For<IStockLedgerService>();
        _transaction = Substitute.For<IDbContextTransaction>();

        _unitOfWork.BeginTransactionAsync().Returns(_transaction);

        _service = new InventoryReturnService(
            _returnRepository,
            _issueRepository,
            _unitOfWork,
            _stockLedgerService);
    }

    [Fact]
    public async Task CreateAsync_Should_CreateReturn_AddStockMovementReturn_And_CommitTransaction()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty: 5));
        _returnRepository.GetReturnedQuantitiesByIssueAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        var dto = new CreateInventoryReturnDto
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Nguyên liệu dư sau nấu",
            Lines = new List<CreateInventoryReturnLineDto>
            {
                new()
                {
                    IngredientId = ingredientId,
                    Quantity = 2,
                    UnitId = unitId
                }
            }
        };

        // Act
        var result = await _service.CreateAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.ReturnCode.Should().StartWith("RET-");

        _returnRepository.Received(1).Add(Arg.Is<Inventoryreturn>(inventoryReturn =>
            inventoryReturn.WarehouseId != null &&
            inventoryReturn.IssueId != null &&
            inventoryReturn.Reason == "Nguyên liệu dư sau nấu" &&
            inventoryReturn.Inventoryreturnlines.Count == 1));

        await _stockLedgerService.Received(1).AddStockAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            2,
            "RETURN",
            "inventoryreturns",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Trả nguyên liệu dư sau sản xuất",
            Arg.Any<string>());

        await _unitOfWork.Received(1).SaveChangesAsync();
        await _transaction.Received(1).CommitAsync();
    }

    [Fact]
    public async Task CreateAsync_Should_Rollback_When_ReturnQuantityExceedsRemainingIssuedQuantity()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        var issuedQty = 5m;

        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty));
        _returnRepository.GetReturnedQuantitiesByIssueAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>
            {
                [BuildKey(ingredientId, unitId)] = 3
            });

        var dto = new CreateInventoryReturnDto
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Trả vượt còn lại",
            Lines = new List<CreateInventoryReturnLineDto>
            {
                new()
                {
                    IngredientId = ingredientId,
                    Quantity = 3,
                    UnitId = unitId
                }
            }
        };

        // Act
        Func<Task> act = async () => await _service.CreateAsync(dto, userId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*vượt quá số lượng đã xuất*");

        _returnRepository.DidNotReceive().Add(Arg.Any<Inventoryreturn>());
        await _stockLedgerService.DidNotReceive().AddStockAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<decimal>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<string>(),
            Arg.Any<string>());
        await _transaction.Received(1).RollbackAsync();
    }

    [Fact]
    public async Task CreateAsync_Should_RecordWasteWithoutAddingStockMovement_WhenReturnTypeIsWaste()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty: 5));
        _returnRepository.GetReturnedQuantitiesByIssueAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        var dto = new CreateInventoryReturnDto
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReturnType = "WASTE",
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Hao hụt sơ chế",
            Lines =
            [
                new CreateInventoryReturnLineDto
                {
                    IngredientId = ingredientId,
                    Quantity = 1,
                    UnitId = unitId
                }
            ]
        };

        // Act
        var result = await _service.CreateAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.ReturnCode.Should().StartWith("WST-");
        _returnRepository.Received(1).Add(Arg.Is<Inventoryreturn>(inventoryReturn =>
            inventoryReturn.ReturnType == "WASTE" &&
            inventoryReturn.Reason == "Hao hụt sơ chế" &&
            inventoryReturn.Inventoryreturnlines.Count == 1));
        await _stockLedgerService.DidNotReceive().AddStockAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<decimal>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<string>(),
            Arg.Any<string>());
        await _unitOfWork.Received(1).SaveChangesAsync();
        await _transaction.Received(1).CommitAsync();
    }

    private static Inventoryissue CreateIssue(
        string issueId,
        string warehouseId,
        string ingredientId,
        string unitId,
        decimal issuedQty)
    {
        var issueBytes = GuidHelper.ParseGuidString(issueId)!;
        var ingredientBytes = GuidHelper.ParseGuidString(ingredientId)!;
        var unitBytes = GuidHelper.ParseGuidString(unitId)!;

        return new Inventoryissue
        {
            IssueId = issueBytes,
            IssueCode = "ISS-TEST",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = GuidHelper.ParseGuidString(warehouseId)!,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = GuidHelper.NewId(),
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = new List<Inventoryissueline>
            {
                new()
                {
                    IssueLineId = GuidHelper.NewId(),
                    IssueId = issueBytes,
                    IngredientId = ingredientBytes,
                    UnitId = unitBytes,
                    RequestedQty = issuedQty,
                    IssuedQty = issuedQty
                }
            }
        };
    }

    private static string BuildKey(string ingredientId, string unitId)
        => $"{ingredientId}|{unitId}";
}
