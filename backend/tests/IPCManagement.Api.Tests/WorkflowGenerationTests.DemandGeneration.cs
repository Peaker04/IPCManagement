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
    public async Task GenerateDemand_Should_CreateDemandLines_ForHappyPath()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.RequestCode.Should().Be("MR-CUS-20260615-FULLDAY");
        result.Status.Should().Be("DRAFT");
        result.MissingBomDishes.Should().BeEmpty();
        result.MissingConversionIssues.Should().BeEmpty();
        result.ProductionPlanLineCount.Should().Be(1);

        var line = result.Lines.Should().ContainSingle().Subject;
        line.DishName.Should().Be("Dish with BOM");
        line.IngredientName.Should().Be("Ingredient");
        line.TotalServings.Should().Be(100);
        line.GrossQtyPerServing.Should().Be(2m);
        line.TotalRequiredQty.Should().Be(200m);
        line.SuggestedPurchaseQty.Should().Be(200m);

        (await context.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Productionplanlines.AsNoTracking().CountAsync()).Should().Be(1);
        var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item => item.BusinessArea == "Demand");
        audit.NewValue.Should().Be("1 demand lines; 0 missing BOM dishes; 0 missing unit conversions");
    }

    [Fact]
    public async Task GenerateDemand_Should_ReturnEachPersistedDemandLineOnce_WhenMenuRepeatsDish()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var existingItem = await context.Menuitems.AsNoTracking().SingleAsync();
        context.Menuitems.Add(new MenuItem
        {
            MenuItemId = GuidHelper.NewId(),
            MenuId = existingItem.MenuId,
            DishId = existingItem.DishId,
            DishSlot = "duplicate-option",
            DisplayOrder = existingItem.DisplayOrder + 1
        });
        await context.SaveChangesAsync();

        var result = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().ContainSingle();
        (await context.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item => item.BusinessArea == "Demand");
        audit.NewValue.Should().StartWith("1 demand lines;");
    }

    [Fact]
    public async Task GenerateDemand_Should_ReportMissingBom_And_WriteDemandAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().ContainSingle();
        result.MissingBomDishes.Should().ContainSingle(item => item.DishCode == "DISH-MISSING");

        var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item => item.BusinessArea == "Demand");
        audit.NewValue.Should().Contain("1 demand lines");
        audit.NewValue.Should().Contain("1 missing BOM dishes");
    }

    [Fact]
    public async Task GenerateDemand_Should_Ignore_Draft_BomLines()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var setupContext = fixture.CreateContext())
        {
            var bom = await setupContext.Dishboms.SingleAsync();
            bom.BomStatus = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().BeEmpty();
        result.MissingBomDishes.Should().ContainSingle(item => item.DishCode == "DISH-BOM");
    }

    [Fact]
    public async Task GenerateDemand_Should_PruneStaleDemandAndProductionLines_OnRegenerate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var demand = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();
            await ApproveDemandAsync(context, demand!.MaterialRequestId);

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
                fixture.UserIdString);
            purchase.Should().NotBeNull();
            purchase!.Lines.Should().ContainSingle();

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "DRAFT";
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var menuItem = await context.Menuitems.SingleAsync(item => item.DishId == fixture.DishWithBomId);
            context.Menuitems.Remove(menuItem);
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var result = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            result!.Lines.Should().BeEmpty();
            result.MissingBomDishes.Should().ContainSingle();
            var demandLineCount = await context.Materialrequestlines.AsNoTracking().CountAsync();
            var productionLineCount = await context.Productionplanlines.AsNoTracking().CountAsync();
            var purchaseLineCount = await context.Purchaserequestlines.AsNoTracking().CountAsync();
            var staleBomProductionLines = await context.Productionplanlines.AsNoTracking()
                .CountAsync(item => item.DishId == fixture.DishWithBomId);

            demandLineCount.Should().Be(0);
            productionLineCount.Should().Be(1);
            purchaseLineCount.Should().Be(0);
            staleBomProductionLines.Should().Be(0);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_BlockRecalculation_WhenPurchaseOrderReferencesDemand()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            await ApproveDemandAsync(context, demand!.MaterialRequestId);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
                fixture.UserIdString);
            await SelectDefaultSupplierAsync(context, fixture, purchase!);
            var purchaseLine = await context.Purchaserequestlines.SingleAsync();

            context.Purchaseorders.Add(new PurchaseOrder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-DEMAND-LOCK",
                PurchaseRequestId = GuidHelper.ParseGuidString(purchase!.PurchaseRequestId)!,
                SupplierId = purchaseLine.SupplierId!,
                OrderDate = new DateOnly(2026, 6, 15),
                Status = "ORDERED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Purchaseorderlines =
                [
                    new PurchaseOrderLine
                    {
                        PurchaseOrderLineId = GuidHelper.NewId(),
                        PurchaseRequestLineId = purchaseLine.PurchaseRequestLineId,
                        IngredientId = purchaseLine.IngredientId,
                        UnitId = purchaseLine.UnitId,
                        OrderedQty = purchaseLine.PurchaseQty,
                        ReceivedQty = 0,
                        UnitPrice = purchaseLine.EstimatedUnitPrice
                    }
                ]
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var menuItem = await context.Menuitems.SingleAsync();
            context.Menuitems.Remove(menuItem);
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var act = () => service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("Không thể tính lại nhu cầu đã phát sinh đơn mua hàng*");
            (await context.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Purchaseorderlines.AsNoTracking().CountAsync()).Should().Be(1);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_BlockRecalculation_WhenInventoryIssueReferencesDemand()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequestId = GuidHelper.ParseGuidString(demand!.MaterialRequestId)!;
            context.Inventoryissues.Add(new InventoryIssue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = "ISS-DEMAND-LOCK",
                IssueDate = new DateOnly(2026, 6, 15),
                WarehouseId = fixture.WarehouseId,
                MaterialRequestId = materialRequestId,
                IssuedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using var recalculationContext = fixture.CreateContext();
        var act = () => new MaterialDemandService(recalculationContext).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Không thể tính lại nhu cầu đã phát sinh phiếu xuất kho*");
        var staleness = await new MaterialDemandService(recalculationContext).GetStalenessAsync(
            "2026-06-15",
            GuidHelper.ToGuidString((await recalculationContext.Customers.AsNoTracking().SingleAsync()).CustomerId),
            "FULLDAY");
        staleness.CanRegenerate.Should().BeFalse();
        staleness.RegenerationBlockReason.Should().Contain("phiếu xuất kho");
        staleness.MaterialRequestId.Should().NotBeNullOrWhiteSpace();
        staleness.RequestCode.Should().Be("MR-CUS-20260615-FULLDAY");
        staleness.Status.Should().Be("DRAFT");
        (await recalculationContext.Materialrequests.AsNoTracking().CountAsync()).Should().Be(1);
        (await recalculationContext.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task GenerateDemand_Should_PreserveApprovedDemand_AndRequireExplicitRecalculationVersion()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await SeedApprovedDemandWithPurchaseRequestAsync(fixture, "DRAFT");

        await using var context = fixture.CreateContext();
        var act = () => new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Không thể tính lại nhu cầu đã được duyệt*");
        (await context.Materialrequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be("MANAGERAPPROVED");
        (await context.Purchaserequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be("DRAFT");
        (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Auditlogs.AsNoTracking().AnyAsync(audit =>
            audit.BusinessArea == "Demand" &&
            audit.FieldName == nameof(MaterialRequest.Status) &&
            audit.OldValue == "MANAGERAPPROVED" &&
            audit.NewValue == "DRAFT")).Should().BeFalse();
    }

    [Theory]
    [InlineData("SENTTOSUPPLIER")]
    [InlineData("APPROVED")]
    [InlineData("CANCELLED")]
    public async Task GenerateDemand_Should_BlockRecalculation_WhenPurchaseRequestIsNotDraft(string purchaseStatus)
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await SeedApprovedDemandWithPurchaseRequestAsync(fixture, purchaseStatus);

        await using (var context = fixture.CreateContext())
        {
            var act = () => new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage($"*đề xuất mua hàng*{purchaseStatus}*");
        }

        await using var verificationContext = fixture.CreateContext();
        (await verificationContext.Materialrequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be("MANAGERAPPROVED");
        (await verificationContext.Materialrequestlines.AsNoTracking().Select(line => line.TotalRequiredQty).SingleAsync())
            .Should().Be(200m);
        (await verificationContext.Purchaserequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be(purchaseStatus);
        (await verificationContext.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task GenerateDemand_Should_BlockRecalculation_WhenCancelledPurchaseOrderPreservesHistory()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await SeedApprovedDemandWithPurchaseRequestAsync(fixture, "APPROVED");

        await using (var context = fixture.CreateContext())
        {
            var purchaseRequest = await context.Purchaserequests.SingleAsync();
            var purchaseLine = await context.Purchaserequestlines.SingleAsync();
            context.Purchaseorders.Add(new PurchaseOrder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-CANCELLED-DEMAND-LOCK",
                PurchaseRequestId = purchaseRequest.PurchaseRequestId,
                SupplierId = purchaseLine.SupplierId!,
                OrderDate = new DateOnly(2026, 6, 15),
                Status = "CANCELLED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Purchaseorderlines =
                [
                    new PurchaseOrderLine
                    {
                        PurchaseOrderLineId = GuidHelper.NewId(),
                        PurchaseRequestLineId = purchaseLine.PurchaseRequestLineId,
                        IngredientId = purchaseLine.IngredientId,
                        UnitId = purchaseLine.UnitId,
                        OrderedQty = purchaseLine.PurchaseQty,
                        ReceivedQty = 0,
                        UnitPrice = purchaseLine.EstimatedUnitPrice
                    }
                ]
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var act = () => new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("Không thể tính lại nhu cầu đã phát sinh đơn mua hàng*");
        }

        await using var verificationContext = fixture.CreateContext();
        (await verificationContext.Materialrequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be("MANAGERAPPROVED");
        (await verificationContext.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        (await verificationContext.Purchaseorderlines.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task GenerateDemand_Should_RejectApprovedSnapshotBeforeDraftPurchaseInvalidation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await SeedApprovedDemandWithPurchaseRequestAsync(fixture, "DRAFT");

        await using (var context = fixture.CreateContext())
        {
            var act = () => new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("Không thể tính lại nhu cầu đã được duyệt. Hãy tạo phiên bản tính lại riêng.");
        }

        await using var verificationContext = fixture.CreateContext();
        (await verificationContext.Materialrequests.AsNoTracking().Select(request => request.Status).SingleAsync())
            .Should().Be("MANAGERAPPROVED");
        (await verificationContext.Materialrequestlines.AsNoTracking().Select(line => line.TotalRequiredQty).SingleAsync())
            .Should().Be(200m);
        (await verificationContext.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_RemoveStalePurchaseLines_WhenDemandNoLongerShort()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demandService = new MaterialDemandService(context);
            var demand = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            await ApproveDemandAsync(context, materialRequestId);

            var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            purchase!.Lines.Should().ContainSingle();
        }

        await using (var context = fixture.CreateContext())
        {
            var requestLine = await context.Materialrequestlines.SingleAsync();
            requestLine.CurrentStockQty = requestLine.TotalRequiredQty;
            requestLine.SuggestedPurchaseQty = 0;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            purchase!.Lines.Should().BeEmpty();
            var purchaseLineCount = await context.Purchaserequestlines.AsNoTracking().CountAsync();
            purchaseLineCount.Should().Be(0);
            var latestAudit = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "Purchasing")
                .OrderByDescending(item => item.ChangedAt)
                .FirstAsync();
            latestAudit.NewValue.Should().Be("0 shortage lines; 0 purchase lines");
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_ConvertCurrentStock_ToBomUnit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var gramUnitId = GuidHelper.NewId();
            context.Units.Add(new Unit
            {
                UnitId = gramUnitId,
                UnitCode = "G",
                UnitName = "gram",
                BaseUnitCode = "KG",
                ConvertRateToBase = 0.001m
            });
            context.Currentstocks.Add(new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = gramUnitId,
                CurrentQty = 150000m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var result = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            var line = result!.Lines.Single();
            line.TotalRequiredQty.Should().Be(200m);
            line.CurrentStockQty.Should().Be(150m);
            line.SuggestedPurchaseQty.Should().Be(50m);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_NotDuplicateHeaderOrLines_WhenRunAgain()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var setupContext = fixture.CreateContext())
        {
            setupContext.Currentstocks.Add(new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 25m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await setupContext.SaveChangesAsync();
        }

        string firstRequestId;
        string firstLineId;
        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var demand = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            firstRequestId = demand!.MaterialRequestId;
            var line = demand.Lines.Should().ContainSingle().Subject;
            firstLineId = line.MaterialRequestLineId;
            line.TotalServings.Should().Be(100);
            line.GrossQtyPerServing.Should().Be(2m);
            line.TotalRequiredQty.Should().Be(200m);
            line.CurrentStockQty.Should().Be(25m);
            line.SuggestedPurchaseQty.Should().Be(175m);
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var demand = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            demand!.MaterialRequestId.Should().Be(firstRequestId);
            demand.ProductionPlanLineCount.Should().Be(1);
            demand.Lines.Should().ContainSingle()
                .Which.MaterialRequestLineId.Should().Be(firstLineId);

            var requestCount = await context.Materialrequests.AsNoTracking().CountAsync();
            var requestLineCount = await context.Materialrequestlines.AsNoTracking().CountAsync();
            var productionLineCount = await context.Productionplanlines.AsNoTracking().CountAsync();

            requestCount.Should().Be(1);
            requestLineCount.Should().Be(1);
            productionLineCount.Should().Be(1);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_ReportMissingConversion_WhenStockUnitCannotConvertToBomUnit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var boxUnitId = GuidHelper.NewId();
            context.Units.Add(new Unit
            {
                UnitId = boxUnitId,
                UnitCode = "BOX",
                UnitName = "box",
                BaseUnitCode = "BOX",
                ConvertRateToBase = 1
            });
            context.Currentstocks.Add(new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = boxUnitId,
                CurrentQty = 10m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var result = await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            var line = result!.Lines.Single();
            line.TotalRequiredQty.Should().Be(200m);
            line.CurrentStockQty.Should().Be(0m);
            line.SuggestedPurchaseQty.Should().Be(200m);
            result.MissingConversionIssues.Should().ContainSingle(issue =>
                issue.IngredientId == fixture.IngredientIdString &&
                issue.SourceUnitName == "box" &&
                issue.TargetUnitName == "kg");
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_PreferCustomerBomOverride_ForMatchingPriceTier()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            context.Dishboms.Add(new DishBom
            {
                BomId = GuidHelper.NewId(),
                DishId = fixture.DishWithBomId,
                CustomerId = fixture.CustomerId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                PriceTierAmount = 25000,
                GrossQtyPerServing = 3,
                WasteRatePercent = 0,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2026, 1, 1)
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var result = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            result!.MissingBomDishes.Should().BeEmpty();
            var line = result.Lines.Should().ContainSingle().Subject;
            line.PriceTierAmount.Should().Be(25000);
            line.BomScope.Should().Be("customer");
            line.GrossQtyPerServing.Should().Be(3);
            line.TotalRequiredQty.Should().Be(300);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_FallbackToGlobalBom_ForMatchingPriceTier_WhenNoCustomerOverride()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var schedule = await context.Menuschedules.SingleAsync();
            schedule.MenuPrice = 30000;
            var bom = await context.Dishboms.SingleAsync();
            bom.PriceTierAmount = 30000;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var result = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            result!.MissingBomDishes.Should().BeEmpty();
            var line = result.Lines.Should().ContainSingle().Subject;
            line.PriceTierAmount.Should().Be(30000);
            line.BomScope.Should().Be("global");
            line.TotalRequiredQty.Should().Be(200);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_UseEffectiveBomVersion_WhenDataSpansMultipleYears()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        var nextYearBomId = GuidHelper.NewId();
        await using (var setupContext = fixture.CreateContext())
        {
            var schedule = await setupContext.Menuschedules.SingleAsync();
            schedule.ServiceDate = new DateOnly(2027, 1, 2);
            schedule.WeekStartDate = new DateOnly(2026, 12, 28);

            var quantityPlan = await setupContext.Mealquantityplans.SingleAsync();
            quantityPlan.ServiceDate = new DateOnly(2027, 1, 2);
            quantityPlan.PlanCode = "QTY-20270102";

            var existingBom = await setupContext.Dishboms.SingleAsync();
            existingBom.EffectiveFrom = new DateOnly(2026, 1, 1);
            existingBom.EffectiveTo = new DateOnly(2026, 12, 31);

            setupContext.Dishboms.Add(new DishBom
            {
                BomId = nextYearBomId,
                DishId = fixture.DishWithBomId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                PriceTierAmount = 25000,
                GrossQtyPerServing = 3,
                WasteRatePercent = 0,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2027, 1, 1)
            });

            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var result = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest
            {
                ServiceDate = "2027-01-02",
                Scope = "FULLDAY"
            },
            fixture.UserIdString);

        var line = result!.Lines.Should().ContainSingle().Subject;
        line.BomId.Should().Be(GuidHelper.ToGuidString(nextYearBomId));
        line.GrossQtyPerServing.Should().Be(3m);
        line.TotalRequiredQty.Should().Be(300m);
        result.RequestCode.Should().Be("MR-CUS-20270102-FULLDAY");

        var savedPlan = await context.Productionplans.AsNoTracking()
            .SingleAsync(plan => plan.PlanCode == "KHSX-CUS-20270102-FULLDAY");
        savedPlan.WeekStartDate.Should().Be(new DateOnly(2026, 12, 28));
    }

    [Fact]
    public async Task GenerateDemand_Should_ReportMissingBom_WhenOnlyExpiredBomExists()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var setupContext = fixture.CreateContext())
        {
            var existingBom = await setupContext.Dishboms.SingleAsync();
            existingBom.EffectiveFrom = new DateOnly(2025, 1, 1);
            existingBom.EffectiveTo = new DateOnly(2025, 12, 31);
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var result = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest
            {
                ServiceDate = "2026-06-15",
                Scope = "FULLDAY"
            },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().BeEmpty();
        result.MissingBomDishes.Should().ContainSingle(issue =>
            issue.DishCode == "DISH-BOM" &&
            issue.Message.Contains("đang hiệu lực"));
        (await context.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GenerateDemand_Should_BlockNonStandardMenuPrice_InsteadOfChoosingNearestTier()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var schedule = await context.Menuschedules.SingleAsync();
            schedule.MenuPrice = 26000;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var act = () => new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("*25000/30000/34000*");
        }
    }

}
