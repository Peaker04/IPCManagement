using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.Entities;
using NSubstitute;
using Xunit;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Tests;

public class InventoryReturnServiceTests
{
    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly ImmediateTransactionRunner _transactionRunner;
    private readonly InventoryReturnService _service;

    public InventoryReturnServiceTests()
    {
        _returnRepository = Substitute.For<IInventoryReturnRepository>();
        _issueRepository = Substitute.For<IInventoryIssueRepository>();
        _unitOfWork = Substitute.For<IUnitOfWork>();
        _stockLedgerService = Substitute.For<IStockLedgerService>();
        _transactionRunner = new ImmediateTransactionRunner();
        _returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        _service = new InventoryReturnService(
            _returnRepository,
            _issueRepository,
            _unitOfWork,
            _stockLedgerService,
            _transactionRunner);
    }

    [Fact]
    public async Task CreateAsync_Should_CreateReturn_And_CommitTransaction()
    {
        // Arrange
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();

        var issue = CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty: 5);
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);
        _returnRepository.GetReturnedQuantitiesByIssueAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        var dto = new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Nguyên liệu dư sau nấu",
            Lines = new List<CreateInventoryReturnLineRequest>
            {
                new()
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId),
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

        _returnRepository.Received(1).Add(Arg.Is<InventoryReturn>(inventoryReturn =>
            inventoryReturn.WarehouseId != null &&
            inventoryReturn.IssueId != null &&
            inventoryReturn.Reason == "Nguyên liệu dư sau nấu" &&
            inventoryReturn.Inventoryreturnlines.Count == 1 &&
            inventoryReturn.Inventoryreturnlines.Single().SourceIssueLineId != null));

        await _stockLedgerService.DidNotReceiveWithAnyArgs().AddStockAsync(
            default!, default!, default!, default, default!, default!, default!, default!, default!, default!);

        await _unitOfWork.Received(1).SaveChangesAsync();
        _transactionRunner.ExecutionCount.Should().Be(1);
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

        var issue = CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty);
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);
        _returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>
            {
                [GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId)] = 3
            });

        var dto = new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Trả vượt còn lại",
            Lines = new List<CreateInventoryReturnLineRequest>
            {
                new()
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId),
                    IngredientId = ingredientId,
                    Quantity = 3,
                    UnitId = unitId
                }
            }
        };

        // Act
        Func<Task> act = async () => await _service.CreateAsync(dto, userId);

        // Assert
        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*vượt quá số lượng đã xuất*");

        _returnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
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
        _transactionRunner.ExecutionCount.Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_Should_Reject_WhenKitchenHasNotAcknowledgedOriginalIssue()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        var issue = CreateIssue(issueId, warehouseId, ingredientId, unitId, issuedQty: 5m);
        issue.ReceivedAt = null;
        issue.ReceivedBy = null;

        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);

        var act = () => _service.CreateAsync(new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Trả khi chưa ký nhận",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId),
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    Quantity = 1m
                }
            ]
        }, userId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Bếp cần xác nhận đã nhận phiếu xuất gốc*");
        _returnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
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

        var issue = CreateIssue(
            issueId,
            warehouseId,
            ingredientId,
            unitId,
            issuedQty: 5);
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);
        _returnRepository.GetReturnedQuantitiesByIssueAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        var dto = new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ReturnType = "WASTE",
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Hao hụt sơ chế",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId),
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
        _returnRepository.Received(1).Add(Arg.Is<InventoryReturn>(inventoryReturn =>
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
        _transactionRunner.ExecutionCount.Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectExplicitSourceLine_WhenIngredientOrUnitDoesNotMatch()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var mismatchedIngredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        var issue = CreateIssue(issueId, warehouseId, ingredientId, unitId, issuedQty: 5m);
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);

        var act = () => _service.CreateAsync(new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Dòng nguồn không khớp",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issue.Inventoryissuelines.Single().IssueLineId),
                    IngredientId = mismatchedIngredientId,
                    UnitId = unitId,
                    Quantity = 1m
                }
            ]
        }, userId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*không khớp dòng nguồn phiếu xuất*");
        _returnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectOmittedSourceLine_WhenIssueHasAmbiguousIngredientAndUnit()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(
            CreateIssueWithSameIngredientLines(issueId, warehouseId, ingredientId, unitId, 3m, 4m));

        var act = () => _service.CreateAsync(new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Không được suy đoán dòng nguồn",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    Quantity = 1m
                }
            ]
        }, userId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*phải chỉ rõ SourceIssueLineId*");
        _returnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectOmittedSourceLine_EvenWhenIngredientAndUnitAreUnique()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(
            CreateIssue(issueId, warehouseId, ingredientId, unitId, issuedQty: 5m));

        var act = () => _service.CreateAsync(new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Không được suy đoán dòng nguồn duy nhất",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    Quantity = 1m
                }
            ]
        }, userId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*phải chỉ rõ SourceIssueLineId*");
        _returnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
    }

    [Fact]
    public async Task CreateAsync_ShouldKeepBalancesIndependent_ForSameIngredientAndUnitSourceLines()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        var issue = CreateIssueWithSameIngredientLines(issueId, warehouseId, ingredientId, unitId, 5m, 5m);
        var issueLines = issue.Inventoryissuelines.ToList();
        var exhaustedLine = issueLines[0];
        var availableLine = issueLines[1];
        _issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);
        _returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>
            {
                [GuidHelper.ToGuidString(exhaustedLine.IssueLineId)] = 5m
            });
        InventoryReturn? capturedReturn = null;
        _returnRepository.When(repository => repository.Add(Arg.Any<InventoryReturn>()))
            .Do(call => capturedReturn = call.Arg<InventoryReturn>());

        var result = await _service.CreateAsync(new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Trả đúng dòng nguồn còn lại",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(availableLine.IssueLineId),
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    Quantity = 5m
                }
            ]
        }, userId);

        result.Should().NotBeNull();
        capturedReturn.Should().NotBeNull();
        capturedReturn!.Inventoryreturnlines.Single().SourceIssueLineId.Should().Equal(availableLine.IssueLineId);
    }

    [Fact]
    public void MapReturnLine_ShouldExposeSourceLine_AndKeepLegacyNullSourceReadable()
    {
        var sourceIssueLineId = GuidHelper.NewId();
        var sourceLine = new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(),
            IngredientId = GuidHelper.NewId(),
            UnitId = GuidHelper.NewId(),
            SourceIssueLineId = sourceIssueLineId,
            Quantity = 1.2345678m
        };
        var legacyLine = new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(),
            IngredientId = GuidHelper.NewId(),
            UnitId = GuidHelper.NewId(),
            SourceIssueLineId = null,
            Quantity = 1m
        };

        InventoryMapper.MapReturnLine(sourceLine).SourceIssueLineId
            .Should().Be(GuidHelper.ToGuidString(sourceIssueLineId));
        InventoryMapper.MapReturnLine(legacyLine).SourceIssueLineId.Should().BeNull();
    }

    private static InventoryIssue CreateIssue(
        string issueId,
        string warehouseId,
        string ingredientId,
        string unitId,
        decimal issuedQty)
    {
        var issueBytes = GuidHelper.ParseGuidString(issueId)!;
        var ingredientBytes = GuidHelper.ParseGuidString(ingredientId)!;
        var unitBytes = GuidHelper.ParseGuidString(unitId)!;

        return new InventoryIssue
        {
            IssueId = issueBytes,
            IssueCode = "ISS-TEST",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = GuidHelper.ParseGuidString(warehouseId)!,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = GuidHelper.NewId(),
            ReceivedBy = GuidHelper.NewId(),
            ReceivedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = new List<InventoryIssueLine>
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

    private static InventoryIssue CreateIssueWithSameIngredientLines(
        string issueId,
        string warehouseId,
        string ingredientId,
        string unitId,
        params decimal[] issuedQuantities)
    {
        var issue = CreateIssue(issueId, warehouseId, ingredientId, unitId, issuedQuantities[0]);
        var ingredientBytes = GuidHelper.ParseGuidString(ingredientId)!;
        var unitBytes = GuidHelper.ParseGuidString(unitId)!;
        foreach (var issuedQuantity in issuedQuantities.Skip(1))
        {
            issue.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = ingredientBytes,
                UnitId = unitBytes,
                RequestedQty = issuedQuantity,
                IssuedQty = issuedQuantity
            });
        }

        return issue;
    }
}
