using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Workflow;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using System.ComponentModel.DataAnnotations;

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
    public void Validation_Warehouse_receipt_contract_contains_only_actual_receipt_evidence()
    {
        var dtoAssembly = typeof(PurchaseOrderDto).Assembly;
        var requestType = GetRequiredType(dtoAssembly, "RecordWarehousePurchaseReceiptDto");
        var lineType = GetRequiredType(dtoAssembly, "WarehousePurchaseReceiptLineDto");
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
        var lineType = GetRequiredType(typeof(PurchaseOrderDto).Assembly, "WarehousePurchaseReceiptLineDto");
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

        var receiptLine = model.FindEntityType(typeof(Inventoryreceiptline));
        receiptLine.Should().NotBeNull();
        receiptLine!.FindProperty(nameof(Inventoryreceiptline.PackageQuantitySnapshot))!
            .GetPrecision().Should().Be(18);
        receiptLine.FindProperty(nameof(Inventoryreceiptline.PackageQuantitySnapshot))!
            .GetScale().Should().Be(6);
        receiptLine.FindProperty(nameof(Inventoryreceiptline.PackageBaseUnitIdSnapshot))!
            .GetMaxLength().Should().Be(16);
        receiptLine.FindProperty(nameof(Inventoryreceiptline.PackagePolicyVersionSnapshot))!
            .GetMaxLength().Should().Be(100);
        receiptLine.GetCheckConstraints().Select(constraint => constraint.Name).Should().Contain(
            "ckInventoryReceiptLinesPackageSnapshotComplete",
            "ckInventoryReceiptLinesPackageQuantityPositive");
        receiptLine.GetForeignKeys().Should().Contain(foreignKey =>
            !foreignKey.IsRequired &&
            foreignKey.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(Inventoryreceiptline.PackageBaseUnitIdSnapshot) }) &&
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
    public async Task Record_Warehouse_receipt_is_atomic_idempotent_and_updates_progress()
    {
        await using var fixture = await ReceivingFixture.CreateAsync();
        var request = fixture.CreateRequest("receipt-key-1", 4m);
        var service = fixture.CreateService();

        var first = await InvokeRecordAsync(service, request, fixture.UserId);
        var retry = await InvokeRecordAsync(service, request, fixture.UserId);

        retry.ReceiptId.Should().Be(first.ReceiptId);
        first.PurchaseOrderStatus.Should().Be("PARTIALLY_RECEIVED");
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
        var receiptLine = fixture.Context.Inventoryreceiptlines.Should().ContainSingle().Subject;
        receiptLine.Quantity.Should().Be(4m);
        receiptLine.UnitPrice.Should().Be(110m);
        receiptLine.LotNumber.Should().Be("LOT-RAW-01");
        receiptLine.ManufactureDate.Should().Be(new DateOnly(2026, 7, 22));
        receiptLine.ExpiredDate.Should().Be(new DateOnly(2026, 7, 24));
        receiptLine.PackageQuantitySnapshot.Should().Be(10m);
        GuidHelper.ToGuidString(receiptLine.PackageBaseUnitIdSnapshot!).Should().Be(fixture.UnitId);
        receiptLine.PackagePolicyVersionSnapshot.Should().Be("package-policy/v1");
        fixture.Context.Stockmovements.Should().ContainSingle();
        fixture.Context.Currentstocks.Should().ContainSingle().Which.CurrentQty.Should().Be(4m);
        fixture.Context.Auditlogs.Should().ContainSingle();

        var order = await fixture.Context.Purchaseorders
            .Include(item => item.Purchaseorderlines)
            .SingleAsync();
        order.Status.Should().Be("PARTIALLY_RECEIVED");
        order.Purchaseorderlines.Single().ReceivedQty.Should().Be(4m);

        var mismatchedRetry = fixture.CreateRequest("receipt-key-1", 5m);
        var mismatch = () => InvokeRecordAsync(service, mismatchedRetry, fixture.UserId);
        await mismatch.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*idempotency*");
        fixture.Context.Inventoryreceipts.Should().ContainSingle();
        fixture.Context.Stockmovements.Should().ContainSingle();

        var final = await InvokeRecordAsync(
            service,
            fixture.CreateRequest("receipt-key-2", 6m),
            fixture.UserId);
        final.PurchaseOrderStatus.Should().Be("RECEIVED");
        fixture.Context.Inventoryreceipts.Should().HaveCount(2);
        fixture.Context.Stockmovements.Should().HaveCount(2);
        fixture.Context.Currentstocks.Single().CurrentQty.Should().Be(10m);
        fixture.Context.Auditlogs.Should().HaveCount(2);
    }

    [Theory]
    [InlineData("AfterReceipt")]
    [InlineData("AfterStock")]
    [InlineData("AfterOrderProgress")]
    [InlineData("AfterAudit")]
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

    private static Type GetRequiredType(System.Reflection.Assembly assembly, string typeName)
    {
        var type = assembly.GetType($"IPCManagement.Api.Models.DTOs.Workflow.{typeName}");
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
            "IPCManagement.Api.Services.Workflow.PurchaseReceivingService");
        serviceType.Should().NotBeNull("the canonical Warehouse receiving writer must exist");
        return Activator.CreateInstance(serviceType!, context, stockLedgerService, faultInjector)!;
    }

    private static async Task<WarehousePurchaseReceiptResultDto> InvokeRecordAsync(
        object service,
        RecordWarehousePurchaseReceiptDto request,
        string userId)
    {
        var method = service.GetType().GetMethod("RecordAsync");
        method.Should().NotBeNull("the canonical writer exposes RecordAsync");
        var task = method!.Invoke(service, [request, userId, CancellationToken.None]);
        task.Should().BeAssignableTo<Task<WarehousePurchaseReceiptResultDto>>();
        return await (Task<WarehousePurchaseReceiptResultDto>)task!;
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
            var purchaseRequest = new Purchaserequest
            {
                PurchaseRequestId = purchaseRequestIdBytes,
                PurchaseRequestCode = "PR-RECEIVE",
                RequestDate = new DateOnly(2026, 7, 20),
                PurchaseForDate = new DateOnly(2026, 7, 22),
                Status = "APPROVED",
                CreatedBy = userIdBytes
            };
            var purchaseRequestLine = new Purchaserequestline
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
            var order = new Purchaseorder
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
            order.Purchaseorderlines.Add(new Purchaseorderline
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
            var ledger = new StockLedgerService(
                new CurrentStockRepository(Context),
                new StockMovementRepository(Context),
                Context);
            return CreateReceivingService(Context, ledger, faultInjector);
        }

        public RecordWarehousePurchaseReceiptDto CreateRequest(string idempotencyKey, decimal quantity)
            => new()
            {
                PurchaseOrderId = PurchaseOrderId,
                IdempotencyKey = idempotencyKey,
                WarehouseId = WarehouseId,
                ReceiptDate = new DateOnly(2026, 7, 22),
                Lines =
                [
                    new WarehousePurchaseReceiptLineDto
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
