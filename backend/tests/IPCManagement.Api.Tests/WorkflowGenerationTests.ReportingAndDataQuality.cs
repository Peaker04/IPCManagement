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
    public async Task AuditReport_Should_IncludeImportApprovalReceiptIssueAndSignoffRows()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var materialRequest = await SeedReportDocumentsAsync(context, fixture);
            var customerId = await context.Customers.Select(item => item.CustomerId).SingleAsync();
            context.Menuversions.Add(new MenuVersion
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
            context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow.AddMinutes(-1),
                ChangedBy = fixture.UserId,
                BusinessArea = "Coordination",
                EntityName = nameof(MealQuantityPlan),
                EntityId = fixture.QuantityPlanId,
                FieldName = nameof(MealQuantityPlan.Status),
                OldValue = "CONFIRMED",
                NewValue = "COMPLETED",
                Reason = "Hoàn tất ca điều phối"
            });
            await context.SaveChangesAsync();

            var service = new AuditReportService(context);
            var rows = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 20 });
            var areas = rows.Select(item => item.BusinessArea).ToList();

            areas.Should().Contain(["Import", "Approval", "Receipt", "Issue", "Signoff"]);
            var menuImport = rows.Single(item => item.EntityName == nameof(MenuVersion) && item.FieldName == "WeeklyMenu");
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
            new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = baseDate,
                ChangedBy = fixture.UserId,
                BusinessArea = "Scale",
                EntityName = "Report",
                FieldName = "Newest",
                NewValue = "3"
            },
            new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = baseDate.AddDays(-1),
                ChangedBy = fixture.UserId,
                BusinessArea = "Scale",
                EntityName = "Report",
                FieldName = "Middle",
                NewValue = "2"
            },
            new AuditLog
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

        var service = new AuditReportService(context);
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
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = missingConversionUnitId,
            CurrentQty = -2,
            LastUpdated = DateTime.UtcNow
        });
        context.Materialrequests.Add(new MaterialRequest
        {
            RequestId = orphanRequestId,
            RequestCode = "MR-ORPHAN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = orphanPurchaseRequestId,
            PurchaseRequestCode = "PR-ORPHAN",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "CANCELLED",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequestlines.Add(new PurchaseRequestLine
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
        context.Inventoryissues.Add(new InventoryIssue
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

        var service = new DataQualityReportService(context);
        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });

        report.TotalIssues.Should().BeGreaterThanOrEqualTo(5);
        report.ErrorCount.Should().BeGreaterThanOrEqualTo(3);
        report.WarningCount.Should().BeGreaterThanOrEqualTo(3);
        report.MissingBomCount.Should().Be(0);
        report.InvalidUnitCount.Should().BeGreaterThanOrEqualTo(1);
        report.MissingConversionCount.Should().BeGreaterThanOrEqualTo(1);
        report.NegativeStockCount.Should().Be(1);
        report.OrphanDocumentCount.Should().BeGreaterThanOrEqualTo(3);
        report.UrgentIssueCount.Should().BeGreaterThanOrEqualTo(2);
        report.Issues.Select(issue => issue.Category).Should().Contain([
            "legacy_missing_bom",
            "invalid_unit",
            "missing_conversion",
            "negative_stock",
            "missing_contract",
            "missing_supplier",
            "stale_demand",
            "stale_purchase_request",
            "orphan_document"
        ]);
        var missingBomIssue = report.Issues.Single(issue => issue.Category == "legacy_missing_bom");
        missingBomIssue.Route.Should().Contain("/admin-data?");
        missingBomIssue.Route.Should().Contain("view=adjustments");
        missingBomIssue.Route.Should().Contain("remediate=missing_bom");
        missingBomIssue.Route.Should().Contain("dishId=");
        missingBomIssue.Route.Should().Contain("serviceDate=2026-06-15");
        missingBomIssue.Owner.Should().Be("Kitchen Admin");
        missingBomIssue.Severity.Should().Be("warning");
        missingBomIssue.PriorityRank.Should().Be(4);
        missingBomIssue.SlaHours.Should().Be(48);
        missingBomIssue.SlaLabel.Should().Be("P4 / 48h");

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
        var queryService = new DataQualityReportService(context);
        var commandService = new DataQualityCommandService(context);
        var initialReport = await queryService.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
        var missingBomIssue = initialReport.Issues.Single(issue => issue.Category == "legacy_missing_bom");

        await commandService.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequest
        {
            IssueId = missingBomIssue.IssueId,
            Action = "resolve",
            Note = "QA marked fixed"
        }, fixture.UserIdString);

        var resolvedReport = await queryService.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
        var stillVisibleIssue = resolvedReport.Issues.Single(issue => issue.IssueId == missingBomIssue.IssueId);
        stillVisibleIssue.RemediationStatus.Should().Be("resolved");
        stillVisibleIssue.RemediationNote.Should().Be("QA marked fixed");
        stillVisibleIssue.RemediationByName.Should().Be("Workflow Test");
        resolvedReport.ResolvedIssueCount.Should().Be(1);
        resolvedReport.TotalIssues.Should().Be(initialReport.TotalIssues);

        await commandService.UpdateDataQualityIssueRemediationAsync(new DataQualityIssueRemediationRequest
        {
            IssueId = missingBomIssue.IssueId,
            Action = "reopen",
            Note = "Root cause still exists"
        }, fixture.UserIdString);

        var reopenedReport = await queryService.GetDataQualityAsync(new WorkflowReportQueryDto { ServiceDate = "2026-06-15", Limit = 20 });
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

        context.Productionplanlines.Add(new ProductionPlanLine
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
            new MaterialRequest
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
                    new MaterialRequestLine
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
            new MaterialRequest
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
                    new MaterialRequestLine
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
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = "PR-PENDING",
            RequestDate = serviceDate,
            PurchaseForDate = serviceDate,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new PurchaseRequestLine
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
        context.Inventoryreceipts.Add(new InventoryReceipt
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
                new InventoryReceiptLine
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

        var dayRows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-06-15",
            DateTo = "2026-06-16",
            GroupBy = "day"
        });
        var weekRows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
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

        var reportService = new PurchasingReportService(context);
        var searchedPage = await reportService.GetPurchasePlanPageAsync(new PurchasePlanPageQueryDto
        {
            DateFrom = "2026-06-15",
            DateTo = "2026-06-16",
            GroupBy = "day",
            SearchKeyword = dayRows[0].IngredientName,
            PageNumber = 1,
            PageSize = 1,
        });
        searchedPage.TotalCount.Should().Be(2);
        searchedPage.Items.Should().ContainSingle();
        searchedPage.TotalShortageQty.Should().Be(19);

        var emptySearchPage = await reportService.GetPurchasePlanPageAsync(new PurchasePlanPageQueryDto
        {
            DateFrom = "2026-06-15",
            DateTo = "2026-06-16",
            SearchKeyword = "nguyên liệu không tồn tại",
            PageNumber = 1,
            PageSize = 20,
        });
        emptySearchPage.TotalCount.Should().Be(0);
        emptySearchPage.TotalShortageQty.Should().Be(0);
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

        context.Productionplanlines.Add(new ProductionPlanLine
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
            new MaterialRequest
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
                    new MaterialRequestLine
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
            new MaterialRequest
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
                    new MaterialRequestLine
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

        var dayRows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2027-12-31",
            DateTo = "2028-01-01",
            GroupBy = "day"
        });
        var weekRows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
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

        foreach (var (requestCode, requestDate, requiredQty, suggestedQty) in new[]
        {
            ("MR-2025-OLD", new DateOnly(2025, 12, 31), 10m, 9m),
            ("MR-2026-IN-RANGE", new DateOnly(2026, 6, 15), 20m, 18m),
            ("MR-2027-FUTURE", new DateOnly(2027, 1, 1), 30m, 27m)
        })
        {
            var requestId = GuidHelper.NewId();
            context.Materialrequests.Add(new MaterialRequest
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
                        TotalRequiredQty = requiredQty,
                        CurrentStockQty = 1,
                        SuggestedPurchaseQty = suggestedQty
                    }
                ]
            });
        }

        await context.SaveChangesAsync();

        var rows = await new PurchasingReportService(context).GetPurchasePlanAsync(new WorkflowReportQueryDto
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

}
