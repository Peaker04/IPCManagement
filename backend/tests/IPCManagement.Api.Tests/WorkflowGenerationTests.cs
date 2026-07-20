using FluentAssertions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.DTOs.ProductionPlan;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Approvals;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.Api.Services.Workflow;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;

namespace IPCManagement.Api.Tests;

public class WorkflowGenerationTests
{
    [Fact]
    public async Task GetIngredientDemandAggregatePageAsync_Should_GroupDemandByIngredientAndDate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new WorkflowReportService(reportContext).GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15",
                PageNumber = 1,
                PageSize = 1,
            });

        page.TotalCount.Should().Be(1);
        page.Items.Should().ContainSingle();
        page.Items[0].RequestDate.Should().Be(new DateOnly(2026, 6, 15));
        page.Items[0].TotalRequiredQty.Should().Be(200m);
        page.Items[0].LineCount.Should().Be(1);
    }

    [Fact]
    public async Task GetMaterialRequestCandidatePageAsync_Should_PagePurchaseCandidatesBeyondOneHundredRequests()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var planLineId = await context.Productionplanlines.Select(line => line.PlanLineId).SingleAsync();
            for (var index = 1; index <= 105; index++)
            {
                var requestId = GuidHelper.NewId();
                context.Materialrequests.Add(new Materialrequest
                {
                    RequestId = requestId,
                    RequestCode = $"MR-PAGED-{index:000}",
                    PlanId = fixture.ProductionPlanId,
                    RequestDate = new DateOnly(2026, 6, 15).AddDays(index),
                    RequestScope = "FULLDAY",
                    Status = "DRAFT",
                    CreatedBy = fixture.UserId,
                    Materialrequestlines =
                    [
                        new Materialrequestline
                        {
                            RequestLineId = GuidHelper.NewId(),
                            RequestId = requestId,
                            PlanLineId = planLineId,
                            IngredientId = fixture.IngredientId,
                            UnitId = fixture.UnitId,
                            TotalServings = 1,
                            GrossQtyPerServing = 1,
                            BomRatePercent = 100,
                            TotalRequiredQty = 1,
                            CurrentStockQty = 0,
                            SuggestedPurchaseQty = 1,
                        },
                    ],
                });
            }

            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new WorkflowReportService(reportContext).GetMaterialRequestCandidatePageAsync(
            new MaterialRequestCandidatePageQueryDto
            {
                Purpose = "purchase",
                PageNumber = 2,
                PageSize = 100,
            });

        page.TotalCount.Should().Be(106);
        page.Items.Should().HaveCount(6);
        page.HasPrev.Should().BeTrue();
        page.HasNext.Should().BeFalse();
        page.Items.Should().OnlyContain(item => item.ActionableLineCount == 1 && item.ActionableQuantity > 0);
    }

    [Fact]
    public async Task GetMaterialRequestCandidatePageAsync_Should_ReturnOnlyApprovedUnissuedRequestsForWarehouse()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var request = await context.Materialrequests.SingleAsync();
            request.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new WorkflowReportService(reportContext).GetMaterialRequestCandidatePageAsync(
            new MaterialRequestCandidatePageQueryDto
            {
                Purpose = "issue",
                PageNumber = 1,
                PageSize = 8,
            });

        var candidate = page.Items.Should().ContainSingle().Subject;
        candidate.Status.Should().Be("MANAGERAPPROVED");
        candidate.ActionableQuantity.Should().Be(200m);
    }

    [Fact]
    public async Task GenerateDemand_Should_CreateDemandLines_ForHappyPath()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
    public async Task GenerateDemand_Should_ReportMissingBom_And_WriteDemandAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchase.Should().NotBeNull();
            purchase!.Lines.Should().ContainSingle();
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            var purchaseLine = await context.Purchaserequestlines.SingleAsync();

            context.Purchaseorders.Add(new Purchaseorder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-DEMAND-LOCK",
                PurchaseRequestId = GuidHelper.ParseGuidString(purchase!.PurchaseRequestId)!,
                SupplierId = purchaseLine.SupplierId,
                OrderDate = new DateOnly(2026, 6, 15),
                Status = "ORDERED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Purchaseorderlines =
                [
                    new Purchaseorderline
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Không thể tính lại nhu cầu đã phát sinh đơn mua hàng*");
            (await context.Materialrequestlines.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Purchaseorderlines.AsNoTracking().CountAsync()).Should().Be(1);
        }
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
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
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
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
            context.Currentstocks.Add(new Currentstock
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
            setupContext.Currentstocks.Add(new Currentstock
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
            context.Currentstocks.Add(new Currentstock
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
            context.Dishboms.Add(new Dishbom
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
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

            setupContext.Dishboms.Add(new Dishbom
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
            new GenerateMaterialDemandRequestDto
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
            new GenerateMaterialDemandRequestDto
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*25000/30000/34000*");
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_ConvertLatestReceiptPrice_ToDemandUnit()
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
            context.Inventoryreceipts.Add(new Inventoryreceipt
            {
                ReceiptId = GuidHelper.NewId(),
                ReceiptCode = "NK-GRAM",
                ReceiptDate = new DateOnly(2026, 6, 14),
                WarehouseId = fixture.WarehouseId,
                SupplierId = fixture.SupplierId,
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                Inventoryreceiptlines =
                [
                    new Inventoryreceiptline
                    {
                        ReceiptLineId = GuidHelper.NewId(),
                        IngredientId = fixture.IngredientId,
                        UnitId = gramUnitId,
                        Quantity = 1000m,
                        UnitPrice = 10m,
                        Amount = 10000m
                    }
                ]
            });
            await context.SaveChangesAsync();
        }

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            purchase!.Lines.Should().ContainSingle();
            purchase.Lines.Single().EstimatedUnitPrice.Should().Be(10000m);
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_AssignOnlyActiveSupplier_ToEveryLine()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        var inactiveSupplierId = GuidHelper.NewId();
        await using (var context = fixture.CreateContext())
        {
            context.Suppliers.Add(new Supplier
            {
                SupplierId = inactiveSupplierId,
                SupplierCode = "SUP-INACTIVE",
                SupplierName = "Inactive Supplier",
                IsActive = false
            });
            context.Inventoryreceipts.Add(new Inventoryreceipt
            {
                ReceiptId = GuidHelper.NewId(),
                ReceiptCode = "NK-INACTIVE-SUPPLIER",
                ReceiptDate = new DateOnly(2026, 6, 14),
                WarehouseId = fixture.WarehouseId,
                SupplierId = inactiveSupplierId,
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                Inventoryreceiptlines =
                [
                    new Inventoryreceiptline
                    {
                        ReceiptLineId = GuidHelper.NewId(),
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        Quantity = 10m,
                        UnitPrice = 900m,
                        Amount = 9000m
                    }
                ]
            });
            await context.SaveChangesAsync();
        }

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            var line = purchase!.Lines.Should().ContainSingle().Subject;
            line.SupplierId.Should().Be(GuidHelper.ToGuidString(fixture.SupplierId));
            line.SupplierId.Should().NotBe(GuidHelper.ToGuidString(inactiveSupplierId));

            var savedLine = await context.Purchaserequestlines
                .Include(item => item.Supplier)
                .AsNoTracking()
                .SingleAsync();
            savedLine.Supplier.IsActive.Should().BeTrue();
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_Block_WhenNoActiveSupplierAvailable()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var supplier = await context.Suppliers.SingleAsync();
            supplier.IsActive = false;
            await context.SaveChangesAsync();
        }

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Chưa có nhà cung cấp để tạo đề xuất mua cho 'Ingredient'.");

            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(0);
        }
    }

    [Fact]
    public async Task UpdatePurchaseRequestLine_Should_SaveSupplierPriceDeliveryNote_AndAuditActor()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        var newSupplierId = GuidHelper.NewId();
        await using (var context = fixture.CreateContext())
        {
            context.Suppliers.Add(new Supplier
            {
                SupplierId = newSupplierId,
                SupplierCode = "SUP-ALT",
                SupplierName = "Alternate Supplier",
                IsActive = true
            });
            await context.SaveChangesAsync();
        }

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            await service.UpdateLineSupplierAsync(
                purchaseRequestId,
                purchaseRequestLineId,
                new UpdatePurchaseRequestLineSupplierDto
                {
                    SupplierId = GuidHelper.ToGuidString(newSupplierId),
                    EstimatedUnitPrice = 12345.678m,
                    ExpectedDeliveryDate = "2026-06-16",
                    Note = "Giao trước 9h"
                },
                fixture.UserIdString);

            var savedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
            savedLine.SupplierId.Should().Equal(newSupplierId);
            savedLine.EstimatedUnitPrice.Should().Be(12345.68m);
            savedLine.ExpectedDeliveryDate.Should().Be(new DateOnly(2026, 6, 16));
            savedLine.Note.Should().Be("Giao trước 9h");

            var audit = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "Purchasing" && item.FieldName == "SupplierPriceDelivery")
                .SingleAsync();
            audit.ChangedBy.Should().Equal(fixture.UserId);
            audit.EntityId.Should().Equal(savedLine.PurchaseRequestLineId);
            audit.OldValue.Should().Contain(GuidHelper.ToGuidString(fixture.SupplierId));
            audit.NewValue.Should().Contain(GuidHelper.ToGuidString(newSupplierId));
            audit.NewValue.Should().Contain("price=12345.68");
            audit.NewValue.Should().Contain("delivery=2026-06-16");
            audit.NewValue.Should().Contain("note=Giao trước 9h");
        }
    }

    [Fact]
    public async Task PurchaseRequestApproval_Should_Block_WhenLinePriceExceedsWarningThreshold()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            await service.UpdateLineSupplierAsync(
                purchaseRequestId,
                purchaseRequestLineId,
                new UpdatePurchaseRequestLineSupplierDto
                {
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    EstimatedUnitPrice = 1200m
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            var reportLine = (await new WorkflowReportService(context).GetPurchaseDemandAsync(new WorkflowReportQueryDto
            {
                Limit = 100
            })).Single();

            reportLine.ReferenceUnitPrice.Should().Be(1000m);
            reportLine.PriceVariancePercent.Should().Be(20m);
            reportLine.IsPriceWarning.Should().BeTrue();

            var handler = new PurchaseRequestApprovalHandler(context);
            var act = async () => await handler.HandleAsync(
                purchaseRequestId,
                new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Approve PR" },
                fixture.UserId);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi duyệt.");

            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
            (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_RequireApprovedDemand_AndPersistSubmittedStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var submitted = await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);
            submitted.Should().NotBeNull();
            submitted!.Status.Should().Be("SENTTOSUPPLIER");
            submitted.Lines.Should().ContainSingle();

            var savedStatus = await context.Purchaserequests.AsNoTracking()
                .Select(item => item.Status)
                .SingleAsync();
            savedStatus.Should().Be("SENTTOSUPPLIER");

            var audit = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "Purchasing" && item.FieldName == "Submit")
                .SingleAsync();
            audit.OldValue.Should().Be("DRAFT");
            audit.NewValue.Should().Be("SENTTOSUPPLIER");
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var submittedAgain = await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);
            submittedAgain.Should().NotBeNull();
            submittedAgain!.Status.Should().Be("SENTTOSUPPLIER");

            var submitAuditCount = await context.Auditlogs.AsNoTracking()
                .CountAsync(item => item.BusinessArea == "Purchasing" && item.FieldName == "Submit");
            submitAuditCount.Should().Be(1);
        }

        await using (var context = fixture.CreateContext())
        {
            var materialLine = await context.Materialrequestlines.SingleAsync();
            materialLine.SuggestedPurchaseQty = 0;
            await context.SaveChangesAsync();

            var regenerated = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            regenerated.Should().NotBeNull();
            regenerated!.Status.Should().Be("SENTTOSUPPLIER");
            regenerated.Lines.Should().ContainSingle();
            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_Block_WhenDemandNotApprovedOrStale()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Cần duyệt nhu cầu nguyên liệu trước khi gửi đơn mua.");
        }

        await using (var context = fixture.CreateContext())
        {
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            var materialLine = await context.Materialrequestlines.SingleAsync();
            materialLine.SuggestedPurchaseQty = 0;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_Block_WhenLineInvalid()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var purchaseLine = await context.Purchaserequestlines.SingleAsync();
            purchaseLine.EstimatedUnitPrice = 0;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Có dòng mua thiếu số lượng hoặc giá dự kiến hợp lệ.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_Block_WhenSupplierInactive()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var supplier = await context.Suppliers.SingleAsync(item => item.SupplierId == fixture.SupplierId);
            supplier.IsActive = false;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Có dòng mua chưa chọn nhà cung cấp hợp lệ.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_Block_WhenPriceVarianceExceedsThreshold()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            await service.UpdateLineSupplierAsync(
                purchaseRequestId,
                purchaseRequestLineId,
                new UpdatePurchaseRequestLineSupplierDto
                {
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    EstimatedUnitPrice = 1200m
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi gửi đơn mua.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
        }
    }

    [Fact]
    public async Task CreateInventoryReceiptFromPurchase_Should_CreateReceipt_IncreaseStock_AndMarkPurchaseReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchaseService = CreatePurchaseRequestWorkflowService(context);
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
            purchaseRequestId = purchase.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreateInventoryReceiptService(context);
            var result = await service.CreateFromPurchaseRequestAsync(new CreateInventoryReceiptFromPurchaseDto
            {
                PurchaseRequestId = purchaseRequestId,
                ReceiptDate = new DateOnly(2026, 6, 15),
                SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                Lines =
                [
                    new CreateInventoryReceiptFromPurchaseLineDto
                    {
                        PurchaseRequestLineId = purchaseRequestLineId,
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        ReceivedQty = 200m,
                        LotNumber = "LOT-001",
                        ExpiredDate = new DateOnly(2026, 6, 30)
                    }
                ]
            }, fixture.UserIdString);

            result.Should().NotBeNull();
            var receipt = await context.Inventoryreceipts
                .Include(item => item.Inventoryreceiptlines)
                .AsNoTracking()
                .SingleAsync();
            receipt.PurchaseRequestId.Should().NotBeNull();
            receipt.PurchaseRequestId!.Should().Equal(GuidHelper.ParseGuidString(purchaseRequestId)!);
            receipt.Inventoryreceiptlines.Should().ContainSingle();
            receipt.Inventoryreceiptlines.Single().Quantity.Should().Be(200m);
            receipt.Inventoryreceiptlines.Single().LotNumber.Should().Be("LOT-001");

            var currentStock = await context.Currentstocks.AsNoTracking().SingleAsync();
            currentStock.CurrentQty.Should().Be(200m);

            var movement = await context.Stockmovements.AsNoTracking().SingleAsync();
            movement.MovementType.Should().Be("RECEIPT");
            movement.QuantityIn.Should().Be(200m);

            var purchaseStatus = await context.Purchaserequests.AsNoTracking()
                .Select(item => item.Status)
                .SingleAsync();
            purchaseStatus.Should().Be("RECEIVED");

            var audit = await context.Auditlogs.AsNoTracking()
                .SingleAsync(item => item.BusinessArea == "Receipt" && item.FieldName == nameof(Purchaserequest.Status));
            audit.OldValue.Should().Be("SENTTOSUPPLIER");
            audit.NewValue.Should().Be("RECEIVED");
        }
    }

    [Fact]
    public async Task CreateInventoryIssue_Should_AutoBuildLinesFromApprovedDemand_AndDecreaseStock()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 250m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreateInventoryIssueService(context);
            var result = await service.CreateAsync(new CreateInventoryIssueDto
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId
            }, fixture.UserIdString);

            result.Should().NotBeNull();
            var issueLine = await context.Inventoryissuelines.AsNoTracking().SingleAsync();
            issueLine.RequestedQty.Should().Be(200m);
            issueLine.IssuedQty.Should().Be(200m);

            var currentStock = await context.Currentstocks.AsNoTracking().SingleAsync();
            currentStock.CurrentQty.Should().Be(50m);

            var movement = await context.Stockmovements.AsNoTracking().SingleAsync();
            movement.QuantityOut.Should().Be(200m);
            movement.MovementType.Should().Be("ISSUE");
        }
    }

    [Fact]
    public async Task ConfirmInventoryIssueReceipt_Should_MarkKitchenReceipt_AndCreateDiscrepancyIssue()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 250m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        string issueId;
        await using (var context = fixture.CreateContext())
        {
            var issueService = CreateInventoryIssueService(context);
            var created = await issueService.CreateAsync(new CreateInventoryIssueDto
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId
            }, fixture.UserIdString);
            issueId = created!.IssueId;

            var beforeConfirm = await new WorkflowReportService(context).GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 10 });
            beforeConfirm.Should().ContainSingle().Which.Should().Match<KitchenIssueReportDto>(row =>
                row.IsReceivedByKitchen == false &&
                row.ReceivedAt == null &&
                row.ReceiptStatus == "Chờ bếp nhận");
        }

        await using (var context = fixture.CreateContext())
        {
            var issueService = CreateInventoryIssueService(context);
            var confirmed = await issueService.ConfirmReceiptAsync(
                issueId,
                new ConfirmInventoryIssueReceiptDto
                {
                    HasDiscrepancy = true,
                    DiscrepancyNote = "Bếp nhận thiếu 2 kg so với phiếu xuất."
                },
                fixture.UserIdString);

            confirmed.Should().NotBeNull();
            confirmed!.ReceivedBy.Should().Be(fixture.UserIdString);
            confirmed.ReceivedAt.Should().NotBeNull();
            confirmed.Lines.Should().ContainSingle();

            var issue = await context.Inventoryissues.AsNoTracking().SingleAsync();
            issue.ReceivedBy.Should().Equal(fixture.UserId);
            issue.ReceivedAt.Should().NotBeNull();

            var auditFields = await context.Auditlogs
                .AsNoTracking()
                .Where(item => item.BusinessArea == "KitchenReceipt")
                .Select(item => item.FieldName)
                .ToListAsync();
            auditFields.Should().BeEquivalentTo(["KitchenReceived", "KitchenReceiptDiscrepancy"]);

            var afterConfirm = await new WorkflowReportService(context).GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 10 });
            afterConfirm.Should().ContainSingle().Which.Should().Match<KitchenIssueReportDto>(row =>
                row.IsReceivedByKitchen &&
                row.ReceivedBy == fixture.UserIdString &&
                row.ReceivedAt != null &&
                row.ReceiptStatus == "Bếp đã nhận");

            var dataQuality = await new WorkflowReportService(context).GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });
            dataQuality.Issues.Should().Contain(issue =>
                issue.Category == "kitchen_receipt_discrepancy" &&
                issue.Message.Contains("Bếp báo chênh lệch"));
        }
    }

    [Fact]
    public async Task InventoryReturnAndWaste_Should_RecordProductionVariance_AndFeedUsageReport()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 300m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        string issueId;
        await using (var context = fixture.CreateContext())
        {
            var issueService = CreateInventoryIssueService(context);
            var created = await issueService.CreateAsync(new CreateInventoryIssueDto
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId
            }, fixture.UserIdString);
            issueId = created!.IssueId;
        }

        await using (var context = fixture.CreateContext())
        {
            var returnService = CreateInventoryReturnService(context);
            var retDto1 = await returnService.CreateAsync(new CreateInventoryReturnDto
            {
                ReturnDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                ReturnType = "RETURN",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                IssueId = issueId,
                Reason = "Bếp trả nguyên liệu dư sau ca sáng.",
                Lines =
                [
                    new CreateInventoryReturnLineDto
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        Quantity = 30m
                    }
                ]
            }, fixture.UserIdString);

            var retDto2 = await returnService.CreateAsync(new CreateInventoryReturnDto
            {
                ReturnDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                ReturnType = "WASTE",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                IssueId = issueId,
                Reason = "Hao hụt sơ chế thực tế.",
                Lines =
                [
                    new CreateInventoryReturnLineDto
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        Quantity = 20m
                    }
                ]
            }, fixture.UserIdString);

            await returnService.ConfirmReceiptAsync(retDto1!.ReturnId, new ConfirmInventoryReturnReceiptDto(), fixture.UserIdString);
            await returnService.ConfirmReceiptAsync(retDto2!.ReturnId, new ConfirmInventoryReturnReceiptDto(), fixture.UserIdString);

            var returnTypes = await context.Inventoryreturns
                .AsNoTracking()
                .OrderBy(item => item.ReturnCode)
                .Select(item => item.ReturnType)
                .ToListAsync();
            returnTypes.Should().BeEquivalentTo(["RETURN", "WASTE"]);

            (await context.Currentstocks.AsNoTracking().Select(item => item.CurrentQty).SingleAsync())
                .Should().Be(130m);
            var movementTypes = await context.Stockmovements
                .AsNoTracking()
                .OrderBy(item => item.MovementDate)
                .Select(item => item.MovementType)
                .ToListAsync();
            movementTypes.Should().BeEquivalentTo(["ISSUE", "RETURN"]);

            var varianceAudit = await context.Auditlogs.AsNoTracking()
                .SingleAsync(item => item.BusinessArea == "ProductionWaste" && item.FieldName == "WasteQuantity");
            varianceAudit.NewValue.Should().Be("20");
            varianceAudit.Reason.Should().Contain("Hao hụt sơ chế thực tế");

            var usage = await new WorkflowReportService(context).GetIssueVsReturnAsync(new WorkflowReportQueryDto { Limit = 10 });
            var row = usage.Should().ContainSingle().Subject;
            row.IssuedQty.Should().Be(200m);
            row.ReturnedQty.Should().Be(30m);
            row.WastedQty.Should().Be(20m);
            row.VarianceQty.Should().Be(50m);
            row.UsedQty.Should().Be(150m);
        }
    }

    [Fact]
    public async Task CreateInventoryIssue_Should_Block_WhenLineExceedsDemandRemaining()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 300m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            context.Inventoryissues.Add(new Inventoryissue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = "PX-OLD",
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = fixture.WarehouseId,
                MaterialRequestId = materialRequest.RequestId,
                IssuedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                Inventoryissuelines =
                [
                    new Inventoryissueline
                    {
                        IssueLineId = GuidHelper.NewId(),
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        RequestedQty = 195m,
                        IssuedQty = 195m
                    }
                ]
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreateInventoryIssueService(context);
            var act = async () => await service.CreateAsync(new CreateInventoryIssueDto
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId,
                Lines =
                [
                    new CreateInventoryIssueLineDto
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        RequestedQty = 10m,
                        IssuedQty = 10m
                    }
                ]
            }, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*vượt nhu cầu còn lại*");
            (await context.Inventoryissues.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Currentstocks.AsNoTracking().Select(item => item.CurrentQty).SingleAsync())
                .Should().Be(300m);
        }
    }

    [Fact]
    public async Task CreateInventoryIssue_Should_ReturnStockShortageIssue_WhenStockIsInsufficient()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 50m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreateInventoryIssueService(context);
            var act = async () => await service.CreateAsync(new CreateInventoryIssueDto
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId
            }, fixture.UserIdString);

            var exception = await act.Should().ThrowAsync<StockShortageException>();
            var shortage = exception.Which.Shortage;
            shortage.MaterialRequestId.Should().Be(materialRequestId);
            shortage.IssueDate.Should().Be(new DateOnly(2026, 6, 15));
            var line = shortage.Lines.Should().ContainSingle().Subject;
            line.IngredientName.Should().Be("Ingredient");
            line.RequiredQty.Should().Be(200m);
            line.AvailableQty.Should().Be(50m);
            line.MissingQty.Should().Be(150m);
            shortage.SuggestedAction.Should().Be("Vui lòng tạo yêu cầu mua hàng (Purchase Request) bổ sung cho các nguyên liệu bị thiếu.");

            (await context.Inventoryissues.AsNoTracking().CountAsync()).Should().Be(0);
            (await context.Stockmovements.AsNoTracking().CountAsync()).Should().Be(0);
            (await context.Currentstocks.AsNoTracking().Select(item => item.CurrentQty).SingleAsync())
                .Should().Be(50m);

            var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item => item.BusinessArea == "StockException");
            audit.FieldName.Should().Be("StockShortage");
            audit.NewValue.Should().Contain("missing=150");

            var report = await new WorkflowReportService(context).GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 100 });
            report.Issues.Should().Contain(issue =>
                issue.Category == "stock_shortage" &&
                issue.Message.Contains("Thiếu tồn kho Ingredient"));
        }
    }

    [Fact]
    public async Task WarehouseUat_Should_KeepStockLedgerBalanced_AndRollbackFailedWarehouseActions()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchaseService = CreatePurchaseRequestWorkflowService(context);
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

            purchaseRequestId = purchase.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var receiptService = CreateInventoryReceiptService(context);
            var overReceipt = async () => await receiptService.CreateFromPurchaseRequestAsync(
                new CreateInventoryReceiptFromPurchaseDto
                {
                    PurchaseRequestId = purchaseRequestId,
                    ReceiptDate = new DateOnly(2026, 6, 15),
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    Lines =
                    [
                        new CreateInventoryReceiptFromPurchaseLineDto
                        {
                            PurchaseRequestLineId = purchaseRequestLineId,
                            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                            ReceivedQty = 201m
                        }
                    ]
                },
                fixture.UserIdString);

            await overReceipt.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*vượt số còn lại*");
            (await context.Inventoryreceipts.AsNoTracking().CountAsync()).Should().Be(0);
            (await context.Stockmovements.AsNoTracking().CountAsync()).Should().Be(0);
            (await context.Currentstocks.AsNoTracking().CountAsync()).Should().Be(0);
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("SENTTOSUPPLIER");
        }

        await using (var context = fixture.CreateContext())
        {
            var receiptService = CreateInventoryReceiptService(context);
            await receiptService.CreateFromPurchaseRequestAsync(
                new CreateInventoryReceiptFromPurchaseDto
                {
                    PurchaseRequestId = purchaseRequestId,
                    ReceiptDate = new DateOnly(2026, 6, 15),
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    Lines =
                    [
                        new CreateInventoryReceiptFromPurchaseLineDto
                        {
                            PurchaseRequestLineId = purchaseRequestLineId,
                            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                            ReceivedQty = 200m,
                            LotNumber = "UAT-LOT"
                        }
                    ]
                },
                fixture.UserIdString);

            var materialRequestBytes = GuidHelper.ParseGuidString(materialRequestId)!;
            var materialRequest = await context.Materialrequests
                .SingleAsync(item => item.RequestId == materialRequestBytes);
            materialRequest.Status = "SENTTOWAREHOUSE";
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var issueService = CreateInventoryIssueService(context);
            await issueService.CreateAsync(
                new CreateInventoryIssueDto
                {
                    IssueDate = new DateOnly(2026, 6, 15),
                    ShiftName = "MORNING",
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    MaterialRequestId = materialRequestId,
                    Lines =
                    [
                        new CreateInventoryIssueLineDto
                        {
                            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                            RequestedQty = 150m,
                            IssuedQty = 150m
                        }
                    ]
                },
                fixture.UserIdString);

            var shortageRequestId = GuidHelper.NewId();
            context.Materialrequests.Add(new Materialrequest
            {
                RequestId = shortageRequestId,
                RequestCode = "MR-UAT-SHORTAGE",
                PlanId = fixture.ProductionPlanId,
                RequestDate = new DateOnly(2026, 6, 15),
                RequestScope = "FULLDAY",
                Status = "SENTTOWAREHOUSE",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = GuidHelper.NewId(),
                        RequestId = shortageRequestId,
                        PlanLineId = GuidHelper.NewId(),
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        TotalServings = 1,
                        GrossQtyPerServing = 75m,
                        BomRatePercent = 100m,
                        AppliedPortionRatePercent = 100m,
                        AppliedPortionRuleSource = "UAT",
                        TotalRequiredQty = 75m,
                        CurrentStockQty = 50m,
                        SuggestedPurchaseQty = 25m
                    }
                ]
            });
            await context.SaveChangesAsync();

            var shortage = async () => await issueService.CreateAsync(
                new CreateInventoryIssueDto
                {
                    IssueDate = new DateOnly(2026, 6, 15),
                    ShiftName = "AFTERNOON",
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    MaterialRequestId = GuidHelper.ToGuidString(shortageRequestId)
                },
                fixture.UserIdString);

            var exception = await shortage.Should().ThrowAsync<StockShortageException>();
            exception.Which.Shortage.Lines.Should().ContainSingle(line =>
                line.RequiredQty == 75m &&
                line.AvailableQty == 50m &&
                line.MissingQty == 25m);
            exception.Which.Shortage.SuggestedAction.Should().Be("Vui lòng tạo yêu cầu mua hàng (Purchase Request) bổ sung cho các nguyên liệu bị thiếu.");

            (await context.Inventoryreceipts.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Inventoryissues.AsNoTracking().CountAsync()).Should().Be(1);
            (await context.Stockmovements.AsNoTracking().CountAsync()).Should().Be(2);
            (await context.Currentstocks.AsNoTracking().Select(item => item.CurrentQty).SingleAsync())
                .Should().Be(50m);
            (await context.Currentstocks.AsNoTracking().AnyAsync(item => item.CurrentQty < 0))
                .Should().BeFalse();

            var reconciliation = await new WorkflowReportService(context).GetStockLedgerReconciliationAsync(
                new WorkflowReportQueryDto
                {
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                    Limit = 10
                });
            var row = reconciliation.Should().ContainSingle().Subject;
            row.CurrentQty.Should().Be(50m);
            row.LedgerQty.Should().Be(50m);
            row.DifferenceQty.Should().Be(0m);
            row.IsMatched.Should().BeTrue();
        }
    }

    [Fact]
    public async Task ApprovalInbox_Should_FilterPendingItems_ByApproverRole()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

        materialRequest.Status = "SENTTOWAREHOUSE";
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-PENDING",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = materialRequest.RequestId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new Inventoryissueline
                {
                    IssueLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    RequestedQty = 4,
                    IssuedQty = 4
                }
            ]
        });
        var quantityLineId = await context.Mealquantityplanlines
            .Select(item => item.QuantityPlanLineId)
            .SingleAsync();
        context.Quantityadjustments.Add(new Quantityadjustment
        {
            AdjustmentId = GuidHelper.NewId(),
            QuantityPlanLineId = quantityLineId,
            OldServings = 100,
            NewServings = 120,
            Reason = "Khách tăng suất",
            AdjustedBy = fixture.UserId,
            AdjustedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>());
        var purchaseInbox = await service.GetPendingAsync(BuildPrincipal("Thu mua"), new ApprovalInboxQueryDto { Limit = 100 });
        var warehouseInbox = await service.GetPendingAsync(BuildPrincipal("Thủ kho"), new ApprovalInboxQueryDto { Limit = 100 });

        purchaseInbox.Select(item => item.ItemType).Should().Contain("purchase");
        purchaseInbox.Select(item => item.ItemType).Should().NotContain(["issue", "adjustment"]);
        purchaseInbox.Should().OnlyContain(item => item.Status == "PENDING");
        purchaseInbox.Single(item => item.ItemType == "purchase").TargetType.Should().Be("purchase-request");

        warehouseInbox.Select(item => item.ItemType).Should().Contain(["issue", "adjustment"]);
        warehouseInbox.Select(item => item.ItemType).Should().NotContain("purchase");
        warehouseInbox.Should().OnlyContain(item => item.Status == "PENDING");
    }

    [Fact]
    public async Task ApprovalInboxCursor_Should_ReplayStableOrdering_WithoutDuplicatesAcrossSources()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
        var alertPurchaseId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = alertPurchaseId,
            PurchaseRequestCode = "PR-CURSOR-ALERT",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = alertPurchaseId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = fixture.SupplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 10,
                    CurrentStockQty = 0,
                    PurchaseQty = 10,
                    EstimatedUnitPrice = 1200m
                }
            ]
        });

        materialRequest.Status = "SENTTOWAREHOUSE";
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-CURSOR",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = materialRequest.RequestId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new Inventoryissueline
                {
                    IssueLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    RequestedQty = 4,
                    IssuedQty = 4
                }
            ]
        });
        var quantityLineId = await context.Mealquantityplanlines
            .Select(item => item.QuantityPlanLineId)
            .SingleAsync();
        context.Quantityadjustments.Add(new Quantityadjustment
        {
            AdjustmentId = GuidHelper.NewId(),
            QuantityPlanLineId = quantityLineId,
            OldServings = 100,
            NewServings = 120,
            Reason = "Khách tăng suất",
            AdjustedBy = fixture.UserId,
            AdjustedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>());
        var expected = await service.GetPendingAsync(BuildPrincipal("Admin"), new ApprovalInboxQueryDto { Limit = 200 });
        expected.Select(item => item.ItemType).Should().Contain(["purchase", "price-alert", "issue", "adjustment"]);
        var actualIds = new List<string>();
        string? cursor = null;

        for (var pageNumber = 0; pageNumber < expected.Count + 1; pageNumber++)
        {
            var page = await service.GetPendingPageAsync(
                BuildPrincipal("Admin"),
                new ApprovalInboxQueryDto { Limit = 1, Cursor = cursor });
            actualIds.AddRange(page.Items.Select(item => item.InboxItemId));
            if (!page.HasNext)
            {
                break;
            }

            page.NextCursor.Should().NotBeNullOrWhiteSpace();
            cursor = page.NextCursor;
        }

        actualIds.Should().OnlyHaveUniqueItems();
        actualIds.Should().Equal(expected.Select(item => item.InboxItemId));
    }

    [Fact]
    public async Task ApprovalInbox_Should_SurfacePriceAlerts_AsPendingPurchaseApprovalItems()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            await CreatePurchaseRequestWorkflowService(context).UpdateLineSupplierAsync(
                purchaseRequestId,
                purchaseRequestLineId,
                new UpdatePurchaseRequestLineSupplierDto
                {
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    EstimatedUnitPrice = 1200m
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
                .GetPendingAsync(BuildPrincipal("Thu mua"), new ApprovalInboxQueryDto { Limit = 100 });

            var alert = inbox.Should().ContainSingle(item => item.ItemType == "price-alert").Subject;
            alert.TargetType.Should().Be("purchase-request");
            alert.TargetId.Should().Be(purchaseRequestId);
            alert.Tone.Should().Be("danger");
            alert.Materials.Should().ContainSingle(item => item.Name == "Ingredient" && item.Quantity == 200m);
        }
    }

    [Fact]
    public async Task ApprovalDecision_Should_WriteActorTimestampReason_AndUpdateDownstreamStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await CreatePurchaseRequestWorkflowService(context).SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
            purchaseRequestId = purchase.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
            var before = DateTime.UtcNow.AddSeconds(-1);
            var result = await service.ExecuteAsync(
                "purchase-request",
                purchaseRequestId,
                new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Đủ điều kiện mua" },
                fixture.UserIdString);
            var after = DateTime.UtcNow.AddSeconds(1);

            result.Should().NotBeNull();
            result!.OldStatus.Should().Be("SENTTOSUPPLIER");
            result.NewStatus.Should().Be("APPROVED");
            result.ActionAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);

            var purchaseStatus = await context.Purchaserequests.AsNoTracking()
                .Select(item => item.Status)
                .SingleAsync();
            purchaseStatus.Should().Be("APPROVED");

            var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
            history.TargetType.Should().Be("purchase-request");
            history.ActionBy.Should().Equal(fixture.UserId);
            history.Reason.Should().Be("Đủ điều kiện mua");
            history.ActionAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        }
    }

    [Fact]
    public async Task ApprovalDecision_Should_RequireReason_WhenRejecting()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            GuidHelper.ToGuidString(GuidHelper.NewId()),
            new ApprovalRequestDto { Status = ApprovalDecision.Reject, Reason = " " },
            fixture.UserIdString);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Lý do từ chối không được để trống.");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovalDecision_Should_RejectWithReason_AndUpdateDownstreamStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var result = await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Reject, Reason = "Thiếu báo giá" },
            fixture.UserIdString,
            BuildPrincipal("Thu mua"));

        result.Should().NotBeNull();
        result!.OldStatus.Should().Be("SENTTOSUPPLIER");
        result.NewStatus.Should().Be("REJECTED");

        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("REJECTED");
        var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
        history.Decision.Should().Be("REJECT");
        history.Reason.Should().Be("Thiếu báo giá");
        history.ActionBy.Should().Equal(fixture.UserId);
    }

    [Fact]
    public async Task ApprovalDecision_Should_BlockUnauthorizedApproverRole()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Không đúng quyền" },
            fixture.UserIdString,
            BuildPrincipal("Điều phối"));

        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Không có quyền phê duyệt chứng từ này.");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("SENTTOSUPPLIER");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovalDecision_Should_BlockDoubleApprove_WithoutDuplicateHistory()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Lần đầu" },
            fixture.UserIdString,
            BuildPrincipal("Thu mua"));

        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequestDto { Status = ApprovalDecision.Approve, Reason = "Lần hai" },
            fixture.UserIdString,
            BuildPrincipal("Thu mua"));

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Phiếu này đã được xử lý.");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("APPROVED");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task AuditReport_Should_IncludeImportApprovalReceiptIssueAndSignoffRows()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var materialRequest = await SeedReportDocumentsAsync(context, fixture);
            var customerId = await context.Customers.Select(item => item.CustomerId).SingleAsync();
            context.Menuversions.Add(new Menuversion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = customerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                VersionNo = 1,
                Status = "DRAFT",
                SourceFileName = "THUC DON DEMO.xlsx",
                SourceChecksum = "sha256-demo",
                SourceImportBatch = "MENU-CUS-20260615-V01",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-25),
                UpdatedAt = DateTime.UtcNow.AddMinutes(-25)
            });
            context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow.AddMinutes(-1),
                ChangedBy = fixture.UserId,
                BusinessArea = "Coordination",
                EntityName = nameof(Mealquantityplan),
                EntityId = fixture.QuantityPlanId,
                FieldName = nameof(Mealquantityplan.Status),
                OldValue = "CONFIRMED",
                NewValue = "COMPLETED",
                Reason = "Hoàn tất ca điều phối"
            });
            await context.SaveChangesAsync();

            var service = new WorkflowReportService(context);
            var rows = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 20 });
            var areas = rows.Select(item => item.BusinessArea).ToList();

            areas.Should().Contain(["Import", "Approval", "Receipt", "Issue", "Signoff"]);
            var menuImport = rows.Single(item => item.EntityName == nameof(Menuversion) && item.FieldName == "WeeklyMenu");
            menuImport.OldValue.Should().Be("THUC DON DEMO.xlsx");
            menuImport.NewValue.Should().Be("MENU-CUS-20260615-V01 - DRAFT");
            menuImport.ChangedBy.Should().Be(fixture.UserIdString);
            menuImport.ChangedByName.Should().Be("Workflow Test");
            menuImport.Reason.Should().Be("sha256-demo");
            rows.Single(item => item.BusinessArea == "Issue").OldValue.Should().Be(GuidHelper.ToGuidString(materialRequest.RequestId));
        }
    }

    [Fact]
    public async Task AuditChanges_Should_ReturnCursorPage_AndSupportAscendingSort()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var baseDate = new DateTime(2026, 8, 10, 8, 0, 0, DateTimeKind.Utc);
        context.Auditlogs.AddRange(
            new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = baseDate,
                ChangedBy = fixture.UserId,
                BusinessArea = "Scale",
                EntityName = "Report",
                FieldName = "Newest",
                NewValue = "3"
            },
            new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = baseDate.AddDays(-1),
                ChangedBy = fixture.UserId,
                BusinessArea = "Scale",
                EntityName = "Report",
                FieldName = "Middle",
                NewValue = "2"
            },
            new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = baseDate.AddDays(-2),
                ChangedBy = fixture.UserId,
                BusinessArea = "Scale",
                EntityName = "Report",
                FieldName = "Oldest",
                NewValue = "1"
            });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var firstPage = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-08-01",
            DateTo = "2026-08-31",
            Limit = 2
        });

        firstPage.Items.Select(row => row.FieldName).Should().Equal("Newest", "Middle");
        firstPage.HasNext.Should().BeTrue();
        firstPage.NextCursorDate.Should().NotBeNullOrWhiteSpace();

        var secondPage = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-08-01",
            DateTo = "2026-08-31",
            CursorDate = firstPage.NextCursorDate,
            CursorId = firstPage.NextCursorId,
            Limit = 2
        });

        secondPage.Items.Should().ContainSingle(row => row.FieldName == "Oldest");
        secondPage.HasNext.Should().BeFalse();

        var ascendingPage = await service.GetAuditChangePageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-08-01",
            DateTo = "2026-08-31",
            SortDirection = "asc",
            Limit = 2
        });

        ascendingPage.Items.Select(row => row.FieldName).Should().Equal("Oldest", "Middle");
        ascendingPage.HasNext.Should().BeTrue();
    }

    [Fact]
    public async Task DataQualityReport_Should_GroupMissingBomInvalidUnitNegativeStockAndOrphans()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var badUnitId = GuidHelper.NewId();
        var badIngredientId = GuidHelper.NewId();
        var missingConversionUnitId = GuidHelper.NewId();
        var orphanRequestId = GuidHelper.NewId();
        var orphanPurchaseRequestId = GuidHelper.NewId();
        var orphanIssueId = GuidHelper.NewId();

        var customerId = await context.Customers.Select(customer => customer.CustomerId).SingleAsync();
        var productionPlan = await context.Productionplans.SingleAsync(plan => plan.PlanId == fixture.ProductionPlanId);
        productionPlan.CustomerId = customerId;
        var inactiveSupplier = await context.Suppliers.SingleAsync(supplier => supplier.SupplierId == fixture.SupplierId);
        inactiveSupplier.IsActive = false;

        context.Units.Add(new Unit
        {
            UnitId = badUnitId,
            UnitCode = "",
            UnitName = "Invalid unit",
            ConvertRateToBase = 1
        });
        context.Units.Add(new Unit
        {
            UnitId = missingConversionUnitId,
            UnitCode = "BOX",
            UnitName = "Box",
            BaseUnitCode = "BOX",
            ConvertRateToBase = 1
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = badIngredientId,
            IngredientCode = "ING-BAD-UNIT",
            IngredientName = "Ingredient bad unit",
            UnitId = badUnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 1000,
            IsFreshDaily = false,
            IsActive = true
        });
        context.Currentstocks.Add(new Currentstock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = missingConversionUnitId,
            CurrentQty = -2,
            LastUpdated = DateTime.UtcNow
        });
        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = orphanRequestId,
            RequestCode = "MR-ORPHAN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = orphanPurchaseRequestId,
            PurchaseRequestCode = "PR-ORPHAN",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequestlines.Add(new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = orphanPurchaseRequestId,
            MaterialRequestLineId = GuidHelper.NewId(),
            IngredientId = fixture.IngredientId,
            SupplierId = fixture.SupplierId,
            UnitId = fixture.UnitId,
            RequiredQty = 2,
            CurrentStockQty = 0,
            PurchaseQty = 2,
            EstimatedUnitPrice = 1000
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = orphanIssueId,
            IssueCode = "ISS-ORPHAN",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });

        report.TotalIssues.Should().BeGreaterThanOrEqualTo(5);
        report.ErrorCount.Should().BeGreaterThanOrEqualTo(3);
        report.WarningCount.Should().BeGreaterThanOrEqualTo(3);
        report.MissingBomCount.Should().BeGreaterThanOrEqualTo(1);
        report.InvalidUnitCount.Should().BeGreaterThanOrEqualTo(1);
        report.MissingConversionCount.Should().BeGreaterThanOrEqualTo(1);
        report.NegativeStockCount.Should().Be(1);
        report.OrphanDocumentCount.Should().BeGreaterThanOrEqualTo(3);
        report.UrgentIssueCount.Should().BeGreaterThanOrEqualTo(2);
        report.Issues.Select(issue => issue.Category).Should().Contain([
            "missing_bom",
            "invalid_unit",
            "missing_conversion",
            "negative_stock",
            "missing_contract",
            "missing_supplier",
            "stale_demand",
            "stale_purchase_request",
            "orphan_document"
        ]);
        var missingBomIssue = report.Issues.Single(issue => issue.Category == "missing_bom");
        missingBomIssue.Route.Should().Contain("/admin-data?");
        missingBomIssue.Route.Should().Contain("view=adjustments");
        missingBomIssue.Route.Should().Contain("remediate=missing_bom");
        missingBomIssue.Route.Should().Contain("dishId=");
        missingBomIssue.Route.Should().Contain("serviceDate=2026-06-15");
        missingBomIssue.Owner.Should().Be("Kitchen Admin");
        missingBomIssue.PriorityRank.Should().Be(2);
        missingBomIssue.SlaHours.Should().Be(4);
        missingBomIssue.SlaLabel.Should().Be("P2 / 4h");

        var negativeStockIssue = report.Issues.Single(issue => issue.Category == "negative_stock");
        negativeStockIssue.Owner.Should().Be("Thủ kho");
        negativeStockIssue.PriorityRank.Should().Be(1);
        negativeStockIssue.SlaHours.Should().Be(2);
        negativeStockIssue.SlaLabel.Should().Be("P1 / 2h");

        report.Issues.Should().Contain(issue =>
            issue.Category == "missing_contract" &&
            issue.Owner == "Quản lý vận hành" &&
            issue.PriorityRank == 2);
        report.Issues.Should().Contain(issue =>
            issue.Category == "missing_supplier" &&
            issue.Owner == "Thu mua" &&
            issue.SlaHours == 8);
        report.Issues.Should().Contain(issue =>
            issue.Category == "stale_demand" &&
            issue.Owner == "Điều phối" &&
            issue.SlaHours == 24);
        report.Issues.Should().Contain(issue =>
            issue.Category == "stale_purchase_request" &&
            issue.Owner == "Thu mua" &&
            issue.SlaHours == 24);
    }

    [Fact]
    public async Task DataQualityIssueRemediation_Should_KeepPersistentIssueVisibleAfterResolveAndReopen()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var service = new WorkflowReportService(context);
        var initialReport = await service.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
        var missingBomIssue = initialReport.Issues.Single(issue => issue.Category == "missing_bom");

        await service.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequestDto
        {
            IssueId = missingBomIssue.IssueId,
            Action = "resolve",
            Note = "QA marked fixed"
        }, fixture.UserIdString);

        var resolvedReport = await service.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
        var stillVisibleIssue = resolvedReport.Issues.Single(issue => issue.IssueId == missingBomIssue.IssueId);
        stillVisibleIssue.RemediationStatus.Should().Be("resolved");
        stillVisibleIssue.RemediationNote.Should().Be("QA marked fixed");
        stillVisibleIssue.RemediationByName.Should().Be("Workflow Test");
        resolvedReport.ResolvedIssueCount.Should().Be(1);
        resolvedReport.TotalIssues.Should().Be(initialReport.TotalIssues);

        await service.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequestDto
        {
            IssueId = missingBomIssue.IssueId,
            Action = "reopen",
            Note = "Root cause still exists"
        }, fixture.UserIdString);

        var reopenedReport = await service.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
        var reopenedIssue = reopenedReport.Issues.Single(issue => issue.IssueId == missingBomIssue.IssueId);
        reopenedIssue.RemediationStatus.Should().Be("reopened");
        reopenedIssue.RemediationNote.Should().Be("Root cause still exists");
        reopenedReport.ReopenedIssueCount.Should().Be(1);
        reopenedReport.TotalIssues.Should().Be(initialReport.TotalIssues);
    }

    [Fact]
    public async Task PurchasePlan_Should_ReconcileDayAndWeekTotals_AndSubtractPendingReceipts()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var serviceDate = new DateOnly(2026, 6, 15);
        var nextServiceDate = serviceDate.AddDays(1);
        var firstRequestId = GuidHelper.NewId();
        var secondRequestId = GuidHelper.NewId();
        var firstLineId = GuidHelper.NewId();
        var secondLineId = GuidHelper.NewId();
        var purchaseRequestId = GuidHelper.NewId();
        var purchaseLineId = GuidHelper.NewId();
        var receiptId = GuidHelper.NewId();
        var planLineId = GuidHelper.NewId();
        var menuId = await context.Menus.Select(menu => menu.MenuId).SingleAsync();

        context.Productionplanlines.Add(new Productionplanline
        {
            PlanLineId = planLineId,
            PlanId = fixture.ProductionPlanId,
            QuantityPlanLineId = await context.Mealquantityplanlines.Select(line => line.QuantityPlanLineId).SingleAsync(),
            CustomerId = fixture.CustomerId,
            MenuId = menuId,
            DishId = fixture.DishWithBomId,
            ShiftName = "MORNING",
            TotalServings = 200
        });
        context.Materialrequests.AddRange(
            new Materialrequest
            {
                RequestId = firstRequestId,
                RequestCode = "MR-PURCHASE-DAY-1",
                PlanId = fixture.ProductionPlanId,
                RequestDate = serviceDate,
                RequestScope = "FULLDAY",
                Status = "CONFIRMED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = firstLineId,
                        RequestId = firstRequestId,
                        PlanLineId = planLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        PriceTierAmount = 25000,
                        BomScope = "global",
                        TotalServings = 100,
                        GrossQtyPerServing = 1,
                        BomRatePercent = 100,
                        TotalRequiredQty = 12,
                        CurrentStockQty = 2,
                        SuggestedPurchaseQty = 10
                    }
                ]
            },
            new Materialrequest
            {
                RequestId = secondRequestId,
                RequestCode = "MR-PURCHASE-DAY-2",
                PlanId = fixture.ProductionPlanId,
                RequestDate = nextServiceDate,
                RequestScope = "FULLDAY",
                Status = "CONFIRMED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = secondLineId,
                        RequestId = secondRequestId,
                        PlanLineId = planLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        PriceTierAmount = 25000,
                        BomScope = "global",
                        TotalServings = 100,
                        GrossQtyPerServing = 1,
                        BomRatePercent = 100,
                        TotalRequiredQty = 20,
                        CurrentStockQty = 5,
                        SuggestedPurchaseQty = 15
                    }
                ]
            });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = "PR-PENDING",
            RequestDate = serviceDate,
            PurchaseForDate = serviceDate,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
                {
                    PurchaseRequestLineId = purchaseLineId,
                    PurchaseRequestId = purchaseRequestId,
                    MaterialRequestLineId = firstLineId,
                    IngredientId = fixture.IngredientId,
                    SupplierId = fixture.SupplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 10,
                    CurrentStockQty = 2,
                    PurchaseQty = 10,
                    EstimatedUnitPrice = 1000,
                    ExpectedDeliveryDate = serviceDate
                }
            ]
        });
        context.Inventoryreceipts.Add(new Inventoryreceipt
        {
            ReceiptId = receiptId,
            ReceiptCode = "RC-PARTIAL",
            ReceiptDate = serviceDate,
            WarehouseId = fixture.WarehouseId,
            SupplierId = fixture.SupplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            Inventoryreceiptlines =
            [
                new Inventoryreceiptline
                {
                    ReceiptLineId = GuidHelper.NewId(),
                    ReceiptId = receiptId,
                    PurchaseRequestLineId = purchaseLineId,
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    Quantity = 4,
                    UnitPrice = 1000
                }
            ]
        });
        await context.SaveChangesAsync();

        var dayRows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-06-15",
            DateTo = "2026-06-16",
            GroupBy = "day"
        });
        var weekRows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-06-15",
            DateTo = "2026-06-16",
            GroupBy = "week"
        });

        dayRows.Should().HaveCount(2);
        dayRows.Sum(row => row.RequiredQty).Should().Be(32);
        dayRows.Sum(row => row.SuggestedPurchaseQty).Should().Be(25);
        dayRows.Sum(row => row.PendingReceiptQty).Should().Be(6);
        dayRows.Sum(row => row.ShortageQty).Should().Be(19);

        var weekRow = weekRows.Should().ContainSingle().Subject;
        weekRow.GroupBy.Should().Be("week");
        weekRow.PeriodStart.Should().Be(serviceDate);
        weekRow.PeriodEnd.Should().Be(serviceDate.AddDays(6));
        weekRow.RequiredQty.Should().Be(dayRows.Sum(row => row.RequiredQty));
        weekRow.SuggestedPurchaseQty.Should().Be(dayRows.Sum(row => row.SuggestedPurchaseQty));
        weekRow.PendingReceiptQty.Should().Be(dayRows.Sum(row => row.PendingReceiptQty));
        weekRow.ShortageQty.Should().Be(dayRows.Sum(row => row.ShortageQty));
        weekRows.Select(row => (row.PeriodKey, row.IngredientId, row.UnitId)).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public async Task PurchasePlan_Should_GroupWeekAcrossYearBoundary_WhenDataSpansMultipleYears()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var firstDate = new DateOnly(2027, 12, 31);
        var secondDate = new DateOnly(2028, 1, 1);
        var planLineId = GuidHelper.NewId();
        var firstRequestId = GuidHelper.NewId();
        var secondRequestId = GuidHelper.NewId();
        var menuId = await context.Menus.Select(menu => menu.MenuId).SingleAsync();

        context.Productionplanlines.Add(new Productionplanline
        {
            PlanLineId = planLineId,
            PlanId = fixture.ProductionPlanId,
            QuantityPlanLineId = await context.Mealquantityplanlines.Select(line => line.QuantityPlanLineId).SingleAsync(),
            CustomerId = fixture.CustomerId,
            MenuId = menuId,
            DishId = fixture.DishWithBomId,
            ShiftName = "MORNING",
            TotalServings = 200
        });
        context.Materialrequests.AddRange(
            new Materialrequest
            {
                RequestId = firstRequestId,
                RequestCode = "MR-YEAR-END",
                PlanId = fixture.ProductionPlanId,
                RequestDate = firstDate,
                RequestScope = "FULLDAY",
                Status = "CONFIRMED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = GuidHelper.NewId(),
                        RequestId = firstRequestId,
                        PlanLineId = planLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        PriceTierAmount = 25000,
                        BomScope = "global",
                        TotalServings = 100,
                        GrossQtyPerServing = 1,
                        BomRatePercent = 100,
                        TotalRequiredQty = 40,
                        CurrentStockQty = 10,
                        SuggestedPurchaseQty = 30
                    }
                ]
            },
            new Materialrequest
            {
                RequestId = secondRequestId,
                RequestCode = "MR-NEW-YEAR",
                PlanId = fixture.ProductionPlanId,
                RequestDate = secondDate,
                RequestScope = "FULLDAY",
                Status = "CONFIRMED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
                    {
                        RequestLineId = GuidHelper.NewId(),
                        RequestId = secondRequestId,
                        PlanLineId = planLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        PriceTierAmount = 25000,
                        BomScope = "global",
                        TotalServings = 100,
                        GrossQtyPerServing = 1,
                        BomRatePercent = 100,
                        TotalRequiredQty = 60,
                        CurrentStockQty = 15,
                        SuggestedPurchaseQty = 45
                    }
                ]
            });
        await context.SaveChangesAsync();

        var dayRows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2027-12-31",
            DateTo = "2028-01-01",
            GroupBy = "day"
        });
        var weekRows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2027-12-31",
            DateTo = "2028-01-01",
            GroupBy = "week"
        });

        dayRows.Should().HaveCount(2);
        dayRows.Sum(row => row.RequiredQty).Should().Be(100);
        dayRows.Sum(row => row.SuggestedPurchaseQty).Should().Be(75);

        var weekRow = weekRows.Should().ContainSingle().Subject;
        weekRow.PeriodKey.Should().Be("2027-12-27/2028-01-02");
        weekRow.PeriodStart.Should().Be(new DateOnly(2027, 12, 27));
        weekRow.PeriodEnd.Should().Be(new DateOnly(2028, 1, 2));
        weekRow.RequiredQty.Should().Be(dayRows.Sum(row => row.RequiredQty));
        weekRow.SuggestedPurchaseQty.Should().Be(dayRows.Sum(row => row.SuggestedPurchaseQty));
        weekRow.ShortageQty.Should().Be(dayRows.Sum(row => row.ShortageQty));
    }

    [Fact]
    public async Task PurchasePlan_Should_FilterRequestedRange_WhenHistoricalAndFutureDemandExist()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var planLineId = GuidHelper.NewId();
        var menuId = await context.Menus.Select(menu => menu.MenuId).SingleAsync();
        context.Productionplanlines.Add(new Productionplanline
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

        foreach (var (requestCode, requestDate, requiredQty, suggestedQty) in new[]
        {
            ("MR-2025-OLD", new DateOnly(2025, 12, 31), 10m, 9m),
            ("MR-2026-IN-RANGE", new DateOnly(2026, 6, 15), 20m, 18m),
            ("MR-2027-FUTURE", new DateOnly(2027, 1, 1), 30m, 27m)
        })
        {
            var requestId = GuidHelper.NewId();
            context.Materialrequests.Add(new Materialrequest
            {
                RequestId = requestId,
                RequestCode = requestCode,
                PlanId = fixture.ProductionPlanId,
                RequestDate = requestDate,
                RequestScope = "FULLDAY",
                Status = "CONFIRMED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new Materialrequestline
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
                        TotalRequiredQty = requiredQty,
                        CurrentStockQty = 1,
                        SuggestedPurchaseQty = suggestedQty
                    }
                ]
            });
        }

        await context.SaveChangesAsync();

        var rows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-01-01",
            DateTo = "2026-12-31",
            GroupBy = "day"
        });

        var row = rows.Should().ContainSingle().Subject;
        row.PeriodKey.Should().Be("2026-06-15");
        row.RequiredQty.Should().Be(20m);
        row.SuggestedPurchaseQty.Should().Be(18m);
        rows.Select(item => item.PeriodKey)
            .Should().NotContain(["2025-12-31", "2027-01-01"]);
    }

    [Fact]
    public async Task DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var orphanRequestId = GuidHelper.NewId();
        var stalePurchaseRequestId = GuidHelper.NewId();
        var stalePurchaseRequestLineId = GuidHelper.NewId();
        var activeDraftPurchaseRequestId = GuidHelper.NewId();
        var orphanIssueId = GuidHelper.NewId();

        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = orphanRequestId,
            RequestCode = "MR-CLEANUP-ORPHAN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = stalePurchaseRequestId,
            PurchaseRequestCode = "PR-CLEANUP-STALE",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequestlines.Add(new Purchaserequestline
        {
            PurchaseRequestLineId = stalePurchaseRequestLineId,
            PurchaseRequestId = stalePurchaseRequestId,
            MaterialRequestLineId = GuidHelper.NewId(),
            IngredientId = fixture.IngredientId,
            SupplierId = fixture.SupplierId,
            UnitId = fixture.UnitId,
            RequiredQty = 2,
            CurrentStockQty = 0,
            PurchaseQty = 2,
            EstimatedUnitPrice = 1000
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = activeDraftPurchaseRequestId,
            PurchaseRequestCode = "PR-ACTIVE-DRAFT",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = orphanIssueId,
            IssueCode = "ISS-CLEANUP-ORPHAN",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });
        context.Inventoryissuelines.Add(new Inventoryissueline
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = orphanIssueId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            RequestedQty = 1,
            IssuedQty = 1
        });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var dryRun = await service.CleanupDataQualityAsync(new DataQualityCleanupRequestDto
        {
            DryRun = true,
            Limit = 20
        }, fixture.UserIdString);

        dryRun.DryRun.Should().BeTrue();
        dryRun.TotalActions.Should().BeGreaterThanOrEqualTo(3);
        dryRun.RemovedMaterialRequests.Should().Be(1);
        dryRun.RemovedPurchaseRequests.Should().Be(1);
        dryRun.RemovedPurchaseRequestLines.Should().Be(1);
        dryRun.RemovedInventoryIssues.Should().Be(1);
        dryRun.RemovedInventoryIssueLines.Should().Be(1);
        dryRun.AuditLogCount.Should().Be(0);
        (await context.Materialrequests.AnyAsync(request => request.RequestId == orphanRequestId)).Should().BeTrue();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == stalePurchaseRequestId)).Should().BeTrue();
        (await context.Inventoryissues.AnyAsync(issue => issue.IssueId == orphanIssueId)).Should().BeTrue();

        var applied = await service.CleanupDataQualityAsync(new DataQualityCleanupRequestDto
        {
            DryRun = false,
            Limit = 20,
            Note = "PRD-142 cleanup"
        }, fixture.UserIdString);

        applied.DryRun.Should().BeFalse();
        applied.TotalActions.Should().BeGreaterThanOrEqualTo(3);
        applied.RemovedMaterialRequests.Should().Be(1);
        applied.RemovedPurchaseRequests.Should().Be(1);
        applied.RemovedPurchaseRequestLines.Should().Be(1);
        applied.RemovedInventoryIssues.Should().Be(1);
        applied.RemovedInventoryIssueLines.Should().Be(1);
        applied.AuditLogCount.Should().Be(applied.TotalActions);

        (await context.Materialrequests.AnyAsync(request => request.RequestId == orphanRequestId)).Should().BeFalse();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == stalePurchaseRequestId)).Should().BeFalse();
        (await context.Purchaserequests.AnyAsync(request => request.PurchaseRequestId == activeDraftPurchaseRequestId)).Should().BeTrue();
        (await context.Purchaserequestlines.AnyAsync(line => line.PurchaseRequestLineId == stalePurchaseRequestLineId)).Should().BeFalse();
        (await context.Inventoryissues.AnyAsync(issue => issue.IssueId == orphanIssueId)).Should().BeFalse();
        (await context.Inventoryissuelines.AnyAsync(line => line.IssueId == orphanIssueId)).Should().BeFalse();
        (await context.Auditlogs.CountAsync(log =>
            log.BusinessArea == "DataQuality" &&
            log.FieldName == "Cleanup" &&
            log.Reason != null &&
            log.Reason.Contains("PRD-142 cleanup"))).Should().Be(applied.AuditLogCount);

        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto
        {
            ServiceDate = "2026-06-15",
            Limit = 100
        });
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("MR-CLEANUP-ORPHAN");
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("PR-CLEANUP-STALE");
        report.Issues.Select(issue => issue.EntityCode).Should().NotContain("ISS-CLEANUP-ORPHAN");
    }

    [Fact]
    public async Task StockLedgerReconciliation_Should_ReportCurrentStockMismatch()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new Currentstock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 8m,
            LastUpdated = DateTime.UtcNow,
            RowVersion = DateTime.UtcNow
        });
        context.Stockmovements.Add(new Stockmovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow.AddMinutes(-5),
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            MovementType = "RECEIPT",
            QuantityIn = 10m,
            QuantityOut = 0m,
            PerformedBy = fixture.UserId,
            Reason = "Seed ledger",
            Note = "Ledger should recompute to 10"
        });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var rows = await service.GetStockLedgerReconciliationAsync(new WorkflowReportQueryDto { Limit = 10 });
        var mismatch = rows.Should().ContainSingle().Subject;
        mismatch.CurrentQty.Should().Be(8m);
        mismatch.LedgerQty.Should().Be(10m);
        mismatch.DifferenceQty.Should().Be(-2m);
        mismatch.IsMatched.Should().BeFalse();

        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });
        report.Issues.Should().Contain(issue =>
            issue.Category == "inventory_ledger_mismatch" &&
            issue.Message.Contains("Current stock 8"));
    }

    [Fact]
    public async Task StockSnapshot_Should_GenerateMonthlyOpeningInOutAndClosing_FromLedgerSnapshots()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Stockmovements.AddRange(
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 6, 30, 17, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId
            },
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 7, 5, 8, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 4m,
                BeforeQty = 10m,
                AfterQty = 6m,
                PerformedBy = fixture.UserId
            },
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = new DateTime(2026, 7, 12, 8, 0, 0, DateTimeKind.Utc),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 5m,
                QuantityOut = 0m,
                BeforeQty = 6m,
                AfterQty = 11m,
                PerformedBy = fixture.UserId
            });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var snapshots = await service.GenerateMonthlyStockSnapshotAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            Limit = 10
        });

        var snapshot = snapshots.Should().ContainSingle().Subject;
        snapshot.PeriodMonth.Should().Be(new DateOnly(2026, 7, 1));
        snapshot.OpeningQty.Should().Be(10m);
        snapshot.QuantityIn.Should().Be(5m);
        snapshot.QuantityOut.Should().Be(4m);
        snapshot.ClosingQty.Should().Be(11m);

        var persisted = await context.Stocksnapshots.AsNoTracking().SingleAsync();
        persisted.OpeningQty.Should().Be(10m);
        persisted.QuantityIn.Should().Be(5m);
        persisted.QuantityOut.Should().Be(4m);
        persisted.ClosingQty.Should().Be(11m);
    }

    [Fact]
    public async Task StockMovements_Should_DefaultToRecentDateWindow_AndAllowExplicitHistoryRange()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var oldMovementDate = DateTime.UtcNow.Date.AddDays(-40).AddHours(8);
        var recentMovementDate = DateTime.UtcNow.Date.AddDays(-1).AddHours(8);
        context.Stockmovements.AddRange(
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = oldMovementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId,
                Note = "old"
            },
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = recentMovementDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 2m,
                BeforeQty = 10m,
                AfterQty = 8m,
                PerformedBy = fixture.UserId,
                Note = "recent"
            });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var defaultRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto { Limit = 10 });

        defaultRows.Should().ContainSingle(row => row.Note == "recent");
        defaultRows.Should().NotContain(row => row.Note == "old");

        var filteredRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            MovementType = "issue",
            Limit = 10
        });

        filteredRows.Should().ContainSingle(row => row.Note == "recent");
        filteredRows.Should().OnlyContain(row => row.MovementType == "ISSUE");

        var explicitRows = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = DateOnly.FromDateTime(oldMovementDate).ToString("yyyy-MM-dd"),
            DateTo = DateOnly.FromDateTime(recentMovementDate).ToString("yyyy-MM-dd"),
            Limit = 10
        });

        explicitRows.Select(row => row.Note).Should().BeEquivalentTo("old", "recent");
    }

    [Fact]
    public async Task StockMovements_Should_PageWithCursorDate_WithoutOffset()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var baseDate = new DateTime(2026, 7, 10, 8, 0, 0, DateTimeKind.Utc);
        context.Stockmovements.AddRange(
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RECEIPT",
                QuantityIn = 10m,
                QuantityOut = 0m,
                BeforeQty = 0m,
                AfterQty = 10m,
                PerformedBy = fixture.UserId,
                Note = "newest"
            },
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate.AddDays(-1),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                QuantityIn = 0m,
                QuantityOut = 2m,
                BeforeQty = 10m,
                AfterQty = 8m,
                PerformedBy = fixture.UserId,
                Note = "cursor"
            },
            new Stockmovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = baseDate.AddDays(-2),
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "RETURN",
                QuantityIn = 1m,
                QuantityOut = 0m,
                BeforeQty = 8m,
                AfterQty = 9m,
                PerformedBy = fixture.UserId,
                Note = "older"
            });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var firstPage = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            Limit = 2
        });

        firstPage.Select(row => row.Note).Should().Equal("newest", "cursor");

        var secondPage = await service.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            CursorDate = firstPage.Last().MovementDate.ToString("O"),
            CursorId = firstPage.Last().MovementId,
            Limit = 2
        });

        secondPage.Should().ContainSingle(row => row.Note == "older");
        secondPage.Should().NotContain(row => row.Note == "newest" || row.Note == "cursor");

        var firstCursorPage = await service.GetStockMovementPageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            Limit = 2
        });

        firstCursorPage.Items.Select(row => row.Note).Should().Equal("newest", "cursor");
        firstCursorPage.HasNext.Should().BeTrue();
        firstCursorPage.NextCursorDate.Should().NotBeNullOrWhiteSpace();

        var ascendingCursorPage = await service.GetStockMovementPageAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-07-01",
            DateTo = "2026-07-31",
            SortDirection = "asc",
            Limit = 2
        });

        ascendingCursorPage.Items.Select(row => row.Note).Should().Equal("older", "cursor");
        ascendingCursorPage.HasNext.Should().BeTrue();
    }

    [Fact]
    public async Task CustomerContract_Should_UpdateCustomerContract_AndWriteAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var contracts = await service.GetCustomerContractsAsync();
        var contract = contracts.Should().ContainSingle().Subject;
        contract.ActiveWeekDays.Should().Contain("t2");
        contract.ShiftNames.Should().Contain("MORNING");

        var updated = await service.UpdateCustomerContractAsync(
            contract.CustomerId,
            new UpdateCustomerContractDto
            {
                Note = "No beef on Monday",
                IsActive = false,
                EffectiveFrom = "2026-06-15",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                DefaultMenuPrice = 43000,
                DefaultBomRatePercent = 135
            },
            fixture.UserIdString);

        updated.Should().NotBeNull();
        updated!.Note.Should().Be("No beef on Monday");
        updated.IsActive.Should().BeFalse();
        updated.ContractId.Should().NotBeNullOrWhiteSpace();
        updated.ContractStatus.Should().Be("ACTIVE");
        updated.EffectiveFrom.Should().Be("2026-06-15");
        updated.ActiveWeekDays.Should().Equal("t2");
        updated.ShiftNames.Should().Equal("MORNING");
        updated.DefaultMenuPrice.Should().Be(43000);
        updated.DefaultBomRatePercent.Should().Be(100);

        var contractRow = await context.Customercontracts.AsNoTracking().SingleAsync();
        contractRow.DefaultMenuPrice.Should().Be(43000);
        contractRow.DefaultBomRatePercent.Should().Be(100);
        contractRow.ActiveWeekDays.Should().Be("t2");
        contractRow.ShiftNames.Should().Be("MORNING");

        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        schedule.MenuPrice.Should().Be(43000);
        schedule.BomRatePercent.Should().Be(100);

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .ToListAsync();
        audits.Should().HaveCountGreaterThanOrEqualTo(4);
        audits.Select(item => item.FieldName).Should().Contain([
            nameof(Customer.Note),
            nameof(Customer.IsActive),
            "ContractCreated",
            nameof(Menuschedule.MenuPrice)
        ]);
    }

    [Fact]
    public async Task CustomerContract_Should_CreateCustomerAndContract_AndBlockDuplicateCode()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();

        await using var context = fixture.CreateContext();
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var created = await service.CreateCustomerContractAsync(
            new CreateCustomerContractDto
            {
                CustomerCode = " new ",
                CustomerName = "New Customer",
                Note = "No pork",
                EffectiveFrom = "2026-06-15",
                ActiveWeekDays = ["t2", "t3"],
                ShiftNames = ["MORNING", "AFTERNOON"],
                DefaultMenuPrice = 50000,
                DefaultBomRatePercent = 120
            },
            fixture.UserIdString);

        created.CustomerCode.Should().Be("NEW");
        created.CustomerName.Should().Be("New Customer");
        created.Note.Should().Be("No pork");
        created.ContractId.Should().NotBeNullOrWhiteSpace();
        created.ContractStatus.Should().Be("ACTIVE");
        created.ActiveWeekDays.Should().Equal("t2", "t3");
        created.ShiftNames.Should().Equal("AFTERNOON", "MORNING");
        created.DefaultMenuPrice.Should().Be(50000);
        created.DefaultBomRatePercent.Should().Be(100);

        (await context.Customers.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Customercontracts.AsNoTracking().CountAsync()).Should().Be(1);
        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .Select(item => item.FieldName)
            .ToListAsync();
        audits.Should().Contain(["CustomerCreated", "ContractCreated"]);

        Func<Task> duplicate = async () => await service.CreateCustomerContractAsync(
            new CreateCustomerContractDto
            {
                CustomerCode = "NEW",
                CustomerName = "Duplicate",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"]
            },
            fixture.UserIdString);

        await duplicate.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*đã tồn tại*");
    }

    [Fact]
    public async Task CustomerContract_Should_BlockOverlappingEffectiveContract()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationService(context, new MaterialDemandService(context));
            var contract = (await service.GetCustomerContractsAsync()).Should().ContainSingle().Subject;
            customerId = contract.CustomerId;
            await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractDto
                {
                    EffectiveFrom = "2026-06-15",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    DefaultMenuPrice = 43000,
                    DefaultBomRatePercent = 120
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            context.Customercontracts.Add(new Customercontract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = GuidHelper.ParseGuidString(customerId)!,
                EffectiveFrom = new DateOnly(2026, 6, 16),
                ActiveWeekDays = "t3",
                ShiftNames = "AFTERNOON",
                DefaultMenuPrice = 45000,
                DefaultBomRatePercent = 130,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationService(context, new MaterialDemandService(context));
            Func<Task> act = async () => await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractDto
                {
                    EffectiveFrom = "2026-06-15",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    DefaultMenuPrice = 46000,
                    DefaultBomRatePercent = 140
                },
                fixture.UserIdString);

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*trùng hiệu lực*");
        }
    }

    [Fact]
    public async Task PortionRuleApi_Should_ResolvePriorityEffectiveDate_AndBlockOverlap()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new CoordinationService(context, new MaterialDemandService(context));
        var customerId = GuidHelper.ToGuidString(await context.Customers
            .Select(item => item.CustomerId)
            .SingleAsync());
        var dishId = GuidHelper.ToGuidString(fixture.DishWithBomId);

        var categoryRule = await service.CreatePortionRuleAsync(
            new CreatePortionRuleDto
            {
                CustomerId = customerId,
                EffectiveFrom = "2026-06-01",
                EffectiveTo = "2026-06-20",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 80,
                Reason = "Category portion"
            },
            fixture.UserIdString);
        categoryRule.RuleSource.Should().Be("CATEGORY_SLOT");

        var dishRule = await service.CreatePortionRuleAsync(
            new CreatePortionRuleDto
            {
                CustomerId = customerId,
                DishId = dishId,
                EffectiveFrom = "2026-06-01",
                EffectiveTo = "2026-06-20",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 120,
                BomRatePercent = 110,
                Reason = "Dish override"
            },
            fixture.UserIdString);
        dishRule.RuleSource.Should().Be("DISH_OVERRIDE");

        var resolvedDish = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
        {
            CustomerId = customerId,
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING",
            SlotName = "mon_chinh",
            DishId = dishId
        });
        resolvedDish.Should().NotBeNull();
        resolvedDish!.Source.Should().Be("DISH_OVERRIDE");
        resolvedDish.PortionRatePercent.Should().Be(120);
        resolvedDish.BomRatePercent.Should().Be(100);

        var resolvedCategory = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
        {
            CustomerId = customerId,
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING",
            SlotName = "mon_chinh"
        });
        resolvedCategory.Should().NotBeNull();
        resolvedCategory!.Source.Should().Be("CATEGORY_SLOT");
        resolvedCategory.PortionRatePercent.Should().Be(80);

        var rules = await service.GetPortionRulesAsync(new PortionRuleQueryDto
        {
            CustomerId = customerId,
            EffectiveDate = "2026-06-15",
            ShiftName = "MORNING"
        });
        rules.Should().HaveCount(2);

        Func<Task> duplicate = async () => await service.CreatePortionRuleAsync(
            new CreatePortionRuleDto
            {
                CustomerId = customerId,
                DishId = dishId,
                EffectiveFrom = "2026-06-10",
                EffectiveTo = "2026-06-18",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 115,
                Reason = "Duplicate dish scope"
            },
            fixture.UserIdString);
        await duplicate.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*trùng hiệu lực*");

        var outOfRange = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
        {
            CustomerId = customerId,
            ServiceDate = "2026-07-01",
            ShiftName = "MORNING",
            SlotName = "mon_chinh",
            DishId = dishId
        });
        outOfRange.Should().NotBeNull();
        outOfRange!.Source.Should().Be("DEMO_FALLBACK");
        outOfRange.Warnings.Should().ContainSingle();
    }

    [Fact]
    public async Task GenerateDemand_Should_ApplyPortionRule_AndPersistTrace()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        string portionRuleId;
        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationService(context, new MaterialDemandService(context));
            customerId = GuidHelper.ToGuidString(await context.Customers
                .Select(item => item.CustomerId)
                .SingleAsync());
            var rule = await service.CreatePortionRuleAsync(
                new CreatePortionRuleDto
                {
                    CustomerId = customerId,
                    DishId = GuidHelper.ToGuidString(fixture.DishWithBomId),
                    EffectiveFrom = "2026-06-01",
                    EffectiveTo = "2026-06-30",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    PortionRatePercent = 50,
                    BomRatePercent = 125,
                    Reason = "Half portion premium BOM"
                },
                fixture.UserIdString);
            portionRuleId = rule.PortionRuleId;
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", CustomerId = customerId, Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            var line = demand!.Lines.Single();
            line.TotalRequiredQty.Should().Be(100m);
            line.BomRatePercent.Should().Be(100m);
            line.AppliedPortionRuleId.Should().Be(portionRuleId);
            line.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            line.AppliedPortionRatePercent.Should().Be(50m);

            var savedLine = await context.Materialrequestlines.AsNoTracking().SingleAsync();
            GuidHelper.ToGuidString(savedLine.AppliedPortionRuleId!).Should().Be(portionRuleId);
            savedLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            savedLine.AppliedPortionRatePercent.Should().Be(50m);
            savedLine.BomRatePercent.Should().Be(100m);

            var reportLine = (await new WorkflowReportService(context).GetIngredientDemandAsync(new WorkflowReportQueryDto
            {
                CustomerId = customerId,
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15"
            })).Single();
            reportLine.AppliedPortionRuleId.Should().Be(portionRuleId);
            reportLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            reportLine.AppliedPortionRatePercent.Should().Be(50m);
            reportLine.BomRatePercent.Should().Be(100m);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_RequireSignoffBeforeUsingLockedOrder()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            quantityPlan.Status = OrderStatus.Confirmed;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);

            var act = async () => await service.GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Cần hoàn tất số suất trước khi tạo nhu cầu nguyên liệu.");
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_UseSignedOffAdjustedOrderFinalServings()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            var quantityLine = await context.Mealquantityplanlines.SingleAsync();
            quantityPlan.Status = OrderStatus.Completed;
            quantityLine.ConfirmedServings = 100;
            quantityLine.AdjustedServings = 20;
            quantityLine.FinalServings = 120;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            demand!.Lines.Single().TotalRequiredQty.Should().Be(240m);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_CreateProductionPlanWithCustomerWeekVersionAndStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        byte[] menuVersionId;
        byte[] customerId;
        await using (var setupContext = fixture.CreateContext())
        {
            customerId = await setupContext.Customers.Select(item => item.CustomerId).SingleAsync();
            menuVersionId = GuidHelper.NewId();
            setupContext.Menuversions.Add(new Menuversion
            {
                MenuVersionId = menuVersionId,
                CustomerId = customerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                VersionNo = 2,
                Status = "PUBLISHED",
                SourceImportBatch = "MENU-CUS-20260615-V02",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                PublishedBy = fixture.UserId,
                PublishedAt = DateTime.UtcNow.AddMinutes(-5),
                UpdatedAt = DateTime.UtcNow.AddMinutes(-5)
            });
            await setupContext.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = GuidHelper.ToGuidString(customerId),
                    Scope = "FULLDAY"
                },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            var plan = await context.Productionplans
                .Include(item => item.Customer)
                .Include(item => item.MenuVersion)
                .SingleAsync(item => item.PlanCode == "KHSX-CUS-20260615-FULLDAY");

            plan.CustomerId.Should().NotBeNull();
            plan.CustomerId!.Should().Equal(customerId);
            plan.WeekStartDate.Should().Be(new DateOnly(2026, 6, 15));
            plan.MenuVersionId.Should().NotBeNull();
            plan.MenuVersionId!.Should().Equal(menuVersionId);
            plan.Status.Should().Be("CREATED");
            plan.Customer!.CustomerCode.Should().Be("CUS");
            plan.MenuVersion!.VersionNo.Should().Be(2);
            plan.MenuVersion.Status.Should().Be("PUBLISHED");
        }
    }

    [Fact]
    public async Task SendDailyToKitchen_Should_UpdatePlansAndReturnKitchenReadyDailyPlan()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var demandContext = fixture.CreateContext())
        {
            await new MaterialDemandService(demandContext).GenerateAsync(
                new GenerateMaterialDemandRequestDto
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = fixture.CustomerIdString,
                    Scope = "FULLDAY"
                },
                fixture.UserIdString);
        }

        await using var context = fixture.CreateContext();
        var service = new ProductionPlanService(new ProductionPlanRepository(context), context);

        var daily = await service.SendDailyToKitchenAsync(new SendDailyProductionPlanRequestDto
        {
            ServiceDate = "2026-06-15",
            CustomerId = fixture.CustomerIdString,
            ShiftName = "MORNING",
            Reason = "UAT gửi bếp"
        }, fixture.UserIdString);

        daily.ServiceDate.Should().Be(new DateOnly(2026, 6, 15));
        daily.CustomerId.Should().Be(fixture.CustomerIdString);
        daily.CustomerCode.Should().Be("CUS");
        daily.ShiftName.Should().Be("MORNING");
        daily.TotalPlans.Should().Be(1);
        daily.SentPlans.Should().Be(1);
        daily.TotalDishes.Should().Be(1);
        daily.TotalServings.Should().Be(100);
        daily.Plans.Should().ContainSingle();
        daily.Plans.Single().Status.Should().Be("SENTTOKITCHEN");
        daily.Plans.Single().SentToKitchenBy.Should().Be(fixture.UserIdString);
        daily.Plans.Single().SentToKitchenByName.Should().Be("Workflow Test");
        daily.Plans.Single().SentToKitchenAt.Should().NotBeNull();
        daily.Warnings.Should().NotContain("Có kế hoạch chưa gửi bếp.");

        var savedPlan = await context.Productionplans
            .AsNoTracking()
            .SingleAsync(plan => plan.PlanCode == "KHSX-CUS-20260615-FULLDAY");
        savedPlan.Status.Should().Be("SENTTOKITCHEN");
        savedPlan.SentToKitchenBy.Should().NotBeNull();
        savedPlan.SentToKitchenBy!.Should().Equal(fixture.UserId);
        savedPlan.SentToKitchenAt.Should().NotBeNull();

        var audit = await context.Auditlogs
            .AsNoTracking()
            .SingleAsync(log => log.BusinessArea == "Kitchen" && log.FieldName == "SendToKitchen");
        audit.EntityId.Should().Equal(savedPlan.PlanId);
        audit.ChangedBy.Should().Equal(fixture.UserId);
        audit.NewValue.Should().Be("KHSX-CUS-20260615-FULLDAY");
        audit.Reason.Should().Be("UAT gửi bếp");
    }

    [Fact]
    public async Task ProductionPlans_Should_PageNewestFirst_WhenPlansSpanMultipleYears()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Productionplans.AddRange(
            new Productionplan
            {
                PlanId = GuidHelper.NewId(),
                PlanCode = "KHSX-CUS-20280101-FULLDAY",
                PlanDate = new DateOnly(2028, 1, 1),
                CustomerId = fixture.CustomerId,
                Status = "CREATED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow
            },
            new Productionplan
            {
                PlanId = GuidHelper.NewId(),
                PlanCode = "KHSX-CUS-20240101-FULLDAY",
                PlanDate = new DateOnly(2024, 1, 1),
                CustomerId = fixture.CustomerId,
                Status = "CREATED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new ProductionPlanService(new ProductionPlanRepository(context), context);
        var firstPage = await service.GetPagedAsync(new PagedRequestDto { PageNumber = 1, PageSize = 2 });
        var secondPage = await service.GetPagedAsync(new PagedRequestDto { PageNumber = 2, PageSize = 2 });

        firstPage.TotalCount.Should().Be(3);
        firstPage.PageNumber.Should().Be(1);
        firstPage.PageSize.Should().Be(2);
        firstPage.HasNext.Should().BeTrue();
        firstPage.Items.Select(plan => plan.PlanCode)
            .Should().Equal("KHSX-CUS-20280101-FULLDAY", "KHSX-REPORT-SEED");

        secondPage.HasPrev.Should().BeTrue();
        secondPage.HasNext.Should().BeFalse();
        secondPage.Items.Select(plan => plan.PlanCode)
            .Should().ContainSingle().Which.Should().Be("KHSX-CUS-20240101-FULLDAY");
    }

    [Fact]
    public async Task GenerateDemand_Should_ApplyDifferentPortionRules_ByShift()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        await using (var context = fixture.CreateContext())
        {
            var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            context.Menuschedules.Add(new Menuschedule
            {
                MenuScheduleId = GuidHelper.NewId(),
                CustomerId = schedule.CustomerId,
                MenuId = schedule.MenuId,
                ServiceDate = schedule.ServiceDate,
                WeekStartDate = schedule.WeekStartDate,
                ShiftName = "AFTERNOON",
                MenuPrice = schedule.MenuPrice,
                BomRatePercent = schedule.BomRatePercent,
                Status = "ACTIVE"
            });
            await context.SaveChangesAsync();

            var afternoonSchedule = await context.Menuschedules.SingleAsync(item => item.ShiftName == "AFTERNOON");
            context.Mealquantityplanlines.Add(new Mealquantityplanline
            {
                QuantityPlanLineId = GuidHelper.NewId(),
                QuantityPlanId = quantityPlan.QuantityPlanId,
                MenuScheduleId = afternoonSchedule.MenuScheduleId,
                CustomerId = afternoonSchedule.CustomerId,
                MenuId = afternoonSchedule.MenuId,
                ShiftName = "AFTERNOON",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            await context.SaveChangesAsync();

            customerId = GuidHelper.ToGuidString(schedule.CustomerId);
            var service = new CoordinationService(context, new MaterialDemandService(context));
            foreach (var (shiftName, rate) in new[] { ("MORNING", 50m), ("AFTERNOON", 75m) })
            {
                await service.CreatePortionRuleAsync(
                    new CreatePortionRuleDto
                    {
                        CustomerId = customerId,
                        DishId = GuidHelper.ToGuidString(fixture.DishWithBomId),
                        EffectiveFrom = "2026-06-01",
                        EffectiveTo = "2026-06-30",
                        ActiveWeekDays = ["t2"],
                        ShiftNames = [shiftName],
                        PortionRatePercent = rate,
                        Reason = $"Shift rule {shiftName}"
                    },
                    fixture.UserIdString);
            }
        }

        await using (var context = fixture.CreateContext())
        {
            var demandService = new MaterialDemandService(context);
            var morning = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequestDto
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = customerId,
                    ShiftName = "MORNING",
                    Scope = "MORNING"
                },
                fixture.UserIdString);
            var afternoon = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequestDto
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = customerId,
                    ShiftName = "AFTERNOON",
                    Scope = "AFTERNOON"
                },
                fixture.UserIdString);

            morning!.Lines.Single().TotalRequiredQty.Should().Be(100m);
            morning.Lines.Single().AppliedPortionRatePercent.Should().Be(50m);
            afternoon!.Lines.Single().TotalRequiredQty.Should().Be(150m);
            afternoon.Lines.Single().AppliedPortionRatePercent.Should().Be(75m);
        }
    }

    [Fact]
    public async Task MenuScheduleRules_Should_UpdatePortionRate_AndDemandUsesNewRate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string scheduleId;
        await using (var context = fixture.CreateContext())
        {
            scheduleId = GuidHelper.ToGuidString(await context.Menuschedules
                .Select(item => item.MenuScheduleId)
                .SingleAsync());
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationService(context, new MaterialDemandService(context));
            var updated = await service.UpdateMenuScheduleRulesAsync(
                scheduleId,
                new UpdateMenuScheduleRulesDto
                {
                    MenuPrice = 25000,
                    BomRatePercent = 125,
                    Reason = "Customer premium portion"
                },
                fixture.UserIdString);

            updated.Should().NotBeNull();
            updated!.MenuPrice.Should().Be(25000);
            updated.BomRatePercent.Should().Be(100);
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var line = demand!.Lines.Single();
            line.BomRatePercent.Should().Be(100);
            line.TotalRequiredQty.Should().Be(200);
        }
    }

    [Fact]
    public async Task MenuScheduleVersion_Should_UpdateStatus_AndWriteAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var firstSchedule = await context.Menuschedules.SingleAsync();
        var scheduleId = GuidHelper.ToGuidString(firstSchedule.MenuScheduleId);
        context.Menuschedules.Add(new Menuschedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = firstSchedule.CustomerId,
            MenuId = firstSchedule.MenuId,
            ServiceDate = new DateOnly(2026, 6, 16),
            WeekStartDate = firstSchedule.WeekStartDate,
            ShiftName = "AFTERNOON",
            MenuPrice = firstSchedule.MenuPrice,
            BomRatePercent = firstSchedule.BomRatePercent,
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var updated = await service.UpdateMenuScheduleVersionAsync(
            scheduleId,
            new UpdateMenuScheduleVersionDto
            {
                Status = "SUPERSEDED",
                Reason = "Replaced by new weekly version"
            },
            fixture.UserIdString);

        updated.Should().NotBeNull();
        updated!.Status.Should().Be("SUPERSEDED");
        updated.MenuVersionId.Should().NotBeNullOrWhiteSpace();
        updated.MenuVersionNo.Should().Be(1);
        updated.MenuVersionStatus.Should().Be("SUPERSEDED");
        updated.SourceImportBatch.Should().Be("LEGACY-20260615");

        var version = await context.Menuversions.AsNoTracking().SingleAsync();
        version.Status.Should().Be("SUPERSEDED");
        var weekStatuses = await context.Menuschedules.AsNoTracking()
            .Select(item => item.Status)
            .ToListAsync();
        weekStatuses.Should().AllBeEquivalentTo("SUPERSEDED");
        var audit = await context.Auditlogs.AsNoTracking()
            .Where(item =>
                item.BusinessArea == "MenuVersion" &&
                item.EntityName == nameof(Menuschedule) &&
                item.FieldName == nameof(Menuschedule.Status))
            .ToListAsync();
        audit.Should().HaveCount(2);
        audit.Select(item => item.OldValue).Should().AllBeEquivalentTo("ACTIVE");
        audit.Select(item => item.NewValue).Should().AllBeEquivalentTo("SUPERSEDED");
    }

    [Fact]
    public async Task MenuVersionRollback_Should_PublishPreviousVersion_AndInvalidateDemand()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        byte[] customerId;
        byte[] versionOneId;
        byte[] versionTwoId;
        await using (var setupContext = fixture.CreateContext())
        {
            customerId = await setupContext.Customers.Select(item => item.CustomerId).SingleAsync();
            versionOneId = GuidHelper.NewId();
            versionTwoId = GuidHelper.NewId();
            setupContext.Menuversions.AddRange(
                new Menuversion
                {
                    MenuVersionId = versionOneId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 1,
                    Status = "SUPERSEDED",
                    SourceImportBatch = "MENU-CUS-20260615-V01",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-2),
                    UpdatedAt = DateTime.UtcNow.AddHours(-2)
                },
                new Menuversion
                {
                    MenuVersionId = versionTwoId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 2,
                    Status = "PUBLISHED",
                    SourceImportBatch = "MENU-CUS-20260615-V02",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-1),
                    UpdatedAt = DateTime.UtcNow.AddHours(-1)
                });
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto
            {
                ServiceDate = "2026-06-15",
                CustomerId = GuidHelper.ToGuidString(customerId),
                Scope = "FULLDAY"
            },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var service = new CoordinationService(context, new MaterialDemandService(context));
        var result = await service.RollbackMenuVersionAsync(
            new RollbackMenuVersionDto
            {
                CustomerId = GuidHelper.ToGuidString(customerId),
                WeekStartDate = "2026-06-15",
                Reason = "Excel published bị sai món chính"
            },
            fixture.UserIdString);

        result.ActiveVersionNo.Should().Be(1);
        result.RolledBackFromVersionNo.Should().Be(2);
        result.CancelledDemandCount.Should().Be(1);
        result.CancelledPurchaseCount.Should().Be(1);

        var versions = await context.Menuversions.AsNoTracking().ToListAsync();
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionOneId)).Status.Should().Be("PUBLISHED");
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionTwoId)).Status.Should().Be("SUPERSEDED");
        (await context.Materialrequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.Reason != null && item.Reason.Contains("Excel published bị sai món chính"))
            .Select(item => new { item.BusinessArea, item.FieldName })
            .ToListAsync();
        audits.Should().Contain(item => item.BusinessArea == "MenuVersion" && item.FieldName == "Rollback");
        audits.Should().Contain(item => item.BusinessArea == "Demand" && item.FieldName == nameof(Materialrequest.Status));
        audits.Should().Contain(item => item.BusinessArea == "Purchase" && item.FieldName == nameof(Purchaserequest.Status));
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_CancelDownstreamDemandAndPurchase_ForCustomerWeek()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var purchase = await new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context)).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var customer = await context.Customers.SingleAsync();
        var version = new Menuversion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 2,
            Status = "DRAFT",
            SourceImportBatch = "MENU-CUS-20260615-V02",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(version);
        await context.SaveChangesAsync();

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "InvalidateWorkflowDocumentsForMenuReimportAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);
        method.Should().NotBeNull();

        var task = (Task<int>)method!.Invoke(service, [
            customer,
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 20),
            version,
            fixture.UserIdString,
            CancellationToken.None
        ])!;
        var invalidated = await task;
        await context.SaveChangesAsync();

        invalidated.Should().Be(2);
        (await context.Materialrequests.Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        (await context.Purchaserequests.Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        var auditReasons = await context.Auditlogs
            .Where(item => item.Reason != null && item.Reason.Contains("invalidated downstream demand/PR"))
            .Select(item => item.BusinessArea)
            .ToListAsync();
        auditReasons.Should().BeEquivalentTo(["Demand", "Purchase"]);
    }

    private static async Task<Materialrequest> SeedReportDocumentsAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        var materialRequest = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-20260615-FULLDAY",
            PlanId = fixture.ProductionPlanId,
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        };

        context.Materialrequests.Add(materialRequest);
        context.Quantityimportbatches.Add(new Quantityimportbatch
        {
            ImportBatchId = GuidHelper.NewId(),
            BatchCode = "IMP-DEMO",
            SourceCompanyName = "Demo customer",
            SourceType = "EXCEL",
            ImportedBy = fixture.UserId,
            ImportedAt = DateTime.UtcNow.AddMinutes(-20),
            Status = "COMMITTED"
        });
        context.Approvalhistories.Add(new Approvalhistory
        {
            ApprovalHistoryId = GuidHelper.NewId(),
            TargetType = nameof(Materialrequest),
            TargetId = materialRequest.RequestId,
            Decision = "APPROVE",
            OldStatus = "DRAFT",
            NewStatus = "MANAGERAPPROVED",
            Reason = "Demo approval",
            ActionBy = fixture.UserId,
            ActionAt = DateTime.UtcNow.AddMinutes(-15)
        });
        context.Inventoryreceipts.Add(new Inventoryreceipt
        {
            ReceiptId = fixture.ReceiptId,
            ReceiptCode = "NK-DEMO",
            ReceiptDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            SupplierId = fixture.SupplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            Inventoryreceiptlines =
            [
                new Inventoryreceiptline
                {
                    ReceiptLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    Quantity = 10,
                    UnitPrice = 1000,
                    Amount = 10000
                }
            ]
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = fixture.IssueId,
            IssueCode = "PX-DEMO",
            IssueDate = new DateOnly(2026, 6, 15),
            ShiftName = "MORNING",
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = materialRequest.RequestId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5),
            Inventoryissuelines =
            [
                new Inventoryissueline
                {
                    IssueLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    RequestedQty = 4,
                    IssuedQty = 4
                }
            ]
        });

        await context.SaveChangesAsync();
        return materialRequest;
    }

    private static ClaimsPrincipal BuildPrincipal(string roleName)
        => new(new ClaimsIdentity([new Claim(ClaimTypes.Role, roleName)], "TestAuth"));

    private static PurchaseRequestWorkflowService CreatePurchaseRequestWorkflowService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

    private static PurchaseOrderService CreatePurchaseOrderService(IpcManagementContext context)
        => new(
            context,
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)));

    private static InventoryIssueService CreateInventoryIssueService(IpcManagementContext context)
        => new(
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            context);

    private static InventoryReceiptService CreateInventoryReceiptService(IpcManagementContext context)
        => new(
            new InventoryReceiptRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            context);

    private static InventoryReturnService CreateInventoryReturnService(IpcManagementContext context)
        => new(
            new InventoryReturnRepository(context),
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            context);

    private static async Task<string> SeedSubmittedPurchaseRequestAsync(WorkflowFixture fixture)
    {
        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

        return purchase.PurchaseRequestId;
    }

    [Fact]
    public async Task CreateSupplierQuotation_Should_RejectOverlappingEffectivePeriod_ForSameSupplierAndIngredient()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await SeedSupplierAndIngredientAsync(context, fixture, fixture.SupplierId, "Nhà cung cấp Demo");

        var service = new SupplierQuotationService(context);
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = "2026-06-30"
        });

        var act = () => service.CreateAsync(new CreateSupplierQuotationDto
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
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(supplierEarlyZ),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(supplierLateB),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-06-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationDto
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
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = $"PR-DEMO-{GuidHelper.ToGuidString(purchaseRequestId)[..8]}",
            RequestDate = new DateOnly(2026, 6, 1),
            PurchaseForDate = new DateOnly(2026, 6, 2),
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
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
                    EstimatedUnitPrice = 1000
                },
                new Purchaserequestline
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
                    EstimatedUnitPrice = 2000
                }
            ]
        });
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

        await act.Should().ThrowAsync<InvalidOperationException>();
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
        await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        var act = () => service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task RecordReceipt_Should_TransitionStatus_FromOrderedToPartialToReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = CreatePurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var afterPartial = await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 4 }]
        }, fixture.UserIdString);
        afterPartial.Status.Should().Be("PARTIALLY_RECEIVED");
        afterPartial.Lines[0].ReceivedQty.Should().Be(4);

        var afterFull = await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 6 }]
        }, fixture.UserIdString);
        afterFull.Status.Should().Be("RECEIVED");
        afterFull.Lines[0].ReceivedQty.Should().Be(10);

        (await context.Inventoryreceipts.AsNoTracking().CountAsync()).Should().Be(2);
        (await context.Stockmovements.AsNoTracking().CountAsync(item => item.MovementType == "RECEIPT")).Should().Be(2);
        var currentStock = await context.Currentstocks.AsNoTracking().SingleAsync(item => item.IngredientId == fixture.IngredientId);
        currentStock.CurrentQty.Should().Be(10);
    }

    [Fact]
    public async Task RecordReceipt_Should_Throw_WhenExceedingOrderedQty()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = CreatePurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var act = () => service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 11 }]
        }, fixture.UserIdString);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Cancel_Should_Throw_WhenAnyLineAlreadyReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = CreatePurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 2 }]
        }, fixture.UserIdString);

        var act = () => service.CancelAsync(orderForSupplierA.PurchaseOrderId);

        await act.Should().ThrowAsync<InvalidOperationException>();
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
        context.Dishboms.Add(new Dishbom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientAId, UnitId = fixture.UnitId, GrossQtyPerServing = 1, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });
        context.Dishboms.Add(new Dishbom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientBId, UnitId = fixture.UnitId, GrossQtyPerServing = 9, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });

        var receiptId = GuidHelper.NewId();
        context.Inventoryreceipts.Add(new Inventoryreceipt
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
                new Inventoryreceiptline { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientAId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 150 },
                new Inventoryreceiptline { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientBId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 110 }
            ]
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var result = await service.GetPriceVarianceByDishGroupAsync(new WorkflowReportQueryDto());

        var group = result.Should().ContainSingle(g => g.DishGroup == "Món chính").Subject;
        group.IngredientCount.Should().Be(2);
        // Trọng số theo BOM: (1*50 + 9*10) / (1+9) = 14, khác hẳn trung bình cộng đơn giản (50+10)/2 = 30
        group.WeightedAvgVariancePercent.Should().Be(14);
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
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = resolvedPrId,
            PurchaseRequestCode = $"PR-RESOLVED-{GuidHelper.ToGuidString(resolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
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
        context.Purchaseorders.Add(new Purchaseorder
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
                new Purchaseorderline { PurchaseOrderLineId = GuidHelper.NewId(), PurchaseRequestLineId = resolvedLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, OrderedQty = 5, ReceivedQty = 5, UnitPrice = 1000 }
            ]
        });

        // PR 2: quá hạn và CHƯA từng tạo PO -> vẫn tính là quá hạn
        var unresolvedPrId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = unresolvedPrId,
            PurchaseRequestCode = $"PR-UNRESOLVED-{GuidHelper.ToGuidString(unresolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
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

        var service = new WorkflowReportService(context);
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
        context.Purchaserequests.Add(new Purchaserequest
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
        context.Purchaseorders.Add(new Purchaseorder
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
        context.Purchaseorders.Add(new Purchaseorder
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

        var service = new WorkflowReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.LateReceiptCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountLowStock_UsingAverageDailyDemandOverLast7Days()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-KPI", WarehouseName = "Kho KPI", WarehouseType = "DRY" });

        var lowStockIngredientId = GuidHelper.NewId();
        var healthyStockIngredientId = GuidHelper.NewId();
        context.Ingredients.Add(new Ingredient { IngredientId = lowStockIngredientId, IngredientCode = "ING-LOW", IngredientName = "NL tồn thấp", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = healthyStockIngredientId, IngredientCode = "ING-OK", IngredientName = "NL tồn ổn", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });

        // Nhu cầu trung bình 7 ngày: 70 / 7 = 10 mỗi ngày cho mỗi nguyên liệu
        var planId = GuidHelper.NewId();
        var requestId = GuidHelper.NewId();
        context.Materialrequests.Add(new Materialrequest
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
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 },
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 }
            ]
        });

        // Tồn kho hiện tại: NL tồn thấp chỉ còn 5 (< 10/ngày) -> tồn thấp; NL tồn ổn còn 50 (>= 10/ngày) -> không tính
        context.Currentstocks.Add(new Currentstock { WarehouseId = fixture.WarehouseId, IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 5, LastUpdated = DateTime.UtcNow });
        context.Currentstocks.Add(new Currentstock { WarehouseId = fixture.WarehouseId, IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 50, LastUpdated = DateTime.UtcNow });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
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
        context.Materialrequests.Add(new Materialrequest
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
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = activeRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        var cancelledRequestId = GuidHelper.NewId();
        context.Materialrequests.Add(new Materialrequest
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
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = cancelledRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        context.Inventoryissues.Add(new Inventoryissue
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
        context.Inventoryissues.Add(new Inventoryissue
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

        var service = new WorkflowReportService(context);
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

        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-FAILED",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "FAILED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = "PR-OVERDUE-APPROVAL",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-2),
            PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1),
            Status = "SENTTOSUPPLIER",
            CreatedBy = fixture.UserId
        });
        context.Currentstocks.Add(new Currentstock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = -1,
            LastUpdated = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
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
                new GenerateMaterialDemandRequestDto { ServiceDate = serviceDate, Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();
            demandLineCount += demand!.Lines.Count;

            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand.MaterialRequestId },
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
        context.Productionplanlines.Add(new Productionplanline
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
                context.Materialrequests.Add(new Materialrequest
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
                        new Materialrequestline
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
        var rows = await new WorkflowReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
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

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }

        public void Reset() => SelectCount = 0;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class WorkflowFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<IpcManagementContext> _options;

        private WorkflowFixture(SqliteConnection connection, DbContextOptions<IpcManagementContext> options)
        {
            _connection = connection;
            _options = options;
        }

        public byte[] UserId { get; } = GuidHelper.NewId();
        public string UserIdString => GuidHelper.ToGuidString(UserId);
        public byte[] UnitId { get; } = GuidHelper.NewId();
        public byte[] WarehouseId { get; } = GuidHelper.NewId();
        public byte[] IngredientId { get; } = GuidHelper.NewId();
        public string IngredientIdString => GuidHelper.ToGuidString(IngredientId);
        public byte[] CustomerId { get; } = GuidHelper.NewId();
        public string CustomerIdString => GuidHelper.ToGuidString(CustomerId);
        public byte[] SupplierId { get; } = GuidHelper.NewId();
        public byte[] QuantityPlanId { get; } = GuidHelper.NewId();
        public byte[] ProductionPlanId { get; } = GuidHelper.NewId();
        public byte[] DishWithBomId { get; } = GuidHelper.NewId();
        public byte[] ReceiptId { get; } = GuidHelper.NewId();
        public byte[] IssueId { get; } = GuidHelper.NewId();

        public static async Task<WorkflowFixture> CreateAsync(DbCommandInterceptor? interceptor = null)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var optionsBuilder = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection);
            if (interceptor is not null)
            {
                optionsBuilder.AddInterceptors(interceptor);
            }

            await CreateMinimalWorkflowSchemaAsync(connection);

            return new WorkflowFixture(connection, optionsBuilder.Options);
        }

        public IpcManagementContext CreateContext() => new(_options);

        public async Task SeedMenuWithDemandAsync(bool includeMissingDish)
        {
            await using var context = CreateContext();

            var roleId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var quantityLineId = GuidHelper.NewId();
            var dishMissingBomId = GuidHelper.NewId();

            var role = new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" };
            var user = new User
            {
                UserId = UserId,
                Username = "workflow-test",
                FullName = "Workflow Test",
                PasswordHash = "hash",
                RoleId = roleId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            var unit = new Unit
            {
                UnitId = UnitId,
                UnitCode = "KG",
                UnitName = "kg",
                ConvertRateToBase = 1
            };
            var warehouse = new Warehouse
            {
                WarehouseId = WarehouseId,
                WarehouseCode = "WH",
                WarehouseName = "Main",
                WarehouseType = "MAIN"
            };
            var ingredient = new Ingredient
            {
                IngredientId = IngredientId,
                IngredientCode = "ING",
                IngredientName = "Ingredient",
                UnitId = UnitId,
                WarehouseId = WarehouseId,
                ReferencePrice = 1000,
                IsFreshDaily = true,
                IsActive = true
            };
            var supplier = new Supplier
            {
                SupplierId = SupplierId,
                SupplierCode = "SUP",
                SupplierName = "Supplier",
                IsActive = true
            };
            var customer = new Customer
            {
                CustomerId = CustomerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            };
            var menu = new Menu
            {
                MenuId = menuId,
                MenuCode = "MENU",
                MenuName = "Menu",
                IsActive = true
            };
            var dishWithBom = new Dish
            {
                DishId = DishWithBomId,
                DishCode = "DISH-BOM",
                DishName = "Dish with BOM",
                IsActive = true
            };
            var dishMissingBom = new Dish
            {
                DishId = dishMissingBomId,
                DishCode = "DISH-MISSING",
                DishName = "Dish missing BOM",
                IsActive = true
            };

            context.Roles.Add(role);
            context.Users.Add(user);
            context.Units.Add(unit);
            context.Warehouses.Add(warehouse);
            context.Ingredients.Add(ingredient);
            context.Suppliers.Add(supplier);
            context.Customers.Add(customer);
            context.Menus.Add(menu);
            context.Dishes.AddRange(dishWithBom, dishMissingBom);
            context.Menuitems.Add(new Menuitem
            {
                MenuItemId = GuidHelper.NewId(),
                MenuId = menuId,
                DishId = DishWithBomId,
                DisplayOrder = 1
            });
            if (includeMissingDish)
            {
                context.Menuitems.Add(new Menuitem
                {
                    MenuItemId = GuidHelper.NewId(),
                    MenuId = menuId,
                    DishId = dishMissingBomId,
                    DisplayOrder = 2
                });
            }

            context.Dishboms.Add(new Dishbom
            {
                BomId = GuidHelper.NewId(),
                DishId = DishWithBomId,
                IngredientId = IngredientId,
                UnitId = UnitId,
                GrossQtyPerServing = 2,
                WasteRatePercent = 0,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2026, 1, 1)
            });
            context.Menuschedules.Add(new Menuschedule
            {
                MenuScheduleId = scheduleId,
                CustomerId = CustomerId,
                MenuId = menuId,
                ServiceDate = new DateOnly(2026, 6, 15),
                WeekStartDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                MenuPrice = 25000,
                BomRatePercent = 100,
                Status = "ACTIVE"
            });
            context.Mealquantityplans.Add(new Mealquantityplan
            {
                QuantityPlanId = QuantityPlanId,
                PlanCode = "QTY-20260615",
                ServiceDate = new DateOnly(2026, 6, 15),
                Status = OrderStatus.Completed,
                ForecastReceivedAt = DateTime.UtcNow.AddHours(-3),
                ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                ConfirmationTime = new TimeOnly(9, 0),
                ConfirmedBy = UserId
            });
            context.Mealquantityplanlines.Add(new Mealquantityplanline
            {
                QuantityPlanLineId = quantityLineId,
                QuantityPlanId = QuantityPlanId,
                MenuScheduleId = scheduleId,
                CustomerId = CustomerId,
                MenuId = menuId,
                ShiftName = "MORNING",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            context.Productionplans.Add(new Productionplan
            {
                PlanId = ProductionPlanId,
                PlanCode = "KHSX-REPORT-SEED",
                PlanDate = new DateOnly(2026, 6, 15),
                Status = "CREATED",
                CreatedBy = UserId,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        public async Task SeedPerformanceWeekAsync(int customerCount, int ingredientCount)
        {
            await using var context = CreateContext();
            var roleId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var dishId = GuidHelper.NewId();
            var weekStart = new DateOnly(2026, 8, 3);

            context.Roles.Add(new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" });
            context.Users.Add(new User
            {
                UserId = UserId,
                Username = "performance-test",
                FullName = "Performance Test",
                PasswordHash = "hash",
                RoleId = roleId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
            context.Units.Add(new Unit
            {
                UnitId = UnitId,
                UnitCode = "KG",
                UnitName = "kg",
                ConvertRateToBase = 1
            });
            context.Warehouses.Add(new Warehouse
            {
                WarehouseId = WarehouseId,
                WarehouseCode = "WH-PERF",
                WarehouseName = "Performance Warehouse",
                WarehouseType = "MAIN"
            });
            context.Suppliers.Add(new Supplier
            {
                SupplierId = SupplierId,
                SupplierCode = "SUP-PERF",
                SupplierName = "Performance Supplier",
                IsActive = true
            });
            context.Menus.Add(new Menu
            {
                MenuId = menuId,
                MenuCode = "MENU-PERF",
                MenuName = "Performance Menu",
                IsActive = true
            });
            context.Dishes.Add(new Dish
            {
                DishId = dishId,
                DishCode = "DISH-PERF",
                DishName = "Performance Dish",
                IsActive = true
            });
            context.Menuitems.Add(new Menuitem
            {
                MenuItemId = GuidHelper.NewId(),
                MenuId = menuId,
                DishId = dishId,
                DisplayOrder = 1
            });

            for (var ingredientIndex = 0; ingredientIndex < ingredientCount; ingredientIndex++)
            {
                var ingredientId = GuidHelper.NewId();
                context.Ingredients.Add(new Ingredient
                {
                    IngredientId = ingredientId,
                    IngredientCode = $"ING-PERF-{ingredientIndex:00}",
                    IngredientName = $"Performance Ingredient {ingredientIndex:00}",
                    UnitId = UnitId,
                    WarehouseId = WarehouseId,
                    ReferencePrice = 1000 + ingredientIndex,
                    IsFreshDaily = true,
                    IsActive = true
                });
                context.Dishboms.Add(new Dishbom
                {
                    BomId = GuidHelper.NewId(),
                    DishId = dishId,
                    IngredientId = ingredientId,
                    UnitId = UnitId,
                    GrossQtyPerServing = 0.01m + (ingredientIndex * 0.001m),
                    WasteRatePercent = 0,
                    BomStatus = "PUBLISHED",
                    EffectiveFrom = weekStart
                });
            }

            var customers = Enumerable.Range(0, customerCount)
                .Select(customerIndex => new Customer
                {
                    CustomerId = GuidHelper.NewId(),
                    CustomerCode = $"CUS-PERF-{customerIndex:00}",
                    CustomerName = $"Performance Customer {customerIndex:00}",
                    IsActive = true
                })
                .ToList();
            context.Customers.AddRange(customers);

            for (var dayOffset = 0; dayOffset < 7; dayOffset++)
            {
                var serviceDate = weekStart.AddDays(dayOffset);
                var quantityPlanId = GuidHelper.NewId();
                context.Mealquantityplans.Add(new Mealquantityplan
                {
                    QuantityPlanId = quantityPlanId,
                    PlanCode = $"QTY-PERF-{serviceDate:yyyyMMdd}",
                    ServiceDate = serviceDate,
                    Status = OrderStatus.Completed,
                    ForecastReceivedAt = DateTime.UtcNow.AddHours(-3),
                    ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                    ConfirmationTime = new TimeOnly(9, 0),
                    ConfirmedBy = UserId
                });

                foreach (var customer in customers)
                {
                    var scheduleId = GuidHelper.NewId();
                    context.Menuschedules.Add(new Menuschedule
                    {
                        MenuScheduleId = scheduleId,
                        CustomerId = customer.CustomerId,
                        MenuId = menuId,
                        ServiceDate = serviceDate,
                        WeekStartDate = weekStart,
                        ShiftName = "MORNING",
                        MenuPrice = 25000,
                        BomRatePercent = 100,
                        Status = "ACTIVE"
                    });
                    context.Mealquantityplanlines.Add(new Mealquantityplanline
                    {
                        QuantityPlanLineId = GuidHelper.NewId(),
                        QuantityPlanId = quantityPlanId,
                        MenuScheduleId = scheduleId,
                        CustomerId = customer.CustomerId,
                        MenuId = menuId,
                        ShiftName = "MORNING",
                        ForecastServings = 120,
                        ConfirmedServings = 120,
                        FinalServings = 120
                    });
                }
            }

            await context.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await _connection.DisposeAsync();
        }

        private static async Task CreateMinimalWorkflowSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE roles (
                    roleId BLOB PRIMARY KEY,
                    roleCode TEXT NOT NULL,
                    roleName TEXT NOT NULL
                );
                CREATE TABLE users (
                    userId BLOB PRIMARY KEY,
                    username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL,
                    fullName TEXT NOT NULL,
                    roleId BLOB NOT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE units (
                    unitId BLOB PRIMARY KEY,
                    unitCode TEXT NOT NULL,
                    unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL,
                    convertRateToBase TEXT NOT NULL
                );
                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY,
                    warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL,
                    warehouseType TEXT NOT NULL,
                    note TEXT NULL
                );
                CREATE TABLE ingredients (
                    ingredientId BLOB PRIMARY KEY,
                    ingredientCode TEXT NOT NULL,
                    ingredientName TEXT NOT NULL,
                    unitId BLOB NOT NULL,
                    warehouseId BLOB NOT NULL,
                    referencePrice TEXT NOT NULL,
                    isFreshDaily INTEGER NOT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE suppliers (
                    supplierId BLOB PRIMARY KEY,
                    supplierCode TEXT NOT NULL,
                    supplierName TEXT NOT NULL,
                    debtPolicy TEXT NULL,
                    invoicePolicy TEXT NULL,
                    contactName TEXT NULL,
                    phone TEXT NULL,
                    address TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE customers (
                    customerId BLOB PRIMARY KEY,
                    customerCode TEXT NOT NULL,
                    customerName TEXT NOT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE supplierquotations (
                    quotationId BLOB PRIMARY KEY,
                    supplierId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitPrice TEXT NOT NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE customercontracts (
                    contractId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    activeWeekDays TEXT NOT NULL,
                    shiftNames TEXT NOT NULL,
                    defaultMenuPrice TEXT NOT NULL,
                    defaultBomRatePercent TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE portionrules (
                    portionRuleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    dishId BLOB NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    activeWeekDays TEXT NULL,
                    shiftNames TEXT NULL,
                    menuVariant TEXT NULL,
                    menuSectionName TEXT NULL,
                    slotName TEXT NULL,
                    dishCategory TEXT NULL,
                    portionRatePercent TEXT NOT NULL,
                    bomRatePercent TEXT NULL,
                    yieldLossPercent TEXT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE menus (
                    menuId BLOB PRIMARY KEY,
                    menuCode TEXT NOT NULL,
                    menuName TEXT NOT NULL,
                    fromDate TEXT NULL,
                    toDate TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE dishes (
                    dishId BLOB PRIMARY KEY,
                    dishCode TEXT NOT NULL,
                    dishName TEXT NOT NULL,
                    dishGroup TEXT NULL,
                    dishType TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE menuitems (
                    menuItemId BLOB PRIMARY KEY,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    dishSlot TEXT NULL,
                    displayOrder INTEGER NOT NULL
                );
                CREATE TABLE dishbom (
                    bomId BLOB PRIMARY KEY,
                    dishId BLOB NOT NULL,
                    customerId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    priceTierAmount TEXT NOT NULL DEFAULT '25000.00',
                    grossQtyPerServing TEXT NOT NULL,
                    wasteRatePercent TEXT NOT NULL,
                    bomStatus TEXT NOT NULL DEFAULT 'PUBLISHED',
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL
                );
                CREATE TABLE menuschedules (
                    menuScheduleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    serviceDate TEXT NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    shiftName TEXT NOT NULL,
                    menuPrice TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    status TEXT NOT NULL,
                    menuVersionId BLOB NULL
                );
                CREATE TABLE menuversions (
                    menuVersionId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    versionNo INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    sourceFileName TEXT NULL,
                    sourceChecksum TEXT NULL,
                    sourceImportBatch TEXT NULL,
                    createdBy BLOB NULL,
                    createdAt TEXT NOT NULL,
                    publishedBy BLOB NULL,
                    publishedAt TEXT NULL,
                    updatedAt TEXT NOT NULL,
                    successRowCount INTEGER NOT NULL DEFAULT 0,
                    errorRowCount INTEGER NOT NULL DEFAULT 0,
                    warningRowCount INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE quantityimportbatches (
                    importBatchId BLOB PRIMARY KEY,
                    batchCode TEXT NOT NULL,
                    sourceCompanyName TEXT NULL,
                    sourceType TEXT NOT NULL,
                    importedBy BLOB NULL,
                    importedAt TEXT NOT NULL,
                    status TEXT NOT NULL
                );
                CREATE TABLE mealquantityplans (
                    quantityPlanId BLOB PRIMARY KEY,
                    importBatchId BLOB NULL,
                    planCode TEXT NOT NULL,
                    serviceDate TEXT NOT NULL,
                    status TEXT NOT NULL,
                    forecastReceivedAt TEXT NULL,
                    confirmedAt TEXT NULL,
                    confirmationTime TEXT NOT NULL,
                    confirmedBy BLOB NULL,
                    completedAt TEXT NULL,
                    completedBy BLOB NULL,
                    rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE mealquantityplanlines (
                    quantityPlanLineId BLOB PRIMARY KEY,
                    quantityPlanId BLOB NOT NULL,
                    menuScheduleId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    forecastServings INTEGER NOT NULL,
                    confirmedServings INTEGER NOT NULL,
                    adjustedServings INTEGER NOT NULL,
                    finalServings INTEGER NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplans (
                    planId BLOB PRIMARY KEY,
                    planCode TEXT NOT NULL,
                    planDate TEXT NOT NULL,
                    customerId BLOB NULL,
                    weekStartDate TEXT NULL,
                    menuVersionId BLOB NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    sentToKitchenAt TEXT NULL,
                    sentToKitchenBy BLOB NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplanlines (
                    planLineId BLOB PRIMARY KEY,
                    planId BLOB NOT NULL,
                    quantityPlanLineId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    totalServings INTEGER NOT NULL
                );
                CREATE TABLE materialrequests (
                    requestId BLOB PRIMARY KEY,
                    requestCode TEXT NOT NULL,
                    planId BLOB NOT NULL,
                    requestDate TEXT NOT NULL,
                    requestScope TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    approvedBy BLOB NULL,
                    approvedAt TEXT NULL
                );
                CREATE TABLE materialrequestlines (
                    requestLineId BLOB PRIMARY KEY,
                    requestId BLOB NOT NULL,
                    planLineId BLOB NOT NULL,
                    bomId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    priceTierAmount TEXT NOT NULL DEFAULT '25000.00',
                    bomScope TEXT NOT NULL DEFAULT 'global',
                    totalServings INTEGER NOT NULL,
                    grossQtyPerServing TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    appliedPortionRuleId BLOB NULL,
                    appliedPortionRatePercent TEXT NOT NULL DEFAULT '100.00',
                    appliedPortionRuleSource TEXT NOT NULL DEFAULT 'CONTRACT_DEFAULT',
                    yieldLossPercent TEXT NULL,
                    totalRequiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
                    suggestedPurchaseQty TEXT NOT NULL
                );
                CREATE TABLE purchaserequests (
                    purchaseRequestId BLOB PRIMARY KEY,
                    purchaseRequestCode TEXT NOT NULL,
                    requestDate TEXT NOT NULL,
                    purchaseForDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    approvedBy BLOB NULL,
                    approvedAt TEXT NULL
                );
                CREATE TABLE purchaserequestlines (
                    purchaseRequestLineId BLOB PRIMARY KEY,
                    purchaseRequestId BLOB NOT NULL,
                    materialRequestLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    requiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
                    purchaseQty TEXT NOT NULL,
                    estimatedUnitPrice TEXT NOT NULL,
                    expectedDeliveryDate TEXT NULL,
                    note TEXT NULL
                );
                CREATE TABLE purchaseorders (
                    purchaseOrderId BLOB PRIMARY KEY,
                    purchaseOrderCode TEXT NOT NULL,
                    purchaseRequestId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    orderDate TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ORDERED',
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE purchaseorderlines (
                    purchaseOrderLineId BLOB PRIMARY KEY,
                    purchaseOrderId BLOB NOT NULL,
                    purchaseRequestLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    orderedQty TEXT NOT NULL,
                    receivedQty TEXT NOT NULL,
                    unitPrice TEXT NOT NULL
                );
                CREATE TABLE currentstock (
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL,
                    rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (warehouseId, ingredientId)
                );
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
                CREATE TABLE stockmovements (
                    movementId BLOB PRIMARY KEY,
                    movementDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL,
                    movementType TEXT NOT NULL,
                    refTable TEXT NULL,
                    refId BLOB NULL,
                    quantityIn TEXT NOT NULL,
                    quantityOut TEXT NOT NULL,
                    beforeQty TEXT NOT NULL DEFAULT '0',
                    afterQty TEXT NOT NULL DEFAULT '0',
                    reason TEXT NULL,
                    note TEXT NULL,
                    performedBy BLOB NOT NULL
                );
                CREATE TABLE stocksnapshots (
                    snapshotId BLOB PRIMARY KEY,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    periodMonth TEXT NOT NULL,
                    openingQty TEXT NOT NULL,
                    quantityIn TEXT NOT NULL,
                    quantityOut TEXT NOT NULL,
                    closingQty TEXT NOT NULL,
                    generatedAt TEXT NOT NULL
                );
                CREATE TABLE auditlogs (
                    auditId BLOB PRIMARY KEY,
                    changedAt TEXT NOT NULL,
                    changedBy BLOB NOT NULL,
                    businessArea TEXT NOT NULL,
                    entityName TEXT NOT NULL,
                    entityId BLOB NULL,
                    fieldName TEXT NULL,
                    oldValue TEXT NULL,
                    newValue TEXT NULL,
                    reason TEXT NULL
                );
                CREATE TABLE approvalhistories (
                    approvalHistoryId BLOB PRIMARY KEY,
                    targetType TEXT NOT NULL,
                    targetId BLOB NOT NULL,
                    decision TEXT NOT NULL,
                    oldStatus TEXT NULL,
                    newStatus TEXT NULL,
                    reason TEXT NULL,
                    actionBy BLOB NOT NULL,
                    actionAt TEXT NOT NULL
                );
                CREATE TABLE inventoryreceipts (
                    receiptId BLOB PRIMARY KEY,
                    receiptCode TEXT NOT NULL,
                    receiptDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    purchaseRequestId BLOB NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE inventoryreceiptlines (
                    receiptLineId BLOB PRIMARY KEY,
                    receiptId BLOB NOT NULL,
                    purchaseRequestLineId BLOB NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    quantity TEXT NOT NULL,
                    unitPrice TEXT NOT NULL,
                    amount TEXT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL
                );
                CREATE TABLE inventoryissues (
                    issueId BLOB PRIMARY KEY,
                    issueCode TEXT NOT NULL,
                    issueDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    warehouseId BLOB NOT NULL,
                    materialRequestId BLOB NOT NULL,
                    issuedBy BLOB NOT NULL,
                    receivedBy BLOB NULL,
                    receivedAt TEXT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE inventoryissuelines (
                    issueLineId BLOB PRIMARY KEY,
                    issueId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    requestedQty TEXT NOT NULL,
                    issuedQty TEXT NOT NULL
                );
                CREATE TABLE inventoryreturns (
                    returnId BLOB PRIMARY KEY,
                    returnCode TEXT NOT NULL,
                    returnDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    returnType TEXT NOT NULL DEFAULT 'RETURN',
                    warehouseId BLOB NOT NULL,
                    issueId BLOB NOT NULL,
                    reason TEXT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    receivedBy BLOB NULL,
                    receivedAt TEXT NULL
                );
                CREATE TABLE inventoryreturnlines (
                    returnLineId BLOB PRIMARY KEY,
                    returnId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    quantity TEXT NOT NULL
                );
                CREATE TABLE quantityadjustments (
                    adjustmentId BLOB PRIMARY KEY,
                    quantityPlanLineId BLOB NOT NULL,
                    oldServings INTEGER NOT NULL,
                    newServings INTEGER NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                CREATE TABLE bomadjustments (
                    bomAdjustmentId BLOB PRIMARY KEY,
                    bomId BLOB NOT NULL,
                    oldGrossQtyPerServing TEXT NOT NULL,
                    oldWasteRatePercent TEXT NOT NULL,
                    newGrossQtyPerServing TEXT NOT NULL,
                    newWasteRatePercent TEXT NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
