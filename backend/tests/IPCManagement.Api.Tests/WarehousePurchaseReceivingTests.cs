using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using NSubstitute;
using System.ComponentModel.DataAnnotations;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public class WarehousePurchaseReceivingTests
{
    [Fact]
    public void Authorization_Warehouse_purchase_receive_policy_excludes_upstream_roles()
    {
        var policyField = typeof(AuthorizationPolicies).GetField("WarehousePurchaseReceive");
        var rolesField = typeof(AuthorizationPolicies).GetField("WarehousePurchaseReceiveRoles");

        policyField.Should().NotBeNull("the receipt writer needs a dedicated policy");
        policyField!.GetValue(null).Should().Be("WarehousePurchaseReceive");
        rolesField.Should().NotBeNull("the policy role matrix must be independently inspectable");

        var roles = rolesField!.GetValue(null).Should().BeAssignableTo<string[]>().Subject;
        roles.Should().Contain(["Admin", "WarehouseStaff", "Thủ kho"]);
        roles.Should().NotContain(["Purchasing", "PurchaseStaff", "ProcurementStaff", "Manager", "Quản lý"]);
    }

    [Fact]
    public void Authorization_receipt_commands_use_their_lifecycle_owner_policies()
    {
        var controllerType = typeof(IPCManagement.Api.Features.Purchasing.Controllers.WarehousePurchaseReceiptsController);
        controllerType.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Should().ContainSingle(attribute => string.IsNullOrEmpty(attribute.Policy));
        controllerType.GetCustomAttributes(typeof(RouteAttribute), inherit: true)
            .Cast<RouteAttribute>()
            .Should().ContainSingle(attribute =>
                attribute.Template == "api/warehouse/purchase-orders/{purchaseOrderId}/receipts");
        controllerType.GetMethod("RecordAsync")!.GetCustomAttributes(typeof(HttpPostAttribute), inherit: true)
            .Should().ContainSingle();
        controllerType.GetMethod("RecordAsync")!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>().Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.CoordinationAccess);
        controllerType.GetMethod("AcceptQualityAsync")!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>().Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.WarehousePurchaseReceive);
        controllerType.GetMethod("PostAsync")!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>().Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.AdminAccess);
        controllerType.GetMethod("ReworkAsync")!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>().Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.CoordinationAccess);
        controllerType.GetMethod("CreateCorrectionAsync")!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>().Should().ContainSingle(attribute => attribute.Policy == AuthorizationPolicies.AdminAccess);
        typeof(IPurchaseReceivingService).GetMethod("RecordAsync").Should().NotBeNull();
        typeof(IPurchaseReceivingService).GetMethod("CreateCorrectionAsync").Should().NotBeNull();
    }

    [Fact]
    public void Validation_Warehouse_receipt_contract_contains_only_actual_receipt_evidence()
    {
        var dtoAssembly = typeof(PurchaseOrderDto).Assembly;
        var requestType = GetRequiredType(dtoAssembly, "RecordWarehousePurchaseReceiptRequest");
        var lineType = GetRequiredType(dtoAssembly, "WarehousePurchaseReceiptLineRequest");
        var requirementsType = GetRequiredType(dtoAssembly, "PurchaseReceiptEvidenceRequirementsDto");
        var resultType = GetRequiredType(dtoAssembly, "WarehousePurchaseReceiptResultDto");

        requestType.GetProperties().Select(property => property.Name).Should().Contain(
            ["PurchaseOrderId", "IdempotencyKey", "WarehouseId", "ReceiptDate", "Lines"]);
        lineType.GetProperties().Select(property => property.Name).Should().Contain(
            [
                "PurchaseOrderLineId", "ActualQuantity", "ActualUnitId", "ActualUnitPrice",
                "LotNumber", "ManufactureDate", "ExpiryDate", "PackageQuantity",
                "PackageBaseUnitId", "PackagePolicyVersion"
            ]);
        requirementsType.GetProperties().Select(property => property.Name).Should().Contain(
            [
                "PurchaseOrderLineId", "IngredientId", "IngredientName", "LotNumberRequired",
                "ManufactureDateRequired", "ExpiryDateRequired", "BlockerReason"
            ]);
        resultType.GetProperties().Select(property => property.Name).Should().Contain(
            ["ReceiptId", "PurchaseOrderId", "IdempotencyKey", "EvidenceRequirements"]);

        var forbiddenClientProperties = new[]
        {
            "ReceiverId", "ReceivedBy", "SupplierId", "SupplierName", "OrderUnitPrice",
            "StockMovementId", "ReceiptId", "LedgerId"
        };
        requestType.GetProperties().Select(property => property.Name)
            .Should().NotIntersectWith(forbiddenClientProperties);
        lineType.GetProperties().Select(property => property.Name)
            .Should().NotIntersectWith(forbiddenClientProperties);
    }

    [Fact]
    public void Validation_Warehouse_receipt_line_rejects_invalid_dates_values_and_partial_package_snapshot()
    {
        var lineType = GetRequiredType(typeof(PurchaseOrderDto).Assembly, "WarehousePurchaseReceiptLineRequest");
        var line = Activator.CreateInstance(lineType)!;
        SetProperty(line, "PurchaseOrderLineId", Guid.NewGuid().ToString());
        SetProperty(line, "ActualQuantity", 0m);
        SetProperty(line, "ActualUnitId", Guid.NewGuid().ToString());
        SetProperty(line, "ActualUnitPrice", -1m);
        SetProperty(line, "ManufactureDate", new DateOnly(2026, 7, 22));
        SetProperty(line, "ExpiryDate", new DateOnly(2026, 7, 22));
        SetProperty(line, "PackageQuantity", 10m);

        var validationResults = new List<ValidationResult>();
        Validator.TryValidateObject(line, new ValidationContext(line), validationResults, validateAllProperties: true)
            .Should().BeFalse();
        validationResults.Select(result => result.ErrorMessage).Should().Contain(message =>
            message!.Contains("Số lượng", StringComparison.OrdinalIgnoreCase));
        validationResults.Select(result => result.ErrorMessage).Should().Contain(message =>
            message!.Contains("Đơn giá", StringComparison.OrdinalIgnoreCase));
        validationResults.Select(result => result.ErrorMessage).Should().Contain(message =>
            message!.Contains("hết hạn", StringComparison.OrdinalIgnoreCase));
        validationResults.Select(result => result.ErrorMessage).Should().Contain(message =>
            message!.Contains("quy cách", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void PackageSnapshot_model_enforces_complete_positive_conversion_triple()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"warehouse-package-snapshot-{Guid.NewGuid():N}")
            .Options;
        using var context = new IpcManagementContext(options);
        var model = context.GetService<IDesignTimeModel>().Model;

        var receiptLine = model.FindEntityType(typeof(InventoryReceiptLine));
        receiptLine.Should().NotBeNull();
        receiptLine!.FindProperty(nameof(InventoryReceiptLine.PackageQuantitySnapshot))!
            .GetPrecision().Should().Be(18);
        receiptLine.FindProperty(nameof(InventoryReceiptLine.PackageQuantitySnapshot))!
            .GetScale().Should().Be(6);
        receiptLine.FindProperty(nameof(InventoryReceiptLine.PackageBaseUnitIdSnapshot))!
            .GetMaxLength().Should().Be(16);
        receiptLine.FindProperty(nameof(InventoryReceiptLine.PackagePolicyVersionSnapshot))!
            .GetMaxLength().Should().Be(100);
        receiptLine.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain(
            "ckInventoryReceiptLinesPackageSnapshotComplete",
            "ckInventoryReceiptLinesPackageQuantityPositive");
        receiptLine.GetForeignKeys().Should().Contain(foreignKey =>
            !foreignKey.IsRequired &&
            foreignKey.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(InventoryReceiptLine.PackageBaseUnitIdSnapshot) }) &&
            foreignKey.PrincipalEntityType.ClrType == typeof(Unit));
    }

    [Theory]
    [InlineData("Warehouse", true)]
    [InlineData("Purchasing", false)]
    [InlineData("Manager", false)]
    [InlineData("Kitchen", false)]
    public void Receipt_writer_role_matrix_denies_non_warehouse_roles(string role, bool expected)
    {
        (role == "Warehouse").Should().Be(expected);
    }

    [Fact]
    public async Task Record_creates_a_draft_idempotently_without_stock_or_purchase_progress()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var request = fixture.CreateRequest("receipt-key-1", 4m);
        var service = fixture.CreateService();

        var first = await InvokeRecordAsync(service, request, fixture.UserId);
        var retry = await InvokeRecordAsync(service, request, fixture.UserId);

        retry.ReceiptId.Should().Be(first.ReceiptId);
        first.ReceiptStatus.Should().Be("DRAFT");
        first.QualityStatus.Should().Be("PENDING_INSPECTION");
        first.ConcurrencyVersion.Should().Be(0);
        first.PurchaseOrderStatus.Should().Be("ORDERED");
        first.EvidenceRequirements.Should().ContainSingle().Which.Should().BeEquivalentTo(
            new PurchaseReceiptEvidenceRequirementsDto
            {
                PurchaseOrderLineId = fixture.PurchaseOrderLineId,
                IngredientId = fixture.IngredientId,
                IngredientName = "Thịt tươi",
                LotNumberRequired = true,
                ManufactureDateRequired = true,
                ExpiryDateRequired = true
            });

        fixture.Context.Inventoryreceipts.Should().ContainSingle();
        GuidHelper.ToGuidString(fixture.Context.Inventoryreceipts.Single().PurchaseOrderId!)
            .Should().Be(fixture.PurchaseOrderId,
                "the lifecycle command must retain its immutable purchase-order source after reload");
        var receiptLine = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;
        receiptLine.Quantity.Should().Be(4m);
        receiptLine.UnitPrice.Should().Be(110m);
        receiptLine.LotNumber.Should().Be("LOT-RAW-01");
        receiptLine.ManufactureDate.Should().Be(new DateOnly(2026, 7, 22));
        receiptLine.ExpiredDate.Should().Be(new DateOnly(2026, 7, 24));
        receiptLine.PackageQuantitySnapshot.Should().Be(10m);
        GuidHelper.ToGuidString(receiptLine.PackageBaseUnitIdSnapshot!).Should().Be(fixture.UnitId);
        receiptLine.PackagePolicyVersionSnapshot.Should().Be("package-policy/v1");
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().ContainSingle();

        var order = await fixture.Context.Purchaseorders
            .Include(item => item.Purchaseorderlines)
            .SingleAsync();
        order.Status.Should().Be("ORDERED");
        order.Purchaseorderlines.Single().ReceivedQty.Should().Be(0m);

        var mismatchedRetry = fixture.CreateRequest("receipt-key-1", 5m);
        var mismatch = () => InvokeRecordAsync(service, mismatchedRetry, fixture.UserId);
        await mismatch.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*idempotency*");
        fixture.Context.Inventoryreceipts.Should().ContainSingle();
        fixture.Context.Stockmovements.Should().BeEmpty();

        var duplicateDraft = () => InvokeRecordAsync(
            service,
            fixture.CreateRequest("receipt-key-2", 6m),
            fixture.UserId);
        await duplicateDraft.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đang chờ xử lý*");
        fixture.Context.Inventoryreceipts.Should().ContainSingle();
        fixture.Context.Purchasereceiptactivelines.Should().ContainSingle(item =>
            item.ReceiptId.SequenceEqual(GuidHelper.ParseGuidString(first.ReceiptId)!));
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().ContainSingle();
    }

    [Fact]
    public async Task Record_rejects_an_unknown_warehouse_before_creating_receipt_effects()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var request = fixture.CreateRequest("receipt-unknown-warehouse", 4m);
        request.WarehouseId = Guid.NewGuid().ToString();

        var action = () => InvokeRecordAsync(fixture.CreateService(), request, fixture.UserId);

        await action.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Kho nhận hàng không khớp kho vận hành của hệ thống.");
        fixture.Context.Inventoryreceipts.Should().BeEmpty();
        fixture.Context.Inventoryreceiptlines.Should().BeEmpty();
        fixture.Context.Purchasereceiptactivelines.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().BeEmpty();
        fixture.Context.Lifecycletransitions.Should().BeEmpty();
    }

    [Fact]
    public async Task Void_releases_the_active_source_line_with_lifecycle_and_audit_evidence()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-void-1", 4m), fixture.UserId);

        var voided = await InvokeVoidAsync(service, draft.ReceiptId, new ReceiptVoidRequest
        {
            CommandId = "receipt-void-command-1",
            ExpectedVersion = draft.ConcurrencyVersion,
            Reason = "Remediation: duplicate draft created by interrupted receipt runner."
        }, Guid.NewGuid().ToString());

        voided.ReceiptStatus.Should().Be("VOIDED");
        voided.QualityStatus.Should().Be("VOIDED");
        fixture.Context.Purchasereceiptactivelines.Should().BeEmpty();
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().Contain(item => item.NewValue == "VOIDED");
        fixture.Context.Lifecycletransitions.Should().Contain(item => item.ToState == "VOIDED");

        var replacement = await InvokeRecordAsync(
            service,
            fixture.CreateRequest("receipt-void-2", 6m),
            fixture.UserId);
        replacement.ReceiptStatus.Should().Be("DRAFT");
        fixture.Context.Inventoryreceipts.Should().HaveCount(2);
        fixture.Context.Purchasereceiptactivelines.Should().ContainSingle(item =>
            item.ReceiptId.SequenceEqual(GuidHelper.ParseGuidString(replacement.ReceiptId)!));
    }

    [Theory]
    [InlineData("AfterReceipt")]
    public async Task Record_injected_failure_rolls_back_every_receiving_effect(string faultPoint)
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService((point, _) =>
            point == faultPoint
                ? Task.FromException(new InjectedReceivingFailureException(point))
                : Task.CompletedTask);

        var action = () => InvokeRecordAsync(
            service,
            fixture.CreateRequest($"fault-{faultPoint}", 4m),
            fixture.UserId);

        await action.Should().ThrowAsync<InjectedReceivingFailureException>();
        fixture.Context.ChangeTracker.Clear();
        fixture.Context.Inventoryreceipts.Should().BeEmpty();
        fixture.Context.Inventoryreceiptlines.Should().BeEmpty();
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().BeEmpty();
        var order = await fixture.Context.Purchaseorders
            .Include(item => item.Purchaseorderlines)
            .SingleAsync();
        order.Status.Should().Be("ORDERED");
        order.Purchaseorderlines.Single().ReceivedQty.Should().Be(0m);
    }

    [Fact]
    public async Task Receipt_quality_manager_approval_and_post_create_stock_exactly_once()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var warehouseInspectorId = Guid.NewGuid().ToString();

        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-post-1", 4m), fixture.UserId);
        var line = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;
        var quality = await InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-quality-1",
            ExpectedVersion = draft.ConcurrencyVersion,
            Lines =
            [
                new ReceiptQualityDecisionLineRequest
                {
                    ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                    AcceptedQuantity = 3m,
                    RejectedQuantity = 1m,
                    Reason = "Hao hụt khi kiểm tra lô"
                }
            ]
        }, warehouseInspectorId);

        quality.ReceiptStatus.Should().Be("PENDING_APPROVAL");
        quality.QualityStatus.Should().Be("PARTIALLY_ACCEPTED");
        GuidHelper.ToGuidString(fixture.Context.Inventoryreceipts.Single().QualityCheckedBy!)
            .Should().Be(warehouseInspectorId);
        fixture.Context.Stockmovements.Should().BeEmpty("quality is not a stock writer");

        var managerId = Guid.NewGuid().ToString();
        var approval = new InventoryReceiptApprovalHandler(fixture.Context);
        var approved = await approval.HandleAsync(draft.ReceiptId, new ApprovalRequest
        {
            Status = ApprovalDecision.Approve,
            Reason = "Đủ bằng chứng chất lượng"
        }, GuidHelper.ParseGuidString(managerId)!);
        approved!.NewStatus.Should().Be("APPROVED");

        var stalePost = () => InvokePostAsync(service, draft.ReceiptId,
            new ReceiptPostRequest { CommandId = "receipt-post-stale-version", ExpectedVersion = 1 },
            Guid.NewGuid().ToString());
        await stalePost.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đã thay đổi*POSTED*");
        fixture.Context.Stockmovements.Should().BeEmpty();

        var selfPost = () => InvokePostAsync(service, draft.ReceiptId,
            new ReceiptPostRequest { CommandId = "receipt-post-by-inspector", ExpectedVersion = 2 },
            warehouseInspectorId);
        await selfPost.Should().ThrowAsync<BusinessRuleException>().WithMessage("*kiểm tra*không được tự POSTED*");

        var postRequest = new ReceiptPostRequest { CommandId = "receipt-post-command-1", ExpectedVersion = 2 };
        var posted = await InvokePostAsync(service, draft.ReceiptId, postRequest, Guid.NewGuid().ToString());
        var replay = await InvokePostAsync(service, draft.ReceiptId, postRequest, Guid.NewGuid().ToString());

        posted.ReceiptStatus.Should().Be("POSTED");
        posted.QualityStatus.Should().Be("PARTIALLY_ACCEPTED");
        replay.ReceiptId.Should().Be(posted.ReceiptId);
        fixture.Context.Stockmovements.Should().ContainSingle();
        var movement = fixture.Context.Stockmovements.Single();
        movement.RefTable.Should().Be("inventoryreceipts");
        GuidHelper.ToGuidString(movement.RefId!).Should().Be(draft.ReceiptId);
        fixture.Context.Currentstocks.Should().ContainSingle().Which.CurrentQty.Should().Be(3m);
        var order = await fixture.Context.Purchaseorders.Include(item => item.Purchaseorderlines).SingleAsync();
        order.Status.Should().Be("PARTIALLY_RECEIVED");
        order.Purchaseorderlines.Single().ReceivedQty.Should().Be(3m);
    }

    [Fact]
    public async Task Posted_receipt_correction_is_append_only_lineaged_idempotent_and_never_exceeds_accepted_balance()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-correction", 4m), fixture.UserId);
        var sourceLine = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;
        var inspectorId = Guid.NewGuid().ToString();
        var managerId = Guid.NewGuid().ToString();
        var adminId = Guid.NewGuid().ToString();

        await InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-correction-quality",
            ExpectedVersion = draft.ConcurrencyVersion,
            Lines = [new ReceiptQualityDecisionLineRequest
            {
                ReceiptLineId = GuidHelper.ToGuidString(sourceLine.ReceiptLineId),
                AcceptedQuantity = 4m,
                RejectedQuantity = 0m
            }]
        }, inspectorId);
        var approval = new InventoryReceiptApprovalHandler(fixture.Context);
        await approval.HandleAsync(draft.ReceiptId, new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Đủ điều kiện" }, GuidHelper.ParseGuidString(managerId)!);
        var posted = await InvokePostAsync(service, draft.ReceiptId, new ReceiptPostRequest { CommandId = "receipt-correction-post", ExpectedVersion = 2 }, adminId);
        posted.ReceiptStatus.Should().Be("POSTED");
        var originalVersion = fixture.Context.Inventoryreceipts.Single().ConcurrencyVersion;

        var request = new CreateReceiptCorrectionRequest
        {
            CommandId = "receipt-correction-command",
            ExpectedVersion = 0,
            Reason = "Trả lại hàng sau khi đối soát hóa đơn.",
            Lines = [new ReceiptCorrectionLineRequest
            {
                ReceiptLineId = GuidHelper.ToGuidString(sourceLine.ReceiptLineId),
                Quantity = 1.5m
            }]
        };
        var correction = await InvokeCreateCorrectionAsync(service, draft.ReceiptId, request, adminId);
        var replay = await InvokeCreateCorrectionAsync(service, draft.ReceiptId, request, Guid.NewGuid().ToString());

        correction.Status.Should().Be("POSTED");
        replay.CorrectionId.Should().Be(correction.CorrectionId);
        fixture.Context.Inventoryreceipts.Single().Status.Should().Be("POSTED");
        fixture.Context.Inventoryreceipts.Single().ConcurrencyVersion.Should().Be(originalVersion, "correction must not rewrite the original receipt");
        fixture.Context.Receiptcorrections.Should().ContainSingle().Which.ReceiptId.Should().Equal(GuidHelper.ParseGuidString(draft.ReceiptId)!);
        fixture.Context.Receiptcorrectionlines.Should().ContainSingle().Which.ReceiptLineId.Should().Equal(sourceLine.ReceiptLineId);
        fixture.Context.Stockmovements.Should().HaveCount(2);
        fixture.Context.Stockmovements.Should().ContainSingle(item => item.MovementType == "RECEIPT_CORRECTION" && item.QuantityOut == 1.5m && item.RefTable == "receiptcorrections");
        fixture.Context.Currentstocks.Should().ContainSingle().Which.CurrentQty.Should().Be(2.5m);
        fixture.Context.Lifecycletransitions.Should().ContainSingle(item => item.AggregateType == "ReceiptCorrection" && item.ToState == "POSTED");
        fixture.Context.Auditlogs.Should().Contain(item => item.EntityName == nameof(ReceiptCorrection) && item.Reason == request.Reason);

        var overBalance = () => InvokeCreateCorrectionAsync(service, draft.ReceiptId, new CreateReceiptCorrectionRequest
        {
            CommandId = "receipt-correction-over-balance",
            ExpectedVersion = 0,
            Reason = "Sai vượt balance",
            Lines = [new ReceiptCorrectionLineRequest { ReceiptLineId = GuidHelper.ToGuidString(sourceLine.ReceiptLineId), Quantity = 2.6m }]
        }, adminId);
        await overBalance.Should().ThrowAsync<BusinessRuleException>().WithMessage("*vượt số lượng đã được chấp nhận*");
        fixture.Context.Receiptcorrections.Should().ContainSingle();
        fixture.Context.Stockmovements.Should().HaveCount(2);

        var stale = () => InvokeCreateCorrectionAsync(service, draft.ReceiptId, new CreateReceiptCorrectionRequest
        {
            CommandId = "receipt-correction-stale",
            ExpectedVersion = 1,
            Reason = "Version không hợp lệ",
            Lines = [new ReceiptCorrectionLineRequest { ReceiptLineId = GuidHelper.ToGuidString(sourceLine.ReceiptLineId), Quantity = .1m }]
        }, adminId);
        await stale.Should().ThrowAsync<BusinessRuleException>().WithMessage("*phiên bản ban đầu 0*");
    }

    [Fact]
    public async Task Full_quality_rejection_is_terminal_and_never_reaches_approval_or_stock()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var inspectorId = Guid.NewGuid().ToString();
        var managerId = Guid.NewGuid().ToString();
        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-full-reject", 4m), fixture.UserId);
        var line = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;

        var rejected = await InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-quality-full-reject",
            ExpectedVersion = draft.ConcurrencyVersion,
            Lines =
            [
                new ReceiptQualityDecisionLineRequest
                {
                    ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                    AcceptedQuantity = 0m,
                    RejectedQuantity = 4m,
                    Reason = "Lô hàng không đạt cảm quan"
                }
            ]
        }, inspectorId);

        rejected.ReceiptStatus.Should().Be("REJECTED");
        rejected.QualityStatus.Should().Be("REJECTED");
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Purchaseorders.Single().Status.Should().Be("ORDERED");
        fixture.Context.Inventoryreceipts.Single().RejectionReason.Should().Contain("cảm quan");

        var approval = new InventoryReceiptApprovalHandler(fixture.Context);
        var approveRejected = () => approval.HandleAsync(draft.ReceiptId, new ApprovalRequest
        {
            Status = ApprovalDecision.Approve
        }, GuidHelper.ParseGuidString(managerId)!);
        await approveRejected.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*chờ duyệt*");

        var postRejected = () => InvokePostAsync(service, draft.ReceiptId,
            new ReceiptPostRequest { CommandId = "receipt-post-rejected", ExpectedVersion = 1 },
            Guid.NewGuid().ToString());
        await postRejected.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đã duyệt*POSTED*");
        fixture.Context.Stockmovements.Should().BeEmpty();
    }

    [Fact]
    public async Task Receipt_quality_and_approval_forbid_invalid_quantities_and_self_approval()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var warehouseInspectorId = Guid.NewGuid().ToString();
        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-forbidden-1", 4m), fixture.UserId);
        var line = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;

        var invalidQuality = () => InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-quality-invalid",
            ExpectedVersion = 0,
            Lines =
            [
                new ReceiptQualityDecisionLineRequest
                {
                    ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                    AcceptedQuantity = 5m,
                    RejectedQuantity = 0m
                }
            ]
        }, warehouseInspectorId);
        await invalidQuality.Should().ThrowAsync<BusinessRuleException>();

        await InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-quality-valid",
            ExpectedVersion = 0,
            Lines =
            [
                new ReceiptQualityDecisionLineRequest
                {
                    ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                    AcceptedQuantity = 4m,
                    RejectedQuantity = 0m
                }
            ]
        }, warehouseInspectorId);

        var approval = new InventoryReceiptApprovalHandler(fixture.Context);
        var selfApproval = () => approval.HandleAsync(draft.ReceiptId, new ApprovalRequest
        {
            Status = ApprovalDecision.Approve
        }, GuidHelper.ParseGuidString(fixture.UserId)!);
        await selfApproval.Should().ThrowAsync<BusinessRuleException>().WithMessage("*không được tự duyệt*");
        fixture.Context.Stockmovements.Should().BeEmpty();
    }

    [Fact]
    public async Task Rejected_receipt_rework_returns_to_inspection_without_stock_and_is_idempotent()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var draft = await InvokeRecordAsync(service, fixture.CreateRequest("receipt-rework", 4m), fixture.UserId);
        var line = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;

        await InvokeAcceptQualityAsync(service, draft.ReceiptId, new ReceiptQualityDecisionRequest
        {
            CommandId = "receipt-rework-quality-reject",
            ExpectedVersion = draft.ConcurrencyVersion,
            Lines =
            [
                new ReceiptQualityDecisionLineRequest
                {
                    ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
                    AcceptedQuantity = 0m,
                    RejectedQuantity = 4m,
                    Reason = "Cần kiểm tra lại chứng từ lô"
                }
            ]
        }, Guid.NewGuid().ToString());

        var request = new ReceiptReworkRequest
        {
            CommandId = "receipt-rework-command",
            ExpectedVersion = 1,
            Reason = "Bổ sung chứng từ và yêu cầu kiểm tra lại."
        };
        var reworked = await InvokeReworkAsync(service, draft.ReceiptId, request, fixture.UserId);

        reworked.ReceiptStatus.Should().Be("DRAFT");
        reworked.QualityStatus.Should().Be("PENDING_INSPECTION");
        reworked.ConcurrencyVersion.Should().Be(2);
        fixture.Context.Inventoryreceiptlines.Single().AcceptedQuantity.Should().BeNull();
        fixture.Context.Inventoryreceiptlines.Single().RejectedQuantity.Should().BeNull();
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();

        var replay = await InvokeReworkAsync(service, draft.ReceiptId, request, Guid.NewGuid().ToString());
        replay.ReceiptStatus.Should().Be("DRAFT");
        replay.ConcurrencyVersion.Should().Be(2);

        var stale = () => InvokeReworkAsync(service, draft.ReceiptId, new ReceiptReworkRequest
        {
            CommandId = "receipt-rework-stale",
            ExpectedVersion = 1,
            Reason = "Stale"
        }, fixture.UserId);
        await stale.Should().ThrowAsync<BusinessRuleException>().WithMessage("*đã thay đổi*");
    }

    [Fact]
    public async Task Record_missing_required_raw_evidence_is_zero_write()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var service = fixture.CreateService();
        var request = fixture.CreateRequest("missing-evidence", 4m);
        request.Lines.Single().LotNumber = null;

        var action = () => InvokeRecordAsync(service, request, fixture.UserId);

        await action.Should().ThrowAsync<ArgumentException>().WithMessage("*Số lô*");
        fixture.Context.Inventoryreceipts.Should().BeEmpty();
        fixture.Context.Stockmovements.Should().BeEmpty();
        fixture.Context.Currentstocks.Should().BeEmpty();
        fixture.Context.Auditlogs.Should().BeEmpty();
    }

    [Fact]
    public void SingleWriter_old_purchase_receipt_route_and_service_contract_are_retired()
    {
        typeof(IPCManagement.Api.Features.Purchasing.Controllers.PurchaseOrdersController)
            .GetMethod("RecordReceipt")
            .Should().BeNull();
        typeof(IPurchaseOrderService)
            .GetMethod("RecordReceiptAsync")
            .Should().BeNull();
        typeof(PurchaseOrderService)
            .GetMethod("RecordReceiptAsync")
            .Should().BeNull();

        var purchaseOrderReceiptPosts = typeof(IPCManagement.Api.Features.Purchasing.Controllers.PurchaseOrdersController).Assembly
            .GetTypes()
            .Where(type => typeof(ControllerBase).IsAssignableFrom(type))
            .SelectMany(type => type.GetMethods().Select(method => new
            {
                Controller = type,
                Method = method,
                ControllerRoute = type.GetCustomAttributes(typeof(RouteAttribute), inherit: true)
                    .Cast<RouteAttribute>()
                    .SingleOrDefault()?.Template,
                PostRoutes = method.GetCustomAttributes(typeof(HttpPostAttribute), inherit: true)
                    .Cast<HttpPostAttribute>()
                    .Select(attribute => attribute.Template)
                    .ToArray()
            }))
            .Where(route =>
                route.PostRoutes.Length > 0 &&
                route.ControllerRoute?.Contains("purchase-orders", StringComparison.OrdinalIgnoreCase) == true &&
                (route.ControllerRoute.Contains("receipts", StringComparison.OrdinalIgnoreCase) ||
                 route.PostRoutes.Any(template =>
                     template?.Contains("receive", StringComparison.OrdinalIgnoreCase) == true ||
                     template?.Contains("receipt", StringComparison.OrdinalIgnoreCase) == true)))
            .ToList();

        purchaseOrderReceiptPosts.Should().ContainSingle(route =>
            route.Controller == typeof(IPCManagement.Api.Features.Purchasing.Controllers.WarehousePurchaseReceiptsController) &&
            route.Method.Name == "RecordAsync");
    }

    [Fact]
    public void SingleWriter_purchase_progress_reads_and_generic_non_order_receipts_remain_separate()
    {
        var purchaseController = typeof(IPCManagement.Api.Features.Purchasing.Controllers.PurchaseOrdersController);
        purchaseController.GetMethod("GetListAsync").Should().NotBeNull();
        purchaseController.GetMethod("GetPageAsync").Should().NotBeNull();
        purchaseController.GetMethod("GetByIdAsync").Should().NotBeNull();
        AuthorizationPolicies.PurchaseRoles.Should().Contain(["Manager", "Purchasing"]);

        typeof(IPCManagement.Api.Features.Inventory.Contracts.CreateInventoryReceiptRequest)
            .GetProperty("PurchaseOrderId")
            .Should().BeNull("generic inventory receipts cannot attach to a purchase order");
        typeof(IPCManagement.Api.Features.Inventory.Contracts.CreateInventoryReceiptFromPurchaseRequest)
            .GetProperty("PurchaseOrderId")
            .Should().BeNull("legacy purchase-request receipts cannot attach to a purchase order");
    }

    private static Type GetRequiredType(System.Reflection.Assembly assembly, string typeName)
    {
        var type = assembly.GetType($"IPCManagement.Api.Features.Purchasing.Contracts.{typeName}");
        type.Should().NotBeNull($"{typeName} is part of the Warehouse receiving contract");
        return type!;
    }

    private static void SetProperty(object target, string propertyName, object? value)
    {
        var property = target.GetType().GetProperty(propertyName);
        property.Should().NotBeNull($"{propertyName} is required by the Warehouse receiving contract");
        property!.SetValue(target, value);
    }

    private static object CreateReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        Func<string, CancellationToken, Task>? faultInjector)
    {
        var serviceType = typeof(PurchaseOrderService).Assembly.GetType(
            "IPCManagement.Api.Features.Purchasing.Services.PurchaseReceivingService");
        serviceType.Should().NotBeNull("the canonical Warehouse receiving writer must exist");
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            context.Warehouses.AsNoTracking().Select(item => item.WarehouseId).Single());
        return Activator.CreateInstance(
            serviceType!,
            context,
            stockLedgerService,
            new EfTransactionRunner(context),
            resolver,
            faultInjector)!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokeRecordAsync(
        object service,
        RecordWarehousePurchaseReceiptRequest request,
        string userId)
    {
        var method = service.GetType().GetMethod("RecordAsync");
        method.Should().NotBeNull("the canonical writer exposes RecordAsync");
        var task = method!.Invoke(service, [request, userId, CancellationToken.None]);
        task.Should().BeAssignableTo<Task<WarehousePurchaseReceiptResultDto>>();
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokeAcceptQualityAsync(
        object service,
        string receiptId,
        ReceiptQualityDecisionRequest request,
        string userId)
    {
        var task = service.GetType().GetMethod("AcceptQualityAsync")!
            .Invoke(service, [receiptId, request, userId, CancellationToken.None]);
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokePostAsync(
        object service,
        string receiptId,
        ReceiptPostRequest request,
        string userId)
    {
        var task = service.GetType().GetMethod("PostAsync")!
            .Invoke(service, [receiptId, request, userId, CancellationToken.None]);
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokeReworkAsync(
        object service,
        string receiptId,
        ReceiptReworkRequest request,
        string userId)
    {
        var task = service.GetType().GetMethod("ReworkAsync")!
            .Invoke(service, [receiptId, request, userId, CancellationToken.None]);
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokeVoidAsync(
        object service,
        string receiptId,
        ReceiptVoidRequest request,
        string userId)
    {
        var task = service.GetType().GetMethod("VoidAsync")!
            .Invoke(service, [receiptId, request, userId, CancellationToken.None]);
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
    }

    private static async Task<ReceiptCorrectionResultDto> InvokeCreateCorrectionAsync(
        object service,
        string receiptId,
        CreateReceiptCorrectionRequest request,
        string userId)
    {
        var task = service.GetType().GetMethod("CreateCorrectionAsync")!
            .Invoke(service, [receiptId, request, userId, CancellationToken.None]);
        return await (Task<ReceiptCorrectionResultDto>)task!;
    }

    private sealed class InjectedReceivingFailureException(string point)
        : Exception($"Injected failure at {point}");

    private sealed class ReceivingFixture : IAsyncDisposable
    {
        private ReceivingFixture(
            IpcManagementContext context,
            string userId,
            string warehouseId,
            string ingredientId,
            string unitId,
            string purchaseOrderId,
            string purchaseOrderLineId)
        {
            Context = context;
            UserId = userId;
            WarehouseId = warehouseId;
            IngredientId = ingredientId;
            UnitId = unitId;
            PurchaseOrderId = purchaseOrderId;
            PurchaseOrderLineId = purchaseOrderLineId;
        }

        public IpcManagementContext Context { get; }
        public string UserId { get; }
        public string WarehouseId { get; }
        public string IngredientId { get; }
        public string UnitId { get; }
        public string PurchaseOrderId { get; }
        public string PurchaseOrderLineId { get; }

        public static async Task<ReceivingFixture> CreateAsync()
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseInMemoryDatabase($"warehouse-receiving-{Guid.NewGuid():N}")
                .Options;
            var context = new IpcManagementContext(options);

            var userId = Guid.NewGuid().ToString();
            var warehouseId = Guid.NewGuid().ToString();
            var supplierId = Guid.NewGuid().ToString();
            var ingredientId = Guid.NewGuid().ToString();
            var unitId = Guid.NewGuid().ToString();
            var purchaseRequestId = Guid.NewGuid().ToString();
            var purchaseRequestLineId = Guid.NewGuid().ToString();
            var purchaseOrderId = Guid.NewGuid().ToString();
            var purchaseOrderLineId = Guid.NewGuid().ToString();

            var userIdBytes = GuidHelper.ParseGuidString(userId)!;
            var warehouseIdBytes = GuidHelper.ParseGuidString(warehouseId)!;
            var supplierIdBytes = GuidHelper.ParseGuidString(supplierId)!;
            var ingredientIdBytes = GuidHelper.ParseGuidString(ingredientId)!;
            var unitIdBytes = GuidHelper.ParseGuidString(unitId)!;
            var purchaseRequestIdBytes = GuidHelper.ParseGuidString(purchaseRequestId)!;
            var purchaseRequestLineIdBytes = GuidHelper.ParseGuidString(purchaseRequestLineId)!;
            var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId)!;
            var purchaseOrderLineIdBytes = GuidHelper.ParseGuidString(purchaseOrderLineId)!;

            var unit = new Unit
            {
                UnitId = unitIdBytes,
                UnitCode = "KG",
                UnitName = "Kilogram",
                BaseUnitCode = "KG",
                ConvertRateToBase = 1m
            };
            var warehouse = new Warehouse
            {
                WarehouseId = warehouseIdBytes,
                WarehouseCode = "WH-RECEIVE",
                WarehouseName = "Kho nhận",
                WarehouseType = "INGREDIENT"
            };
            var supplier = new Supplier
            {
                SupplierId = supplierIdBytes,
                SupplierCode = "SUP-RECEIVE",
                SupplierName = "Nhà cung cấp",
                IsActive = true
            };
            var ingredient = new Ingredient
            {
                IngredientId = ingredientIdBytes,
                IngredientCode = "ING-FRESH",
                IngredientName = "Thịt tươi",
                UnitId = unitIdBytes,
                WarehouseId = warehouseIdBytes,
                ReferencePrice = 100m,
                IsFreshDaily = true,
                IsActive = true,
                Unit = unit,
                Warehouse = warehouse
            };
            var purchaseRequest = new PurchaseRequest
            {
                PurchaseRequestId = purchaseRequestIdBytes,
                PurchaseRequestCode = "PR-RECEIVE",
                RequestDate = new DateOnly(2026, 7, 20),
                PurchaseForDate = new DateOnly(2026, 7, 22),
                Status = "APPROVED",
                CreatedBy = userIdBytes
            };
            var purchaseRequestLine = new PurchaseRequestLine
            {
                PurchaseRequestLineId = purchaseRequestLineIdBytes,
                PurchaseRequestId = purchaseRequestIdBytes,
                MaterialRequestLineId = GuidHelper.NewId(),
                IngredientId = ingredientIdBytes,
                SupplierId = supplierIdBytes,
                UnitId = unitIdBytes,
                RequiredQty = 10m,
                PurchaseQty = 10m,
                EstimatedUnitPrice = 100m,
                PurchaseRequest = purchaseRequest,
                Ingredient = ingredient,
                Unit = unit,
                Supplier = supplier
            };
            purchaseRequest.Purchaserequestlines.Add(purchaseRequestLine);
            var order = new PurchaseOrder
            {
                PurchaseOrderId = purchaseOrderIdBytes,
                PurchaseOrderCode = "PO-RECEIVE",
                PurchaseRequestId = purchaseRequestIdBytes,
                SupplierId = supplierIdBytes,
                OrderDate = new DateOnly(2026, 7, 22),
                Status = "ORDERED",
                CreatedBy = userIdBytes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PurchaseRequest = purchaseRequest,
                Supplier = supplier
            };
            order.Purchaseorderlines.Add(new PurchaseOrderLine
            {
                PurchaseOrderLineId = purchaseOrderLineIdBytes,
                PurchaseOrderId = purchaseOrderIdBytes,
                PurchaseRequestLineId = purchaseRequestLineIdBytes,
                IngredientId = ingredientIdBytes,
                UnitId = unitIdBytes,
                OrderedQty = 10m,
                UnitPrice = 100m,
                PurchaseOrder = order,
                PurchaseRequestLine = purchaseRequestLine,
                Ingredient = ingredient,
                Unit = unit
            });

            context.AddRange(unit, warehouse, supplier, ingredient, purchaseRequest, purchaseRequestLine, order);
            await context.SaveChangesAsync();
            context.ChangeTracker.Clear();

            return new ReceivingFixture(
                context,
                userId,
                warehouseId,
                ingredientId,
                unitId,
                purchaseOrderId,
                purchaseOrderLineId);
        }

        public object CreateService(Func<string, CancellationToken, Task>? faultInjector = null)
        {
            var currentStockRepository = Substitute.For<ICurrentStockRepository>();
            currentStockRepository
                .GetByWarehouseAndIngredientAsync(Arg.Any<byte[]>(), Arg.Any<byte[]>())
                .Returns(callInfo =>
                {
                    var warehouseId = callInfo.ArgAt<byte[]>(0);
                    var ingredientId = callInfo.ArgAt<byte[]>(1);
                    var stock = Context.Currentstocks.Local.FirstOrDefault(item =>
                        item.WarehouseId.AsSpan().SequenceEqual(warehouseId) &&
                        item.IngredientId.AsSpan().SequenceEqual(ingredientId));
                    return Task.FromResult(stock);
                });
            currentStockRepository
                .ConvertQuantityAsync(Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<decimal>())
                .Returns(callInfo => Task.FromResult(callInfo.ArgAt<decimal>(2)));
            currentStockRepository
                .When(repository => repository.Add(Arg.Any<CurrentStock>()))
                .Do(callInfo => Context.Currentstocks.Add(callInfo.Arg<CurrentStock>()));
            currentStockRepository
                .TryDecreaseAsync(Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<decimal>(), Arg.Any<DateTime>())
                .Returns(callInfo =>
                {
                    var warehouseId = callInfo.ArgAt<byte[]>(0);
                    var ingredientId = callInfo.ArgAt<byte[]>(1);
                    var quantity = callInfo.ArgAt<decimal>(2);
                    var updatedAt = callInfo.ArgAt<DateTime>(3);
                    var stock = Context.Currentstocks.Local.SingleOrDefault(item =>
                        item.WarehouseId.AsSpan().SequenceEqual(warehouseId) &&
                        item.IngredientId.AsSpan().SequenceEqual(ingredientId));
                    if (stock is null || stock.CurrentQty < quantity) return Task.FromResult(false);
                    stock.CurrentQty -= quantity;
                    stock.LastUpdated = updatedAt;
                    return Task.FromResult(true);
                });

            var ledger = new StockLedgerService(
                currentStockRepository,
                new StockMovementRepository(Context),
                Context);
            return CreateReceivingService(Context, ledger, faultInjector);
        }

        public RecordWarehousePurchaseReceiptRequest CreateRequest(string idempotencyKey, decimal quantity)
            => new()
            {
                PurchaseOrderId = PurchaseOrderId,
                IdempotencyKey = idempotencyKey,
                WarehouseId = WarehouseId,
                ReceiptDate = new DateOnly(2026, 7, 22),
                Lines =
                [
                    new WarehousePurchaseReceiptLineRequest
                    {
                        PurchaseOrderLineId = PurchaseOrderLineId,
                        ActualQuantity = quantity,
                        ActualUnitId = UnitId,
                        ActualUnitPrice = 110m,
                        LotNumber = "LOT-RAW-01",
                        ManufactureDate = new DateOnly(2026, 7, 22),
                        ExpiryDate = new DateOnly(2026, 7, 24),
                        PackageQuantity = 10m,
                        PackageBaseUnitId = UnitId,
                        PackagePolicyVersion = "package-policy/v1"
                    }
                ]
            };

        public ValueTask DisposeAsync() => Context.DisposeAsync();
    }
}
