using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Models.Validators;
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
    public void CreateInventoryIssueDtoValidator_Should_Allow_EmptyLines_ForAutoBuildFromDemand()
    {
        var validator = new CreateInventoryIssueDtoValidator();
        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = Guid.NewGuid().ToString(),
            MaterialRequestId = Guid.NewGuid().ToString(),
            Lines = []
        };

        var result = validator.Validate(dto);

        result.IsValid.Should().BeTrue();
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
        SeedIssuableMaterialRequest(materialRequestId, ingredientId, unitId, requiredQty: 5);

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
        SeedIssuableMaterialRequest(materialRequestId, ingredientId, unitId, requiredQty: 10);

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

    [Fact]
    public async Task CreateAsync_Should_GenerateIssueLines_FromRemainingApprovedDemand_WhenLinesAreEmpty()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var materialRequestId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        SeedIssuableMaterialRequest(materialRequestId, ingredientId, unitId, requiredQty: 12);
        _issueRepository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>())
            .Returns([
                new Inventoryissueline
                {
                    IngredientId = GuidHelper.ParseGuidString(ingredientId)!,
                    UnitId = GuidHelper.ParseGuidString(unitId)!,
                    IssuedQty = 5
                }
            ]);

        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId
        };

        var result = await _service.CreateAsync(dto, userId);

        result.Should().NotBeNull();
        _issueRepository.Received(1).Add(Arg.Is<Inventoryissue>(issue =>
            issue.Inventoryissuelines.Count == 1 &&
            issue.Inventoryissuelines.Single().RequestedQty == 7 &&
            issue.Inventoryissuelines.Single().IssuedQty == 7));
        await _stockLedgerService.Received(1).RemoveStockWithCheckAsync(
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            7,
            "ISSUE",
            "inventoryissues",
            Arg.Any<byte[]>(),
            Arg.Any<byte[]>(),
            "Xuất kho sản xuất",
            Arg.Any<string>());
    }

    [Fact]
    public async Task CreateAsync_Should_Block_WhenManualLineExceedsRemainingDemand()
    {
        var userId = Guid.NewGuid().ToString();
        var warehouseId = Guid.NewGuid().ToString();
        var materialRequestId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        SeedIssuableMaterialRequest(materialRequestId, ingredientId, unitId, requiredQty: 12);
        _issueRepository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>())
            .Returns([
                new Inventoryissueline
                {
                    IngredientId = GuidHelper.ParseGuidString(ingredientId)!,
                    UnitId = GuidHelper.ParseGuidString(unitId)!,
                    IssuedQty = 10
                }
            ]);

        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            Lines =
            [
                new CreateInventoryIssueLineDto
                {
                    IngredientId = ingredientId,
                    RequestedQty = 3,
                    IssuedQty = 3,
                    UnitId = unitId
                }
            ]
        };

        var act = async () => await _service.CreateAsync(dto, userId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*vượt nhu cầu còn lại*");
        _issueRepository.DidNotReceive().Add(Arg.Any<Inventoryissue>());
        await _stockLedgerService.DidNotReceive().RemoveStockWithCheckAsync(
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
    }

    private void SeedIssuableMaterialRequest(string materialRequestId, string ingredientId, string unitId, decimal requiredQty)
    {
        var ingredientBytes = GuidHelper.ParseGuidString(ingredientId)!;
        var unitBytes = GuidHelper.ParseGuidString(unitId)!;
        _issueRepository.GetMaterialRequestForIssueAsync(Arg.Any<byte[]>())
            .Returns(new Materialrequest
            {
                RequestId = GuidHelper.ParseGuidString(materialRequestId)!,
                RequestCode = "MR-TEST",
                RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
                RequestScope = "FULLDAY",
                Status = "SENTTOWAREHOUSE",
                CreatedBy = GuidHelper.NewId(),
                PlanId = GuidHelper.NewId(),
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = GuidHelper.NewId(),
                        RequestId = GuidHelper.ParseGuidString(materialRequestId)!,
                        PlanLineId = GuidHelper.NewId(),
                        IngredientId = ingredientBytes,
                        UnitId = unitBytes,
                        TotalServings = 1,
                        GrossQtyPerServing = requiredQty,
                        BomRatePercent = 100,
                        TotalRequiredQty = requiredQty,
                        CurrentStockQty = 0,
                        SuggestedPurchaseQty = 0,
                        Ingredient = new Ingredient
                        {
                            IngredientId = ingredientBytes,
                            IngredientCode = "ING",
                            IngredientName = "Ingredient",
                            UnitId = unitBytes,
                            WarehouseId = GuidHelper.NewId(),
                            ReferencePrice = 1000,
                            IsFreshDaily = true,
                            IsActive = true
                        },
                        Unit = new Unit
                        {
                            UnitId = unitBytes,
                            UnitCode = "KG",
                            UnitName = "kg",
                            ConvertRateToBase = 1
                        }
                    }
                ]
            });
        _issueRepository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>())
            .Returns([]);
    }

    private IpcManagementContext CreateInMemoryContext()
    {
        var connection = new Microsoft.Data.Sqlite.SqliteConnection("DataSource=:memory:");
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT,
                requestDate TEXT,
                requestScope TEXT,
                status TEXT DEFAULT 'DRAFT',
                createdBy BLOB,
                approvedBy BLOB,
                approvedAt TEXT,
                planId BLOB,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE materialrequestlines (
                requestLineId BLOB PRIMARY KEY,
                requestId BLOB,
                bomId BLOB,
                ingredientId BLOB,
                unitId BLOB,
                priceTierAmount REAL DEFAULT 25000,
                bomScope TEXT DEFAULT 'global',
                totalRequiredQty REAL DEFAULT 0,
                appliedPortionRatePercent REAL DEFAULT 100,
                appliedPortionRuleId BLOB,
                appliedPortionRuleSource TEXT DEFAULT 'CONTRACT_DEFAULT',
                currentStockQty REAL DEFAULT 0,
                grossQtyPerServing REAL DEFAULT 0,
                planLineId BLOB,
                suggestedPurchaseQty REAL DEFAULT 0,
                totalServings INTEGER DEFAULT 0,
                bomRatePercent REAL DEFAULT 100,
                yieldLossPercent REAL DEFAULT 0
            );

            CREATE TABLE inventoryissues (
                issueId BLOB PRIMARY KEY,
                issueCode TEXT,
                issueDate TEXT,
                shiftName TEXT,
                warehouseId BLOB,
                materialRequestId BLOB,
                issuedBy BLOB,
                receivedBy BLOB,
                receivedAt TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE inventoryissuelines (
                issueLineId BLOB PRIMARY KEY,
                issueId BLOB,
                ingredientId BLOB,
                unitId BLOB,
                requestedQty REAL,
                issuedQty REAL
            );

            CREATE TABLE currentstock (
                warehouseId BLOB,
                ingredientId BLOB,
                unitId BLOB,
                currentQty REAL,
                lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP,
                rowVersion TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(warehouseId, ingredientId, unitId)
            );

            CREATE TABLE warehouses (
                warehouseId BLOB PRIMARY KEY,
                warehouseCode TEXT,
                warehouseName TEXT,
                note TEXT,
                warehouseType TEXT
            );

            CREATE TABLE users (
                userId BLOB PRIMARY KEY,
                username TEXT,
                passwordHash TEXT,
                fullName TEXT,
                roleId BLOB,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                isActive INTEGER DEFAULT 1
            );

            CREATE TABLE ingredients (
                ingredientId BLOB PRIMARY KEY,
                ingredientCode TEXT,
                ingredientName TEXT,
                unitId BLOB,
                warehouseId BLOB,
                referencePrice REAL DEFAULT 0,
                isActive INTEGER DEFAULT 1,
                isFreshDaily INTEGER DEFAULT 0
            );

            CREATE TABLE units (
                unitId BLOB PRIMARY KEY,
                unitCode TEXT,
                unitName TEXT,
                baseUnitCode TEXT,
                convertRateToBase REAL DEFAULT 1
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
    public async Task Repository_GetPagedAsync_Should_Throw_When_WarehouseId_IsInvalid()
    {
        using var context = CreateInMemoryContext();
        var repository = new InventoryIssueRepository(context);

        var action = () => repository.GetPagedAsync(new InventoryIssueFilterRequestDto
        {
            WarehouseId = "not-a-guid"
        });

        await action.Should().ThrowAsync<ArgumentException>()
            .WithMessage("WarehouseId không hợp lệ.");
    }

    [Fact]
    public async Task CreateAsync_Should_UpdateMaterialRequestStatus_To_Exported_When_FullyIssued()
    {
        using var context = CreateInMemoryContext();
        var service = new InventoryIssueService(_issueRepository, new UnitOfWork(context), _stockLedgerService, context);

        var materialRequestId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();

        var pr = new Materialrequest
        {
            RequestId = materialRequestId,
            RequestCode = "MR-123",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "SENTTOWAREHOUSE",
            CreatedBy = userId,
            PlanId = GuidHelper.NewId()
        };
        pr.Materialrequestlines.Add(new Materialrequestline
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = materialRequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredientId,
            UnitId = unitId,
            TotalRequiredQty = 10
        });

        context.Ingredients.Add(new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-1", IngredientName = "Mock Ingredient", UnitId = unitId, WarehouseId = warehouseId });
        context.Units.Add(new Unit { UnitId = unitId, UnitCode = "U-1", UnitName = "Mock Unit" });
        context.Warehouses.Add(new Warehouse { WarehouseId = warehouseId, WarehouseCode = "W-1", WarehouseName = "Mock Warehouse", WarehouseType = "KHO_BEP" });
        context.Materialrequests.Add(pr);
        context.Currentstocks.Add(new Currentstock { WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 100 });
        await context.SaveChangesAsync();

        _issueRepository.GetMaterialRequestForIssueAsync(Arg.Any<byte[]>()).Returns(pr);
        _issueRepository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>()).Returns(new List<Inventoryissueline>());

        var dto = new CreateInventoryIssueDto
        {
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = GuidHelper.ToGuidString(warehouseId),
            MaterialRequestId = GuidHelper.ToGuidString(materialRequestId),
            Lines = new List<CreateInventoryIssueLineDto>
            {
                new()
                {
                    IngredientId = GuidHelper.ToGuidString(ingredientId),
                    UnitId = GuidHelper.ToGuidString(unitId),
                    RequestedQty = 10,
                    IssuedQty = 10
                }
            }
        };

        var result = await service.CreateAsync(dto, GuidHelper.ToGuidString(userId));

        result.Should().NotBeNull();
        var reloadedRequest = await context.Materialrequests
            .AsNoTracking()
            .SingleAsync(request => request.RequestId == materialRequestId);
        reloadedRequest.Status.Should().Be("EXPORTED");
        var statusAudit = await context.Auditlogs.AsNoTracking().SingleAsync();
        statusAudit.NewValue.Should().Be("EXPORTED");
    }

    [Fact]
    public async Task ConfirmReceiptAsync_Should_UpdateReceivedAt_And_WriteAuditLog()
    {
        using var context = CreateInMemoryContext();
        var service = new InventoryIssueService(_issueRepository, _unitOfWork, _stockLedgerService, context);

        var issueId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();

        var issue = new Inventoryissue
        {
            IssueId = issueId,
            IssueCode = "ISS-TEST",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = GuidHelper.NewId(),
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = GuidHelper.NewId(),
            CreatedAt = DateTime.UtcNow
        };
        context.Users.Add(new User { UserId = issue.IssuedBy, Username = "testuser", FullName = "Test User" });
        context.Warehouses.Add(new Warehouse { WarehouseId = issue.WarehouseId, WarehouseCode = "W-1", WarehouseName = "Mock Warehouse", WarehouseType = "KHO_BEP" });
        context.Inventoryissues.Add(issue);
        await context.SaveChangesAsync();

        // Ensure issueId from database is exact
        var dbIssue = await context.Inventoryissues.FirstAsync();
        issueId = dbIssue.IssueId;

        var dto = new ConfirmInventoryIssueReceiptDto
        {
            HasDiscrepancy = true,
            DiscrepancyNote = "Thiếu nửa cân"
        };

        var result = await service.ConfirmReceiptAsync(GuidHelper.ToGuidString(issueId), dto, GuidHelper.ToGuidString(userId));

        result.Should().NotBeNull();
        issue.ReceivedAt.Should().NotBeNull();
        issue.ReceivedBy.Should().Equal(userId);

        var audits = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(context.Auditlogs);
        audits.Should().HaveCount(2); // KitchenReceived, KitchenReceiptDiscrepancy
        audits.Should().ContainSingle(a => a.NewValue == "Thiếu nửa cân");
    }
}
