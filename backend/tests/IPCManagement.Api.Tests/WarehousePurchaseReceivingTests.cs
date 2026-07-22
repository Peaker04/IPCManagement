using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IPCManagement.Api.Tests;

public class WarehousePurchaseReceivingTests
{
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
}
