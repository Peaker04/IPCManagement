using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class SupplementalMaterialRequestServiceTests
{
    [Fact]
    public async Task CreateAsync_ShouldPersistPendingRequestFromReceivedIssueLine()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();

        var result = await new SupplementalMaterialRequestService(context).CreateAsync(
            new CreateSupplementalMaterialRequestDto
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2.5m,
                Reason = "Phát sinh thêm suất",
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.Status.Should().Be("PENDING");
        result.RequestedQty.Should().Be(2.5m);
        result.IngredientName.Should().Be("Gạo");
        var saved = await context.Supplementalmaterialrequests.SingleAsync();
        saved.IssueLineId.Should().Equal(seed.IssueLineId);
        saved.Reason.Should().Be("Phát sinh thêm suất");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectIssueThatKitchenHasNotReceived()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: null);
        await context.SaveChangesAsync();

        var action = () => new SupplementalMaterialRequestService(context).CreateAsync(
            new CreateSupplementalMaterialRequestDto
            {
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 1,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        await action.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*xác nhận đã nhận*");
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new IpcManagementContext(options);
    }

    private static (byte[] IssueId, byte[] IssueLineId, byte[] WarehouseId, byte[] UserId) SeedReceivedIssueLine(
        IpcManagementContext context,
        DateTime? receivedAt)
    {
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var userId = GuidHelper.NewId();
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "GAO", IngredientName = "Gạo", UnitId = unitId, WarehouseId = warehouseId, IsActive = true };
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", ConvertRateToBase = 1 };
        var issue = new Inventoryissue
        {
            IssueId = issueId,
            IssueCode = "ISS-TEST",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = userId,
            ReceivedBy = receivedAt is null ? null : userId,
            ReceivedAt = receivedAt,
            CreatedAt = DateTime.UtcNow,
        };
        var line = new Inventoryissueline
        {
            IssueLineId = issueLineId,
            IssueId = issueId,
            IngredientId = ingredientId,
            UnitId = unitId,
            RequestedQty = 10,
            IssuedQty = 10,
            Issue = issue,
            Ingredient = ingredient,
            Unit = unit,
        };
        issue.Inventoryissuelines.Add(line);
        context.AddRange(unit, ingredient, issue, line);
        return (issueId, issueLineId, warehouseId, userId);
    }
}
