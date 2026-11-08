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
            context.Inventoryreceipts.Add(new InventoryReceipt
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
                    new InventoryReceiptLine
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            await ApproveDemandAsync(context, materialRequestId);
        }

        await using (var context = fixture.CreateContext())
        {
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            purchase!.Lines.Should().ContainSingle();
            purchase.Lines.Single().SupplierId.Should().BeNull();
            purchase.Lines.Single().EstimatedUnitPrice.Should().Be(0m);
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_KeepLinesSupplierNeutral_UntilExplicitSelection()
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
            context.Inventoryreceipts.Add(new InventoryReceipt
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
                    new InventoryReceiptLine
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            await ApproveDemandAsync(context, materialRequestId);
        }

        await using (var context = fixture.CreateContext())
        {
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            var line = purchase!.Lines.Should().ContainSingle().Subject;
            line.SupplierId.Should().BeNull();
            line.SupplierName.Should().BeNull();
            line.EstimatedUnitPrice.Should().Be(0m);

            var savedLine = await context.Purchaserequestlines
                .Include(item => item.Supplier)
                .AsNoTracking()
                .SingleAsync();
            savedLine.SupplierId.Should().BeNull();
            savedLine.Supplier.Should().BeNull();
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_NotRequireActiveSupplierBeforeDraftSelection()
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            await ApproveDemandAsync(context, materialRequestId);
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var purchase = await service.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            purchase!.Lines.Should().ContainSingle().Which.SupplierId.Should().BeNull();
            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            await ApproveDemandAsync(context, demand!.MaterialRequestId);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
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
                newSupplierId,
                12345.678m,
                new DateOnly(2026, 6, 16),
                "Giao trước 9h");

            var savedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
            savedLine.SupplierId.Should().Equal(newSupplierId);
            savedLine.EstimatedUnitPrice.Should().Be(12345.68m);
            savedLine.ExpectedDeliveryDate.Should().Be(new DateOnly(2026, 6, 16));
            savedLine.Note.Should().Be("Giao trước 9h");

            var audit = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "Purchasing" && item.FieldName == "ConfirmSupplierDecision")
                .SingleAsync();
            audit.ChangedBy.Should().Equal(fixture.UserId);
            audit.EntityName.Should().Be(nameof(PurchaseLineSupplierDecision));
            audit.OldValue.Should().BeNull();
            audit.NewValue.Should().HaveLength(64);
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            await ApproveDemandAsync(context, demand!.MaterialRequestId);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
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
            var reportLine = (await new PurchasingReportService(context).GetPurchaseDemandAsync(new WorkflowReportQueryDto
            {
                Limit = 100
            })).Single();

            reportLine.ReferenceUnitPrice.Should().Be(1000m);
            reportLine.PriceVariancePercent.Should().Be(20m);
            reportLine.IsPriceWarning.Should().BeTrue();

            var handler = new PurchaseRequestApprovalHandler(context);
            var act = async () => await handler.HandleAsync(
                purchaseRequestId,
                new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Approve PR" },
                fixture.UserId);

            await act.Should().ThrowAsync<BusinessRuleException>()
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            await SelectDefaultSupplierAsync(context, fixture, purchase);
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
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            regenerated.Should().NotBeNull();
            regenerated!.Status.Should().Be("SENTTOSUPPLIER");
            regenerated.Lines.Should().ContainSingle();
            (await context.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(1);
        }
    }

    [Fact]
    public async Task SubmitPurchaseRequest_Should_AllowLinkedSupplementalRequest_AfterPartialWarehouseFulfillment()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

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
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var service = CreatePurchaseRequestWorkflowService(context);
        var purchase = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        await SelectDefaultSupplierAsync(context, fixture, purchase!);

        var purchaseLine = await context.Purchaserequestlines.SingleAsync();
        var supplementalId = GuidHelper.NewId();
        context.Supplementalmaterialrequests.Add(new SupplementalMaterialRequest
        {
            RequestId = supplementalId,
            RequestCode = "SUP-PARTIAL-TEST",
            IssueId = GuidHelper.NewId(),
            IssueLineId = GuidHelper.NewId(),
            WarehouseId = fixture.WarehouseId,
            IngredientId = purchaseLine.IngredientId,
            UnitId = purchaseLine.UnitId,
            RequestedQty = purchaseLine.PurchaseQty + 0.1m,
            Status = "PARTIALLY_FULFILLED",
            RequestedBy = fixture.UserId,
            RequestedAt = DateTime.UtcNow,
        });
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = GuidHelper.NewId(),
            MovementDate = DateTime.UtcNow,
            WarehouseId = fixture.WarehouseId,
            IngredientId = purchaseLine.IngredientId,
            UnitId = purchaseLine.UnitId,
            MovementType = "ISSUE",
            RefTable = "supplementalmaterialrequests",
            RefId = supplementalId,
            QuantityOut = 0.1m,
            BeforeQty = 1,
            AfterQty = 0.9m,
            PerformedBy = fixture.UserId,
        });
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = fixture.UserId,
            BusinessArea = "SupplementalMaterial",
            EntityName = nameof(SupplementalMaterialRequest),
            EntityId = supplementalId,
            FieldName = "PurchaseRequestId",
            NewValue = purchase!.PurchaseRequestId,
            Reason = "Linked supplemental purchase regression test",
        });
        await context.SaveChangesAsync();

        var submitted = await service.SubmitAsync(purchase.PurchaseRequestId, fixture.UserIdString);

        submitted!.Status.Should().Be("SENTTOSUPPLIER");
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            await ApproveDemandAsync(context, demand!.MaterialRequestId);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "DRAFT";
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
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

            await act.Should().ThrowAsync<BusinessRuleException>()
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            await SelectDefaultSupplierAsync(context, fixture, purchase);
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

            await act.Should().ThrowAsync<BusinessRuleException>()
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
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            await SelectDefaultSupplierAsync(context, fixture, purchase);
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

            await act.Should().ThrowAsync<BusinessRuleException>()
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
            var service = CreatePurchaseRequestWorkflowService(context);
            var act = async () => await service.SubmitAsync(purchaseRequestId, fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("Có dòng mua cần ngoại lệ giá được Quản lý duyệt trước khi gửi đơn mua.");
            (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
                .Should().Be("DRAFT");
        }
    }

}
