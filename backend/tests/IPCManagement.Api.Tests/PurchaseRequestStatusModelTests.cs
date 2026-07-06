using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class PurchaseRequestStatusModelTests
{
    [Fact]
    public void Model_Should_Allow_PurchaseRequest_ReceiptStatuses()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite("Data Source=:memory:")
            .Options;

        using var context = new IpcManagementContext(options);

        var columnType = context.Model
            .FindEntityType(typeof(Purchaserequest))!
            .FindProperty(nameof(Purchaserequest.Status))!
            .GetColumnType();

        columnType.Should().Contain("PARTIALRECEIVED");
        columnType.Should().Contain("RECEIVED");
        columnType.Should().Contain("SENTTOWAREHOUSE");
    }
}
