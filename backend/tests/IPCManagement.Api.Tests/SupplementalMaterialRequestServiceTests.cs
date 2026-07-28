using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using NSubstitute;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Tests;

public sealed class SupplementalMaterialRequestServiceTests
{
    [Fact]
    public async Task CreateAsync_ShouldPersistPendingRequestFromReceivedIssueLine()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();

        var result = await CreateService(context).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2.5m,
                Reason = "Phát sinh thêm suất",
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.Status.Should().Be("PENDING_WAREHOUSE_REVIEW");
        result.RequestedQty.Should().Be(2.5m);
        result.IngredientName.Should().Be("Gạo");
        var saved = await context.Supplementalmaterialrequests.SingleAsync();
        saved.IssueLineId.Should().Equal(seed.IssueLineId);
        saved.Reason.Should().Be("Phát sinh thêm suất");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectIssueThatKitchenHasNotReceived()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: null);
        await context.SaveChangesAsync();

        var action = () => CreateService(context).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 1,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        await action.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*xác nhận đã nhận*");
    }

    [Fact]
    public async Task FulfillAsync_ShouldCreateSupplementalIssue_DecreaseStock_AndExposeRemainingQuantity()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        var stock = new CurrentStock
        {
            WarehouseId = seed.WarehouseId,
            IngredientId = seed.IngredientId,
            UnitId = seed.UnitId,
            CurrentQty = 5,
            LastUpdated = DateTime.UtcNow,
        };
        context.Currentstocks.Add(stock);
        await context.SaveChangesAsync();
        var stockLedger = Substitute.For<IStockLedgerService>();
        stockLedger.RemoveStockWithCheckAsync(
                Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<decimal>(),
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<byte[]>(),
                Arg.Any<string>(), Arg.Any<string>())
            .Returns(call =>
            {
                var quantity = call.ArgAt<decimal>(3);
                var requestId = call.ArgAt<byte[]>(6);
                stock.CurrentQty -= quantity;
                context.Stockmovements.Add(new StockMovement
                {
                    MovementId = GuidHelper.NewId(),
                    MovementDate = DateTime.UtcNow,
                    WarehouseId = seed.WarehouseId,
                    IngredientId = seed.IngredientId,
                    UnitId = seed.UnitId,
                    MovementType = "SUPPLEMENTAL",
                    RefTable = "supplementalmaterialrequests",
                    RefId = requestId,
                    QuantityIn = 0,
                    QuantityOut = quantity,
                    BeforeQty = 5,
                    AfterQty = 5 - quantity,
                    PerformedBy = seed.UserId,
                    Reason = "test",
                });
                return Task.CompletedTask;
            });
        var service = CreateService(context, stockLedger);
        var created = await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2.5m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var result = await service.FulfillAsync(
            created.RequestId,
            new FulfillSupplementalMaterialRequest { Quantity = 2.5m },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.Status.Should().Be("ISSUED");
        result.FulfilledQty.Should().Be(2.5m);
        result.RemainingQty.Should().Be(0);
        result.ActionDisabledReason.Should().Be("Kho đã cấp đủ; đang chờ bếp kiểm đếm và ký nhận.");
        stock.CurrentQty.Should().Be(2.5m);
        (await context.Inventoryissues.CountAsync(item => item.IssueCode.StartsWith("ISS-SUP-"))).Should().Be(1);
    }

    [Fact]
    public async Task RouteToPurchasingAsync_ShouldCreateTraceableDraftForOnlyMissingQuantity()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        context.Materialrequestlines.Add(new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = seed.MaterialRequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = seed.IngredientId,
            UnitId = seed.UnitId,
            TotalServings = 1,
            GrossQtyPerServing = 1,
            BomRatePercent = 100,
            AppliedPortionRuleSource = "TEST",
            AppliedPortionRatePercent = 100,
            TotalRequiredQty = 10,
            CurrentStockQty = 0,
            SuggestedPurchaseQty = 0,
        });
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var created = await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 3,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var result = await service.RouteToPurchasingAsync(
            created.RequestId,
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.Status.Should().Be("NEEDS_PURCHASE");
        result.PurchaseRequestCode.Should().StartWith("PR-SUP-");
        var purchaseLine = await context.Purchaserequestlines.SingleAsync();
        purchaseLine.PurchaseQty.Should().Be(3);
        purchaseLine.IngredientId.Should().Equal(seed.IngredientId);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new IpcManagementContext(options);
    }

    private static SupplementalMaterialRequestService CreateService(
        IpcManagementContext context,
        IStockLedgerService? stockLedgerService = null)
    {
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var transaction = Substitute.For<IDbContextTransaction>();
        unitOfWork.BeginTransactionAsync().Returns(transaction);
        unitOfWork.SaveChangesAsync().Returns(_ => context.SaveChangesAsync());
        return new SupplementalMaterialRequestService(
            context,
            unitOfWork,
            stockLedgerService ?? Substitute.For<IStockLedgerService>());
    }

    private static (byte[] IssueId, byte[] IssueLineId, byte[] WarehouseId, byte[] UserId, byte[] IngredientId, byte[] UnitId, byte[] MaterialRequestId) SeedReceivedIssueLine(
        IpcManagementContext context,
        DateTime? receivedAt)
    {
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();
        var materialRequestId = GuidHelper.NewId();
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "GAO", IngredientName = "Gạo", UnitId = unitId, WarehouseId = warehouseId, IsActive = true };
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", ConvertRateToBase = 1 };
        var issue = new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = "ISS-TEST",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            IssuedBy = userId,
            ReceivedBy = receivedAt is null ? null : userId,
            ReceivedAt = receivedAt,
            CreatedAt = DateTime.UtcNow,
        };
        var line = new InventoryIssueLine
        {
            IssueLineId = issueLineId,
            IssueId = issueId,
            IngredientId = ingredientId,
            UnitId = unitId,
            RequestedQty = 10,
            IssuedQty = 10,
            Issue = issue,
            Ingredient = ingredient,
            Unit = unit,
        };
        issue.Inventoryissuelines.Add(line);
        context.AddRange(unit, ingredient, issue, line);
        return (issueId, issueLineId, warehouseId, userId, ingredientId, unitId, materialRequestId);
    }
}
