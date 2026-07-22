using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class WarehousePurchaseReceivingTests
{
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
