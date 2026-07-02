using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Approvals;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.Api.Services.Workflow;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Reflection;
using System.Security.Claims;

namespace IPCManagement.Api.Tests;

public class WorkflowGenerationTests
{
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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

            var purchaseService = new PurchaseRequestWorkflowService(context);
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
            var purchaseService = new PurchaseRequestWorkflowService(context);
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
                RowVersion = [1]
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
                RowVersion = [1]
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
                RowVersion = [1]
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
            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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
            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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
            var service = new PurchaseRequestWorkflowService(context);
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
            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new PurchaseRequestWorkflowService(context);
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
            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new PurchaseRequestWorkflowService(context);
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new PurchaseRequestWorkflowService(context);
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
            var service = new PurchaseRequestWorkflowService(context);
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

            var regenerated = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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
            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new PurchaseRequestWorkflowService(context);
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
            var service = new PurchaseRequestWorkflowService(context);
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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
            var service = new PurchaseRequestWorkflowService(context);
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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
            var service = new PurchaseRequestWorkflowService(context);
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);

            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new PurchaseRequestWorkflowService(context);
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
            var service = new PurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi gửi đơn mua.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
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
                RowVersion = [1]
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
                RowVersion = [1]
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

        var purchaseService = new PurchaseRequestWorkflowService(context);
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

        var service = new ApprovalInboxService(context);
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            await new PurchaseRequestWorkflowService(context).UpdateLineSupplierAsync(
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
            var inbox = await new ApprovalInboxService(context)
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

            var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await new PurchaseRequestWorkflowService(context).SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
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
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = orphanPurchaseRequestId,
            PurchaseRequestCode = "PR-ORPHAN",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
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
        report.Issues.Select(issue => issue.Category).Should().Contain([
            "missing_bom",
            "invalid_unit",
            "missing_conversion",
            "negative_stock",
            "orphan_document"
        ]);
        var missingBomIssue = report.Issues.Single(issue => issue.Category == "missing_bom");
        missingBomIssue.Route.Should().Contain("/admin-data?");
        missingBomIssue.Route.Should().Contain("view=adjustments");
        missingBomIssue.Route.Should().Contain("remediate=missing_bom");
        missingBomIssue.Route.Should().Contain("dishId=");
        missingBomIssue.Route.Should().Contain("serviceDate=2026-06-15");
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
        updated.DefaultBomRatePercent.Should().Be(135);

        var contractRow = await context.Customercontracts.AsNoTracking().SingleAsync();
        contractRow.DefaultMenuPrice.Should().Be(43000);
        contractRow.DefaultBomRatePercent.Should().Be(135);
        contractRow.ActiveWeekDays.Should().Be("t2");
        contractRow.ShiftNames.Should().Be("MORNING");

        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        schedule.MenuPrice.Should().Be(43000);
        schedule.BomRatePercent.Should().Be(135);

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .ToListAsync();
        audits.Should().HaveCountGreaterThanOrEqualTo(5);
        audits.Select(item => item.FieldName).Should().Contain([
            nameof(Customer.Note),
            nameof(Customer.IsActive),
            "ContractCreated",
            nameof(Menuschedule.MenuPrice),
            nameof(Menuschedule.BomRatePercent)
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
        created.DefaultBomRatePercent.Should().Be(120);

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
        resolvedDish.BomRatePercent.Should().Be(110);

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
            line.TotalRequiredQty.Should().Be(125m);
            line.BomRatePercent.Should().Be(125m);
            line.AppliedPortionRuleId.Should().Be(portionRuleId);
            line.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            line.AppliedPortionRatePercent.Should().Be(50m);

            var savedLine = await context.Materialrequestlines.AsNoTracking().SingleAsync();
            GuidHelper.ToGuidString(savedLine.AppliedPortionRuleId!).Should().Be(portionRuleId);
            savedLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            savedLine.AppliedPortionRatePercent.Should().Be(50m);
            savedLine.BomRatePercent.Should().Be(125m);

            var reportLine = (await new WorkflowReportService(context).GetIngredientDemandAsync(new WorkflowReportQueryDto
            {
                CustomerId = customerId,
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15"
            })).Single();
            reportLine.AppliedPortionRuleId.Should().Be(portionRuleId);
            reportLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            reportLine.AppliedPortionRatePercent.Should().Be(50m);
            reportLine.BomRatePercent.Should().Be(125m);
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
                    MenuPrice = 42000,
                    BomRatePercent = 125,
                    Reason = "Customer premium portion"
                },
                fixture.UserIdString);

            updated.Should().NotBeNull();
            updated!.MenuPrice.Should().Be(42000);
            updated.BomRatePercent.Should().Be(125);
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var line = demand!.Lines.Single();
            line.BomRatePercent.Should().Be(125);
            line.TotalRequiredQty.Should().Be(250);
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
    public async Task WeeklyMenuReimport_Should_CancelDownstreamDemandAndPurchase_ForCustomerWeek()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var purchase = await new PurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
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

    private static InventoryIssueService CreateInventoryIssueService(IpcManagementContext context)
        => new(
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)));

    private static async Task<string> SeedSubmittedPurchaseRequestAsync(WorkflowFixture fixture)
    {
        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = new PurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

        return purchase.PurchaseRequestId;
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
        public byte[] SupplierId { get; } = GuidHelper.NewId();
        public byte[] QuantityPlanId { get; } = GuidHelper.NewId();
        public byte[] ProductionPlanId { get; } = GuidHelper.NewId();
        public byte[] DishWithBomId { get; } = GuidHelper.NewId();
        public byte[] ReceiptId { get; } = GuidHelper.NewId();
        public byte[] IssueId { get; } = GuidHelper.NewId();

        public static async Task<WorkflowFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;

            await CreateMinimalWorkflowSchemaAsync(connection);

            return new WorkflowFixture(connection, options);
        }

        public IpcManagementContext CreateContext() => new(_options);

        public async Task SeedMenuWithDemandAsync(bool includeMissingDish)
        {
            await using var context = CreateContext();

            var roleId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
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
                CustomerId = customerId,
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
                CustomerId = customerId,
                MenuId = menuId,
                ServiceDate = new DateOnly(2026, 6, 15),
                WeekStartDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                MenuPrice = 50000,
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
                CustomerId = customerId,
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
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
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
                    status TEXT NOT NULL
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
                    updatedAt TEXT NOT NULL
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
                    confirmedBy BLOB NULL
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
                    finalServings INTEGER NOT NULL
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
                    createdAt TEXT NOT NULL
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
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
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
                CREATE TABLE currentstock (
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL,
                    rowVersion BLOB NOT NULL DEFAULT (X'01'),
                    PRIMARY KEY (warehouseId, ingredientId)
                );
                CREATE TABLE stockmovements (
                    movementId BLOB PRIMARY KEY,
                    movementDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    movementType TEXT NOT NULL,
                    refTable TEXT NULL,
                    refId BLOB NULL,
                    quantityIn TEXT NOT NULL,
                    quantityOut TEXT NOT NULL,
                    reason TEXT NULL,
                    note TEXT NULL,
                    performedBy BLOB NOT NULL
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
