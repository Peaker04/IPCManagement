using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task CreateSupplierQuotation_Should_RejectOverlappingEffectivePeriod_ForSameSupplierAndIngredient()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await SeedSupplierAndIngredientAsync(context, fixture, fixture.SupplierId, "Nhà cung cấp Demo");

        var service = new SupplierQuotationService(context);
        await service.CreateAsync(new CreateSupplierQuotationRequest
        {
            SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = "2026-06-30"
        });

        var act = () => service.CreateAsync(new CreateSupplierQuotationRequest
        {
            SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 12000,
            EffectiveFrom = "2026-05-01",
            EffectiveTo = null
        });

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetBestPriceEntityAsync_Should_TieBreak_ByEffectiveFromThenSupplierName_WhenPricesEqual()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();

        var supplierEarlyZ = GuidHelper.NewId();
        var supplierLateA = GuidHelper.NewId();
        var supplierLateB = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierEarlyZ, "Nhà cung cấp Z (báo giá cũ hơn)");
        await SeedSupplierAsync(context, supplierLateA, "Nhà cung cấp A (mới, cùng giá)");
        await SeedSupplierAsync(context, supplierLateB, "Nhà cung cấp B (mới, cùng giá)");

        var service = new SupplierQuotationService(context);
        await service.CreateAsync(new CreateSupplierQuotationRequest
        {
            SupplierId = GuidHelper.ToGuidString(supplierEarlyZ),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationRequest
        {
            SupplierId = GuidHelper.ToGuidString(supplierLateB),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-06-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationRequest
        {
            SupplierId = GuidHelper.ToGuidString(supplierLateA),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-06-01",
            EffectiveTo = null
        });

        var best = await service.GetBestPriceEntityAsync(fixture.IngredientId, new DateOnly(2026, 7, 1));

        // Cùng giá 10000: 2 báo giá "2026-06-01" (A, B) mới hơn báo giá "2026-01-01" (Z) nên thắng theo EffectiveFrom desc;
        // giữa A và B cùng ngày hiệu lực thì A thắng theo thứ tự tên A-Z.
        best.Should().NotBeNull();
        best!.SupplierId.Should().BeEquivalentTo(supplierLateA);
    }

    private static async Task SeedSupplierAndIngredientAsync(
        IpcManagementContext context,
        WorkflowFixture fixture,
        byte[] supplierId,
        string supplierName)
    {
        context.Units.Add(new Unit
        {
            UnitId = fixture.UnitId,
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = fixture.WarehouseId,
            WarehouseCode = "WH-DEMO",
            WarehouseName = "Kho demo",
            WarehouseType = "DRY"
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = fixture.IngredientId,
            IngredientCode = "ING-DEMO",
            IngredientName = "Nguyên liệu demo",
            UnitId = fixture.UnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 9000,
            IsFreshDaily = false,
            IsActive = true
        });
        context.Suppliers.Add(new Supplier
        {
            SupplierId = supplierId,
            SupplierCode = $"SUP-{GuidHelper.ToGuidString(supplierId)[..8]}",
            SupplierName = supplierName,
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task SeedSupplierAsync(IpcManagementContext context, byte[] supplierId, string supplierName)
    {
        context.Suppliers.Add(new Supplier
        {
            SupplierId = supplierId,
            SupplierCode = $"SUP-{GuidHelper.ToGuidString(supplierId)[..8]}",
            SupplierName = supplierName,
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task<byte[]> SeedApprovedPurchaseRequestWithTwoSuppliersAsync(
        IpcManagementContext context,
        WorkflowFixture fixture,
        byte[] supplierA,
        byte[] supplierB)
    {
        await SeedSupplierAndIngredientAsync(context, fixture, supplierA, "NCC A");
        await SeedSupplierAsync(context, supplierB, "NCC B");

        var purchaseRequestId = GuidHelper.NewId();
        var purchaseRequest = new PurchaseRequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = $"PR-DEMO-{GuidHelper.ToGuidString(purchaseRequestId)[..8]}",
            RequestDate = new DateOnly(2026, 6, 1),
            PurchaseForDate = new DateOnly(2026, 6, 2),
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new PurchaseRequestLine
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = purchaseRequestId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierA,
                    UnitId = fixture.UnitId,
                    RequiredQty = 10,
                    CurrentStockQty = 0,
                    PurchaseQty = 10,
                    EstimatedUnitPrice = 1000,
                    ExpectedDeliveryDate = new DateOnly(2026, 6, 2)
                },
                new PurchaseRequestLine
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = purchaseRequestId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierB,
                    UnitId = fixture.UnitId,
                    RequiredQty = 5,
                    CurrentStockQty = 0,
                    PurchaseQty = 5,
                    EstimatedUnitPrice = 2000,
                    ExpectedDeliveryDate = new DateOnly(2026, 6, 2)
                }
            ]
        };
        var supplierIds = new[] { supplierA, supplierB };
        var lineIndex = 0;
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var supplierId = supplierIds[lineIndex];
            var fingerprintSeed = lineIndex == 0 ? 'A' : 'B';
            line.SupplierDecisions.Add(new PurchaseLineSupplierDecision
            {
                PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                SupplierId = supplierId,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = new DateOnly(2026, 6, 1),
                EvidenceReferencePrice = line.EstimatedUnitPrice,
                ProposedUnitPrice = line.EstimatedUnitPrice,
                ProposedDeliveryDate = line.ExpectedDeliveryDate!.Value,
                ConfirmedBy = fixture.UserId,
                ConfirmedAt = DateTime.UtcNow,
                DecisionFingerprint = new string(fingerprintSeed, 64),
                Version = 1,
                Status = "CURRENT",
                CurrentDecisionKey = line.PurchaseRequestLineId
            });
            lineIndex++;
        }
        context.Purchaserequests.Add(purchaseRequest);
        await context.SaveChangesAsync();

        return purchaseRequestId;
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_SplitBySupplier_WhenPurchaseRequestHasMultipleSuppliers()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = CreatePurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        orders.Should().HaveCount(2);
        orders.Should().OnlyContain(order => order.Lines.Count == 1);
        orders.Should().Contain(order => order.SupplierId == GuidHelper.ToGuidString(supplierA) && order.Lines[0].OrderedQty == 10);
        orders.Should().Contain(order => order.SupplierId == GuidHelper.ToGuidString(supplierB) && order.Lines[0].OrderedQty == 5);
        orders.Should().OnlyContain(order => order.Status == "ORDERED");
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_Throw_WhenPurchaseRequestNotApproved()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);
        var purchaseRequest = await context.Purchaserequests.FirstAsync(pr => pr.PurchaseRequestId == purchaseRequestId);
        purchaseRequest.Status = "DRAFT";
        await context.SaveChangesAsync();

        var service = CreatePurchaseOrderService(context);
        var act = () => service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_Throw_WhenCalledAgainAfterAllLinesConverted()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = CreatePurchaseOrderService(context);
        var first = await service.CreateFromApprovedRequestAsync(
            GuidHelper.ToGuidString(purchaseRequestId),
            fixture.UserIdString);
        var retry = await service.CreateFromApprovedRequestAsync(
            GuidHelper.ToGuidString(purchaseRequestId),
            fixture.UserIdString);

        retry.Select(order => order.PurchaseOrderId)
            .Should().BeEquivalentTo(first.Select(order => order.PurchaseOrderId));
        (await context.Purchaseorders.CountAsync()).Should().Be(2);
        (await context.Purchaseorderlines.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task RecordReceipt_Should_RejectSecondActiveDraftForTheSameSourceLine()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var orderService = CreatePurchaseOrderService(context);
        var receivingService = CreatePurchaseReceivingService(context);
        var orders = await orderService.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var firstDraft = await receivingService.RecordAsync(
            CreatePurchaseReceiptRequest(fixture, orderForSupplierA.PurchaseOrderId, lineId, 4m, "workflow-partial"),
            fixture.UserIdString);
        firstDraft.ReceiptStatus.Should().Be("DRAFT");
        firstDraft.PurchaseOrderStatus.Should().Be("ORDERED");
        (await context.Purchaseorderlines.AsNoTracking().SingleAsync(line => line.PurchaseOrderLineId == GuidHelper.ParseGuidString(lineId)))
            .ReceivedQty.Should().Be(0);

        var duplicateDraft = () => receivingService.RecordAsync(
            CreatePurchaseReceiptRequest(fixture, orderForSupplierA.PurchaseOrderId, lineId, 6m, "workflow-final"),
            fixture.UserIdString);
        await duplicateDraft.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đang chờ xử lý*");
        (await context.Purchaseorderlines.AsNoTracking().SingleAsync(line => line.PurchaseOrderLineId == GuidHelper.ParseGuidString(lineId)))
            .ReceivedQty.Should().Be(0);

        (await context.Inventoryreceipts.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Stockmovements.AsNoTracking().CountAsync(item => item.MovementType == "RECEIPT")).Should().Be(0);
        (await context.Currentstocks.AsNoTracking().CountAsync(item => item.IngredientId == fixture.IngredientId)).Should().Be(0);
    }

    [Fact]
    public async Task RecordReceipt_Should_Throw_WhenExceedingOrderedQty()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var orderService = CreatePurchaseOrderService(context);
        var receivingService = CreatePurchaseReceivingService(context);
        var orders = await orderService.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var act = () => receivingService.RecordAsync(
            CreatePurchaseReceiptRequest(fixture, orderForSupplierA.PurchaseOrderId, lineId, 11m, "workflow-over-receipt"),
            fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task RecordReceipt_Should_RejectWrongWarehouse_ForLinkedSupplementalPurchase()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS supplementalmaterialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT,
                issueId BLOB,
                issueLineId BLOB,
                warehouseId BLOB,
                ingredientId BLOB,
                unitId BLOB,
                requestedQty REAL,
                reason TEXT,
                status TEXT,
                requestedBy BLOB,
                requestedAt TEXT
            );
            """);
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var orderService = CreatePurchaseOrderService(context);
        var receivingService = CreatePurchaseReceivingService(context);
        var orders = await orderService.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var order = orders.First(item => item.SupplierId == GuidHelper.ToGuidString(supplierA));
        var supplementalWarehouseId = GuidHelper.NewId();
        var supplementalRequestId = GuidHelper.NewId();

        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = supplementalWarehouseId,
            WarehouseCode = "WH-SUPPLEMENTAL",
            WarehouseName = "Kho yêu cầu bổ sung",
            WarehouseType = "DRY"
        });
        context.Supplementalmaterialrequests.Add(new SupplementalMaterialRequest
        {
            RequestId = supplementalRequestId,
            RequestCode = "SUP-RECEIPT-WAREHOUSE",
            IssueId = GuidHelper.NewId(),
            IssueLineId = GuidHelper.NewId(),
            WarehouseId = supplementalWarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            RequestedQty = 10,
            Status = "NEEDS_PURCHASE",
            RequestedBy = fixture.UserId,
            RequestedAt = DateTime.UtcNow,
        });
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = fixture.UserId,
            BusinessArea = "SupplementalMaterial",
            EntityName = nameof(SupplementalMaterialRequest),
            EntityId = supplementalRequestId,
            FieldName = "PurchaseRequestId",
            NewValue = GuidHelper.ToGuidString(purchaseRequestId),
            Reason = "Linked supplemental receipt warehouse regression test",
        });
        await context.SaveChangesAsync();

        var act = () => receivingService.RecordAsync(
            CreatePurchaseReceiptRequest(
                fixture,
                order.PurchaseOrderId,
                order.Lines[0].PurchaseOrderLineId,
                10m,
                "workflow-wrong-supplemental-warehouse"),
            fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đúng kho đang xử lý yêu cầu của bếp*");
        (await context.Inventoryreceipts.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Cancel_Should_Allow_WhenOnlyDraftReceiptExists()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var orderService = CreatePurchaseOrderService(context);
        var receivingService = CreatePurchaseReceivingService(context);
        var orders = await orderService.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        await receivingService.RecordAsync(
            CreatePurchaseReceiptRequest(fixture, orderForSupplierA.PurchaseOrderId, lineId, 2m, "workflow-before-cancel"),
            fixture.UserIdString);

        var cancelled = await orderService.CancelAsync(orderForSupplierA.PurchaseOrderId);

        cancelled.Status.Should().Be("CANCELLED");
    }

    [Fact]
    public async Task GetPriceVarianceByDishGroupAsync_Should_WeightByBomQuantity_NotSimpleAverage()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();

        var supplierId = GuidHelper.NewId();
        var ingredientAId = GuidHelper.NewId();
        var ingredientBId = GuidHelper.NewId();
        var dishId = GuidHelper.NewId();

        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-DEMO", WarehouseName = "Kho demo", WarehouseType = "DRY" });
        context.Suppliers.Add(new Supplier { SupplierId = supplierId, SupplierCode = "SUP-DEMO", SupplierName = "NCC Demo", IsActive = true });
        // Ingredient A: reference 100, avg receipt price 150 -> variance 50%
        context.Ingredients.Add(new Ingredient { IngredientId = ingredientAId, IngredientCode = "ING-A", IngredientName = "Nguyên liệu A", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        // Ingredient B: reference 100, avg receipt price 110 -> variance 10%
        context.Ingredients.Add(new Ingredient { IngredientId = ingredientBId, IngredientCode = "ING-B", IngredientName = "Nguyên liệu B", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Dishes.Add(new Dish { DishId = dishId, DishCode = "DISH-DEMO", DishName = "Món demo", DishGroup = "Món chính", IsActive = true });
        // A dùng ít (weight 1), B dùng nhiều (weight 9) trong cùng món -> trung bình có trọng số phải lệch về phía B
        context.Dishboms.Add(new DishBom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientAId, UnitId = fixture.UnitId, GrossQtyPerServing = 1, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });
        context.Dishboms.Add(new DishBom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientBId, UnitId = fixture.UnitId, GrossQtyPerServing = 9, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });

        var receiptId = GuidHelper.NewId();
        context.Inventoryreceipts.Add(new InventoryReceipt
        {
            ReceiptId = receiptId,
            ReceiptCode = "PN-DEMO",
            ReceiptDate = new DateOnly(2026, 6, 1),
            WarehouseId = fixture.WarehouseId,
            SupplierId = supplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            Inventoryreceiptlines =
            [
                new InventoryReceiptLine { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientAId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 150 },
                new InventoryReceiptLine { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientBId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 110 }
            ]
        });

        await context.SaveChangesAsync();

        var service = new PriceVarianceReportService(context);
        var result = await service.GetPriceVarianceByDishGroupAsync(new WorkflowReportQueryDto());

        var group = result.Should().ContainSingle(g => g.DishGroup == "Món chính").Subject;
        group.IngredientCount.Should().Be(2);
        // Trọng số theo BOM: (1*50 + 9*10) / (1+9) = 14, khác hẳn trung bình cộng đơn giản (50+10)/2 = 30
        group.WeightedAvgVariancePercent.Should().Be(14);
    }

    [Fact]
    public async Task GetReceiptPriceVariancePageAsync_Should_SearchByVisibleReceiptIdentity()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierId = GuidHelper.NewId();
        var targetIngredientId = GuidHelper.NewId();
        var otherIngredientId = GuidHelper.NewId();

        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-PRICE", WarehouseName = "Kho giá", WarehouseType = "DRY" });
        context.Suppliers.Add(new Supplier { SupplierId = supplierId, SupplierCode = "SUP-SEARCH", SupplierName = "Nhà cung cấp tìm kiếm", IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = targetIngredientId, IngredientCode = "BUN-TUOI", IngredientName = "Bún tươi", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 10_000, IsFreshDaily = true, IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = otherIngredientId, IngredientCode = "GAO-TE", IngredientName = "Gạo tẻ", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 20_000, IsFreshDaily = false, IsActive = true });
        context.Inventoryreceipts.AddRange(
            new InventoryReceipt
            {
                ReceiptId = GuidHelper.NewId(), ReceiptCode = "PN-TARGET-001", ReceiptDate = new DateOnly(2026, 7, 29),
                WarehouseId = fixture.WarehouseId, SupplierId = supplierId, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
                Inventoryreceiptlines = [new InventoryReceiptLine { ReceiptLineId = GuidHelper.NewId(), IngredientId = targetIngredientId, UnitId = fixture.UnitId, Quantity = 12, UnitPrice = 11_000 }]
            },
            new InventoryReceipt
            {
                ReceiptId = GuidHelper.NewId(), ReceiptCode = "PN-OTHER-001", ReceiptDate = new DateOnly(2026, 7, 28),
                WarehouseId = fixture.WarehouseId, SupplierId = supplierId, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow,
                Inventoryreceiptlines = [new InventoryReceiptLine { ReceiptLineId = GuidHelper.NewId(), IngredientId = otherIngredientId, UnitId = fixture.UnitId, Quantity = 20, UnitPrice = 21_000 }]
            });
        await context.SaveChangesAsync();

        var service = new PriceVarianceReportService(context);
        var byReceipt = await service.GetReceiptPriceVariancePageAsync(new ReceiptPriceVariancePageQueryDto
        {
            PageNumber = 1,
            PageSize = 20,
            SearchKeyword = "PN-TARGET"
        });
        var byIngredient = await service.GetReceiptPriceVariancePageAsync(new ReceiptPriceVariancePageQueryDto
        {
            PageNumber = 1,
            PageSize = 20,
            SearchKeyword = "Bún tươi"
        });

        byReceipt.Items.Should().ContainSingle().Which.ReceiptCode.Should().Be("PN-TARGET-001");
        byIngredient.Items.Should().ContainSingle().Which.IngredientName.Should().Be("Bún tươi");
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_ExcludeOverduePurchaseRequest_WhenAlreadyFullyReceivedViaPurchaseOrder()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierId = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierId, "NCC KPI");

        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        // PR 1: quá hạn (PurchaseForDate đã qua) và ĐÃ nhận đủ hàng qua PO -> không tính là quá hạn nữa
        var resolvedPrId = GuidHelper.NewId();
        var resolvedLineId = GuidHelper.NewId();
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = resolvedPrId,
            PurchaseRequestCode = $"PR-RESOLVED-{GuidHelper.ToGuidString(resolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new PurchaseRequestLine
                {
                    PurchaseRequestLineId = resolvedLineId,
                    PurchaseRequestId = resolvedPrId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 5,
                    CurrentStockQty = 0,
                    PurchaseQty = 5,
                    EstimatedUnitPrice = 1000
                }
            ]
        });
        context.Purchaseorders.Add(new PurchaseOrder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-RESOLVED",
            PurchaseRequestId = resolvedPrId,
            SupplierId = supplierId,
            OrderDate = yesterday,
            Status = "RECEIVED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Purchaseorderlines =
            [
                new PurchaseOrderLine { PurchaseOrderLineId = GuidHelper.NewId(), PurchaseRequestLineId = resolvedLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, OrderedQty = 5, ReceivedQty = 5, UnitPrice = 1000 }
            ]
        });

        // PR 2: quá hạn và CHƯA từng tạo PO -> vẫn tính là quá hạn
        var unresolvedPrId = GuidHelper.NewId();
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = unresolvedPrId,
            PurchaseRequestCode = $"PR-UNRESOLVED-{GuidHelper.ToGuidString(unresolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new PurchaseRequestLine
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = unresolvedPrId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 3,
                    CurrentStockQty = 0,
                    PurchaseQty = 3,
                    EstimatedUnitPrice = 1000
                }
            ]
        });

        await context.SaveChangesAsync();

        var service = new OperationalKpiReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.OverduePurchaseRequestCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountLateReceipt_OnlyBeyondThreeDayThreshold()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierId = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierId, "NCC KPI 2");
        var prId = GuidHelper.NewId();
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = prId,
            PurchaseRequestCode = $"PR-LATE-{GuidHelper.ToGuidString(prId)[..8]}",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = "APPROVED",
            CreatedBy = fixture.UserId
        });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Đặt hàng 4 ngày trước (vượt ngưỡng 3 ngày) -> trễ
        context.Purchaseorders.Add(new PurchaseOrder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-LATE",
            PurchaseRequestId = prId,
            SupplierId = supplierId,
            OrderDate = today.AddDays(-4),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        // Đặt hàng 1 ngày trước (chưa tới ngưỡng) -> chưa trễ
        context.Purchaseorders.Add(new PurchaseOrder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-NOT-LATE",
            PurchaseRequestId = prId,
            SupplierId = supplierId,
            OrderDate = today.AddDays(-1),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new OperationalKpiReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.LateReceiptCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountLowStock_UsingAverageDailyDemandOverLast7Days()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        var gramUnitId = GuidHelper.NewId();
        context.Units.Add(new Unit { UnitId = gramUnitId, UnitCode = "G", UnitName = "Gram", BaseUnitCode = "KG", ConvertRateToBase = 0.001m });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-KPI", WarehouseName = "Kho KPI", WarehouseType = "DRY" });

        var lowStockIngredientId = GuidHelper.NewId();
        var healthyStockIngredientId = GuidHelper.NewId();
        var mixedUnitIngredientId = GuidHelper.NewId();
        context.Ingredients.Add(new Ingredient { IngredientId = lowStockIngredientId, IngredientCode = "ING-LOW", IngredientName = "NL tồn thấp", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = healthyStockIngredientId, IngredientCode = "ING-OK", IngredientName = "NL tồn ổn", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = mixedUnitIngredientId, IngredientCode = "ING-MIXED", IngredientName = "NL đa đơn vị", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });

        // Nhu cầu trung bình 7 ngày: 70 / 7 = 10 mỗi ngày cho mỗi nguyên liệu
        var planId = GuidHelper.NewId();
        var requestId = GuidHelper.NewId();
        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = requestId,
            RequestCode = "MR-KPI",
            PlanId = planId,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1),
            RequestScope = "FULLDAY",
            Status = "CONFIRMED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new MaterialRequestLine { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 },
                new MaterialRequestLine { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 },
                new MaterialRequestLine { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = mixedUnitIngredientId, UnitId = gramUnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 7000, CurrentStockQty = 0, SuggestedPurchaseQty = 0 }
            ]
        });

        // Tồn kho hiện tại: NL tồn thấp chỉ còn 5 (< 10/ngày) -> tồn thấp; NL tồn ổn còn 50 (>= 10/ngày) -> không tính
        context.Currentstocks.Add(new CurrentStock { WarehouseId = fixture.WarehouseId, IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 5, LastUpdated = DateTime.UtcNow });
        context.Currentstocks.Add(new CurrentStock { WarehouseId = fixture.WarehouseId, IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 50, LastUpdated = DateTime.UtcNow });
        context.Currentstocks.Add(new CurrentStock { WarehouseId = fixture.WarehouseId, IngredientId = mixedUnitIngredientId, UnitId = fixture.UnitId, CurrentQty = 5, LastUpdated = DateTime.UtcNow });

        await context.SaveChangesAsync();

        var service = new OperationalKpiReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.LowStockCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountShortageExcludingCancelled_AndPendingKitchenConfirmation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-KPI2", WarehouseName = "Kho KPI 2", WarehouseType = "DRY" });
        context.Ingredients.Add(new Ingredient { IngredientId = fixture.IngredientId, IngredientCode = "ING-SHORT", IngredientName = "NL thiếu", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });

        var activeRequestId = GuidHelper.NewId();
        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = activeRequestId,
            RequestCode = "MR-ACTIVE",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "CONFIRMED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new MaterialRequestLine { RequestLineId = GuidHelper.NewId(), RequestId = activeRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        var cancelledRequestId = GuidHelper.NewId();
        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = cancelledRequestId,
            RequestCode = "MR-CANCELLED",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new MaterialRequestLine { RequestLineId = GuidHelper.NewId(), RequestId = cancelledRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "IX-PENDING",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = activeRequestId,
            IssuedBy = fixture.UserId,
            ReceivedBy = null,
            CreatedAt = DateTime.UtcNow
        });
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "IX-CONFIRMED",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = activeRequestId,
            IssuedBy = fixture.UserId,
            ReceivedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new OperationalKpiReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.ShortageCount.Should().Be(1);
        kpis.PendingKitchenConfirmationCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_SurfaceProductionMonitoringAlerts()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-MON", WarehouseName = "Kho giám sát", WarehouseType = "DRY" });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = fixture.IngredientId,
            IngredientCode = "ING-MON",
            IngredientName = "Nguyên liệu giám sát",
            UnitId = fixture.UnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 100,
            IsFreshDaily = false,
            IsActive = true
        });

        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-FAILED",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "FAILED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = "PR-OVERDUE-APPROVAL",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2),
            PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1),
            Status = "SENTTOSUPPLIER",
            CreatedBy = fixture.UserId
        });
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = -1,
            LastUpdated = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new OperationalKpiReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.FailedWorkflowCount.Should().Be(1);
        kpis.CriticalDataQualityCount.Should().BeGreaterThan(0);
        kpis.OverdueApprovalCount.Should().Be(1);
    }

    [Fact]
    [Trait("Category", "Performance")]
    public async Task DemandAndPurchase_Should_StayBounded_ForMultiCustomerWeek()
    {
        const int customerCount = 12;
        const int ingredientCount = 12;
        var queryCounter = new SelectCommandCounter();
        await using var fixture = await WorkflowFixture.CreateAsync(queryCounter);
        await fixture.SeedPerformanceWeekAsync(customerCount, ingredientCount);

        queryCounter.Reset();
        var stopwatch = Stopwatch.StartNew();
        var demandLineCount = 0;
        var purchaseLineCount = 0;

        await using var context = fixture.CreateContext();
        var demandService = new MaterialDemandService(context);
        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var weekStart = new DateOnly(2026, 8, 3);
        for (var dayOffset = 0; dayOffset < 7; dayOffset++)
        {
            var serviceDate = weekStart.AddDays(dayOffset).ToString("yyyy-MM-dd");
            var demand = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = serviceDate, Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();
            demandLineCount += demand!.Lines.Count;
            await ApproveDemandAsync(context, demand.MaterialRequestId);

            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
                fixture.UserIdString);
            purchase.Should().NotBeNull();
            purchaseLineCount += purchase!.Lines.Count;
        }

        stopwatch.Stop();

        demandLineCount.Should().Be(customerCount * ingredientCount * 7);
        purchaseLineCount.Should().Be(demandLineCount);
        queryCounter.SelectCount.Should().BeLessThan(
            120,
            "generation must batch lookups instead of issuing SELECT queries per shortage line");
        stopwatch.Elapsed.Should().BeLessThan(
            TimeSpan.FromSeconds(10),
            "a representative multi-customer week should remain usable over a LAN deployment");
    }

    [Fact]
    [Trait("Category", "Performance")]
    public async Task PurchasePlan_Should_StayBounded_WhenDemandHistorySpansManyYears()
    {
        var queryCounter = new SelectCommandCounter();
        await using var fixture = await WorkflowFixture.CreateAsync(queryCounter);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var planLineId = GuidHelper.NewId();
        var menuId = await context.Menus.Select(menu => menu.MenuId).SingleAsync();
        context.Productionplanlines.Add(new ProductionPlanLine
        {
            PlanLineId = planLineId,
            PlanId = fixture.ProductionPlanId,
            QuantityPlanLineId = await context.Mealquantityplanlines.Select(line => line.QuantityPlanLineId).SingleAsync(),
            CustomerId = fixture.CustomerId,
            MenuId = menuId,
            DishId = fixture.DishWithBomId,
            ShiftName = "MORNING",
            TotalServings = 100
        });

        for (var year = 2023; year <= 2030; year++)
        {
            for (var month = 1; month <= 12; month++)
            {
                var requestDate = new DateOnly(year, month, 1);
                var requestId = GuidHelper.NewId();
                context.Materialrequests.Add(new MaterialRequest
                {
                    RequestId = requestId,
                    RequestCode = $"MR-HISTORY-{year}{month:00}",
                    PlanId = fixture.ProductionPlanId,
                    RequestDate = requestDate,
                    RequestScope = "FULLDAY",
                    Status = "CONFIRMED",
                    CreatedBy = fixture.UserId,
                    Materialrequestlines =
                    [
                        new MaterialRequestLine
                        {
                            RequestLineId = GuidHelper.NewId(),
                            RequestId = requestId,
                            PlanLineId = planLineId,
                            IngredientId = fixture.IngredientId,
                            UnitId = fixture.UnitId,
                            PriceTierAmount = 25000,
                            BomScope = "global",
                            TotalServings = 100,
                            GrossQtyPerServing = 1,
                            BomRatePercent = 100,
                            TotalRequiredQty = year == 2028 && month == 6 ? 88m : 1m,
                            CurrentStockQty = 0,
                            SuggestedPurchaseQty = year == 2028 && month == 6 ? 88m : 1m
                        }
                    ]
                });
            }
        }
        await context.SaveChangesAsync();

        queryCounter.Reset();
        var stopwatch = Stopwatch.StartNew();
        var rows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2028-06-01",
            DateTo = "2028-06-30",
            GroupBy = "day",
            Limit = 100
        });
        stopwatch.Stop();

        var row = rows.Should().ContainSingle().Subject;
        row.PeriodKey.Should().Be("2028-06-01");
        row.RequiredQty.Should().Be(88m);
        row.SuggestedPurchaseQty.Should().Be(88m);
        queryCounter.SelectCount.Should().BeLessThan(
            20,
            "purchase-plan reports must filter by date in SQL even when years of history exist");
        stopwatch.Elapsed.Should().BeLessThan(
            TimeSpan.FromSeconds(3),
            "a single-month purchase plan should stay responsive when historical demand accumulates");
    }

}
