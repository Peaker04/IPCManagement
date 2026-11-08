using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class MrxIssueProvisionQueryTests
{
    [Fact]
    public async Task Provision_query_returns_only_adjustments_linked_to_exact_issue()
    {
        await using var context = CreateContext();
        var issueId = GuidHelper.NewId();
        var otherIssueId = GuidHelper.NewId();
        var expected = AddMovement(context, issueId, "ADJUSTMENT", MrxIssueProvisionQuery.ProvisionReason, "Tự động bổ sung phần thiếu cho lô batch-1 trước khi tạo phiếu xuất.");
        AddMovement(context, otherIssueId, "ADJUSTMENT", MrxIssueProvisionQuery.ProvisionReason, "Tự động bổ sung phần thiếu cho lô batch-2 trước khi tạo phiếu xuất.");
        await context.SaveChangesAsync();

        var facts = await new MrxIssueProvisionQuery(context).GetByIssueIdAsync(issueId);

        facts.Should().ContainSingle();
        facts.Single().MovementId.Should().Equal(expected.MovementId);
        facts.Single().Quantity.Should().Be(expected.QuantityIn);
    }

    [Fact]
    public async Task Provision_query_excludes_issue_movements_and_unrelated_adjustments()
    {
        await using var context = CreateContext();
        var issueId = GuidHelper.NewId();
        AddMovement(context, issueId, "ISSUE", "Xuất kho đối chiếu", "Phiếu xuất");
        AddMovement(context, issueId, "ADJUSTMENT", "Điều chỉnh kiểm kê", "Không phải bù tồn MRX");
        AddMovement(context, issueId, "ADJUSTMENT", MrxIssueProvisionQuery.ProvisionReason, "Ghi chú không thuộc bù tồn MRX");
        await context.SaveChangesAsync();

        (await new MrxIssueProvisionQuery(context).GetByIssueIdAsync(issueId)).Should().BeEmpty();
    }

    private static IpcManagementContext CreateContext() => new(
        new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"mrx-provision-{Guid.NewGuid():N}")
            .Options);

    private static StockMovement AddMovement(
        IpcManagementContext context,
        byte[] issueId,
        string movementType,
        string reason,
        string note)
    {
        var movement = new StockMovement
        {
            MovementId = GuidHelper.NewId(), MovementDate = DateTime.UtcNow,
            WarehouseId = GuidHelper.NewId(), IngredientId = GuidHelper.NewId(), UnitId = GuidHelper.NewId(),
            MovementType = movementType, RefTable = "inventoryissues", RefId = issueId,
            QuantityIn = 2.5m, QuantityOut = 0m, BeforeQty = 0m, AfterQty = 2.5m,
            PerformedBy = GuidHelper.NewId(), Reason = reason, Note = note
        };
        context.Stockmovements.Add(movement);
        return movement;
    }
}
