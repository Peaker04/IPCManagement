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
using NSubstitute.ExceptionExtensions;
using Xunit;

namespace IPCManagement.Api.Tests;

public class InventoryIssueServiceTests
{
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IDbContextTransaction _transaction;
    private readonly InventoryIssueService _service;

    public InventoryIssueServiceTests()
    {
        _issueRepository = Substitute.For<IInventoryIssueRepository>();
        _unitOfWork = Substitute.For<IUnitOfWork>();
        _stockLedgerService = Substitute.For<IStockLedgerService>();
        _transaction = Substitute.For<IDbContextTransaction>();

        _unitOfWork.BeginTransactionAsync().Returns(_transaction);

        _service = new InventoryIssueService(
            _issueRepository,
            _unitOfWork,
            _stockLedgerService);
    }

    [Fact]
    public async Task CreateAsync_Should_CreateIssue_DecreaseCurrentStock_And_Commit_When_StockIsSufficient()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var materialRequestId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            Lines = new List<CreateInventoryIssueLineDto>
            {
                new()
                {
                    IngredientId = ingredientId,
                    RequestedQty = 5,
                    IssuedQty = 5,
                    UnitId = unitId
                }
            }
        };

        // Act
        var result = await _service.CreateAsync(dto, userId);

        // Assert
        result.Should().NotBeNull();
        result!.IssueCode.Should().StartWith("ISS-");

        // Verify issue is added
        _issueRepository.Received(1).Add(Arg.Is<Inventoryissue>(i =>
            i.WarehouseId != null &&
            i.MaterialRequestId != null &&
            i.Inventoryissuelines.Count == 1));

        // Verify stock ledger service is called to remove stock
        await _stockLedgerService.Received(1).RemoveStockWithCheckAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            5,
            "ISSUE",
            "inventoryissues",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Xuất kho sản xuất",
            Arg.Any<string>());

        // Verify UnitOfWork saved changes and transaction committed
        await _unitOfWork.Received(1).SaveChangesAsync();
        await _transaction.Received(1).CommitAsync();
    }

    [Fact]
    public async Task CreateAsync_Should_ThrowException_And_Rollback_When_StockIsInsufficient()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var materialRequestId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            Lines = new List<CreateInventoryIssueLineDto>
            {
                new()
                {
                    IngredientId = ingredientId,
                    RequestedQty = 10,
                    IssuedQty = 10,
                    UnitId = unitId
                }
            }
        };

        _stockLedgerService.RemoveStockWithCheckAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            10,
            "ISSUE",
            "inventoryissues",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Xuất kho sản xuất",
            Arg.Any<string>())
            .Throws(new InvalidOperationException("không đủ tồn kho"));

        // Act
        Func<Task> act = async () => await _service.CreateAsync(dto, userId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*không đủ tồn kho*");

        // Verify issue is NOT committed and rollback is called
        await _transaction.Received(1).RollbackAsync();
    }
}
