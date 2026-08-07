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
    public async Task CreateInventoryReceiptFromPurchase_Should_CreateReceipt_IncreaseStock_AndMarkPurchaseReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchaseService = CreatePurchaseRequestWorkflowService(context);
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await SelectDefaultSupplierAsync(context, fixture, purchase!);
            await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
            purchaseRequestId = purchase.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreateInventoryReceiptService(context);
            var result = await service.CreateFromPurchaseRequestAsync(new CreateInventoryReceiptFromPurchaseRequest
            {
                PurchaseRequestId = purchaseRequestId,
                ReceiptDate = new DateOnly(2026, 6, 15),
                SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                Lines =
                [
                    new CreateInventoryReceiptFromPurchaseLineRequest
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
                .SingleAsync(item => item.BusinessArea == "Receipt" && item.FieldName == nameof(PurchaseRequest.Status));
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
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
            var result = await service.CreateAsync(new CreateInventoryIssueRequest
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
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
            var created = await issueService.CreateAsync(new CreateInventoryIssueRequest
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId
            }, fixture.UserIdString);
            issueId = created!.IssueId;

            var beforeConfirm = await new InventoryOperationsReportService(context).GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 10 });
            beforeConfirm.Should().ContainSingle().Which.Should().Match<KitchenIssueReportDto>(row =>
                row.MaterialRequestId == materialRequestId &&
                row.IsReceivedByKitchen == false &&
                row.ReceivedAt == null &&
                row.ReceiptStatus == "Chờ bếp nhận");
        }

        await using (var context = fixture.CreateContext())
        {
            var issueService = CreateInventoryIssueService(context);
            var confirmed = await issueService.ConfirmReceiptAsync(
                issueId,
                new ConfirmInventoryIssueReceiptRequest
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

            var afterConfirm = await new InventoryOperationsReportService(context).GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 10 });
            afterConfirm.Should().ContainSingle().Which.Should().Match<KitchenIssueReportDto>(row =>
                row.IsReceivedByKitchen &&
                row.ReceivedBy == fixture.UserIdString &&
                row.ReceivedAt != null &&
                row.ReceiptStatus == "Bếp đã nhận");

            var dataQuality = await new DataQualityReportService(context).GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });
            dataQuality.Issues.Should().Contain(issue =>
                issue.Category == "kitchen_receipt_discrepancy" &&
                issue.Message.Contains("Bếp báo chênh lệch"));
        }
    }

    [Fact]
    public async Task StockMovements_Should_ProjectKitchenReceiptState_ForStandardAndSupplementalIssues()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
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
            var created = await issueService.CreateAsync(new CreateInventoryIssueRequest
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
            await CreateInventoryIssueService(context).ConfirmReceiptAsync(
                issueId,
                new ConfirmInventoryIssueReceiptRequest(),
                fixture.UserIdString);

            var issued = await context.Inventoryissues.SingleAsync();
            var issueLine = await context.Inventoryissuelines.SingleAsync();
            var supplementalRequestId = GuidHelper.NewId();
            context.Supplementalmaterialrequests.Add(new SupplementalMaterialRequest
            {
                RequestId = supplementalRequestId,
                RequestCode = "SUP-RECEIVED",
                IssueId = issued.IssueId,
                IssueLineId = issueLine.IssueLineId,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                RequestedQty = 1m,
                Status = "FULFILLED",
                RequestedBy = fixture.UserId,
                RequestedAt = DateTime.UtcNow
            });
            context.Stockmovements.Add(new StockMovement
            {
                MovementId = GuidHelper.NewId(),
                MovementDate = DateTime.UtcNow,
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                MovementType = "ISSUE",
                RefTable = "supplementalmaterialrequests",
                RefId = supplementalRequestId,
                QuantityOut = 1m,
                BeforeQty = 50m,
                AfterQty = 49m,
                PerformedBy = fixture.UserId
            });
            await context.SaveChangesAsync();

            var rows = await new StockMovementReportService(context)
                .GetStockMovementsAsync(new WorkflowReportQueryDto { Limit = 10 });

            rows.Should().Contain(row => row.RefTable == "inventoryissues" && row.KitchenReceiptStatus == "RECEIVED");
            rows.Should().Contain(row => row.RefTable == "supplementalmaterialrequests" && row.KitchenReceiptStatus == "RECEIVED");
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
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
            var created = await issueService.CreateAsync(new CreateInventoryIssueRequest
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
            var retDto1 = await returnService.CreateAsync(new CreateInventoryReturnRequest
            {
                ReturnDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                ReturnType = "RETURN",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                IssueId = issueId,
                Reason = "Bếp trả nguyên liệu dư sau ca sáng.",
                Lines =
                [
                    new CreateInventoryReturnLineRequest
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        Quantity = 30m
                    }
                ]
            }, fixture.UserIdString);

            var retDto2 = await returnService.CreateAsync(new CreateInventoryReturnRequest
            {
                ReturnDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                ReturnType = "WASTE",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                IssueId = issueId,
                Reason = "Hao hụt sơ chế thực tế.",
                Lines =
                [
                    new CreateInventoryReturnLineRequest
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        Quantity = 20m
                    }
                ]
            }, fixture.UserIdString);

            await returnService.ConfirmReceiptAsync(retDto1!.ReturnId, new ConfirmInventoryReturnReceiptRequest(), fixture.UserIdString);
            await returnService.ConfirmReceiptAsync(retDto2!.ReturnId, new ConfirmInventoryReturnReceiptRequest(), fixture.UserIdString);

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

            var usage = await new InventoryOperationsReportService(context).GetIssueVsReturnAsync(new WorkflowReportQueryDto { Limit = 10 });
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = fixture.UnitId,
                CurrentQty = 300m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = DateTime.UtcNow
            });
            context.Inventoryissues.Add(new InventoryIssue
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
                    new InventoryIssueLine
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
            var act = async () => await service.CreateAsync(new CreateInventoryIssueRequest
            {
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                MaterialRequestId = materialRequestId,
                Lines =
                [
                    new CreateInventoryIssueLineRequest
                    {
                        IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
                        UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                        RequestedQty = 10m,
                        IssuedQty = 10m
                    }
                ]
            }, fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "SENTTOWAREHOUSE";
            context.Currentstocks.Add(new CurrentStock
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
            var act = async () => await service.CreateAsync(new CreateInventoryIssueRequest
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

            await act.Should().ThrowAsync<StockShortageException>();

            var audits = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "StockException")
                .ToListAsync();
            audits.Should().HaveCount(2);
            audits.Should().OnlyContain(audit =>
                audit.FieldName == "StockShortage" &&
                audit.NewValue != null &&
                audit.NewValue.Contains("missing=150"));

            var report = await new DataQualityReportService(context).GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 100 });
            report.Issues.Should().ContainSingle(issue =>
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchaseService = CreatePurchaseRequestWorkflowService(context);
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            await SelectDefaultSupplierAsync(context, fixture, purchase!);
            await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

            purchaseRequestId = purchase.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            var receiptService = CreateInventoryReceiptService(context);
            var overReceipt = async () => await receiptService.CreateFromPurchaseRequestAsync(
                new CreateInventoryReceiptFromPurchaseRequest
                {
                    PurchaseRequestId = purchaseRequestId,
                    ReceiptDate = new DateOnly(2026, 6, 15),
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    Lines =
                    [
                        new CreateInventoryReceiptFromPurchaseLineRequest
                        {
                            PurchaseRequestLineId = purchaseRequestLineId,
                            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                            ReceivedQty = 201m
                        }
                    ]
                },
                fixture.UserIdString);

            await overReceipt.Should().ThrowAsync<BusinessRuleException>()
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
                new CreateInventoryReceiptFromPurchaseRequest
                {
                    PurchaseRequestId = purchaseRequestId,
                    ReceiptDate = new DateOnly(2026, 6, 15),
                    SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    Lines =
                    [
                        new CreateInventoryReceiptFromPurchaseLineRequest
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
                new CreateInventoryIssueRequest
                {
                    IssueDate = new DateOnly(2026, 6, 15),
                    ShiftName = "MORNING",
                    WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
                    MaterialRequestId = materialRequestId,
                    Lines =
                    [
                        new CreateInventoryIssueLineRequest
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
            context.Materialrequests.Add(new MaterialRequest
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
                    new MaterialRequestLine
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
                new CreateInventoryIssueRequest
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

            var reconciliation = await new StockLedgerReportService(context).GetStockLedgerReconciliationAsync(
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
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await SelectDefaultSupplierAsync(context, fixture, purchase!);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

        materialRequest.Status = "SENTTOWAREHOUSE";
        context.Inventoryissues.Add(new InventoryIssue
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
                new InventoryIssueLine
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
        context.Quantityadjustments.Add(new QuantityAdjustment
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
        var managerInbox = await service.GetPendingAsync(BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 100 });
        var warehouseInbox = await service.GetPendingAsync(BuildPrincipal("Thủ kho"), new ApprovalInboxQueryDto { Limit = 100 });

        managerInbox.Select(item => item.ItemType).Should().Contain(["purchase", "issue", "adjustment"]);
        managerInbox.Should().OnlyContain(item => item.Status == "PENDING");
        managerInbox.Single(item => item.ItemType == "purchase").TargetType.Should().Be("purchase-request");

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
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await SelectDefaultSupplierAsync(context, fixture, purchase!);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
        var alertPurchaseId = GuidHelper.NewId();
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = alertPurchaseId,
            PurchaseRequestCode = "PR-CURSOR-ALERT",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new PurchaseRequestLine
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
        context.Inventoryissues.Add(new InventoryIssue
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
                new InventoryIssueLine
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
        context.Quantityadjustments.Add(new QuantityAdjustment
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
        expected.Select(item => item.ItemType).Should().Contain(["purchase", "issue", "adjustment"]);
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            await ConfirmSupplierFromQuotationAsync(
                context,
                fixture.UserIdString,
                purchaseRequestId,
                purchaseRequestLineId,
                fixture.SupplierId,
                1200m);
        }

        await using (var context = fixture.CreateContext())
        {
            var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
                .GetPendingAsync(BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 100 });

            var priceExceptionId = GuidHelper.ToGuidString(
                (await context.Purchasepriceexceptions.AsNoTracking().SingleAsync()).PurchasePriceExceptionId);
            var alert = inbox.Should().ContainSingle(item => item.ItemType == "price-exception").Subject;
            alert.TargetType.Should().Be("purchase-price-exception");
            alert.TargetId.Should().Be(priceExceptionId);
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await SelectDefaultSupplierAsync(context, fixture, purchase!);
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
                new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Đủ điều kiện mua" },
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
            new ApprovalRequest { Status = ApprovalDecision.Reject, Reason = " " },
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
            new ApprovalRequest { Status = ApprovalDecision.Reject, Reason = "Thiếu báo giá" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

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
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Không đúng quyền" },
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
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Lần đầu" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Lần hai" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Phiếu này đã được xử lý.");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("APPROVED");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(1);
    }

}
