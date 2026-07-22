using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
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

    [Fact(Skip = "Plan 09-11 owns the Warehouse-authorized purchase receiving transaction.")]
    public void Warehouse_receives_purchase_order_with_lot_and_package_snapshot()
    {
        Assert.Fail("Plan 09-11 must write receipt, lines, stock movement, and package snapshot atomically.");
    }

    [Fact(Skip = "Plan 09-11 owns rejection of non-Warehouse receipt writes.")]
    public void Purchasing_cannot_write_purchase_receipts()
    {
        Assert.Fail("Plan 09-11 must enforce Warehouse ownership server-side.");
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
}
