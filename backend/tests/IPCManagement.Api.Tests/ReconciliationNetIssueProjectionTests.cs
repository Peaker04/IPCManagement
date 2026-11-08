using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationNetIssueProjectionTests
{
    [Fact]
    public async Task No_linked_issue_returns_no_fact_instead_of_zero()
    {
        await using var context = CreateContext();
        var dailyLineId = GuidHelper.NewId();

        var result = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync([dailyLineId], CancellationToken.None);

        result.Should().BeEmpty("a missing ledger entry means untouched, not zero issued");
    }

    [Fact]
    public async Task Multiple_issues_subtract_only_received_source_linked_returns()
    {
        await using var context = CreateContext();
        var dailyLineId = GuidHelper.NewId();
        var unrelatedDailyLineId = GuidHelper.NewId();
        var first = AddIssue(context, dailyLineId, 10m);
        var second = AddIssue(context, dailyLineId, 3m);
        var unrelated = AddIssue(context, unrelatedDailyLineId, 99m);
        AddReturn(context, first, 2m, received: true);
        AddReturn(context, second, 4m, received: false);
        AddReturn(context, unrelated, 50m, received: true);
        await context.SaveChangesAsync();

        var result = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync([dailyLineId], CancellationToken.None);

        var fact = result[Convert.ToHexString(dailyLineId)];
        fact.GrossIssuedQuantity.Should().Be(13m);
        fact.ReceivedReturnQuantity.Should().Be(2m);
        fact.NetIssuedQuantity.Should().Be(11m);
    }

    [Fact]
    public async Task Issue_and_return_from_another_daily_line_are_excluded()
    {
        await using var context = CreateContext();
        var requestedDailyLineId = GuidHelper.NewId();
        var otherDailyLineId = GuidHelper.NewId();
        AddIssue(context, requestedDailyLineId, 5m);
        var otherIssue = AddIssue(context, otherDailyLineId, 20m);
        AddReturn(context, otherIssue, 7m, received: true);
        await context.SaveChangesAsync();

        var result = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync([requestedDailyLineId], CancellationToken.None);

        result.Should().ContainSingle();
        result[Convert.ToHexString(requestedDailyLineId)].NetIssuedQuantity.Should().Be(5m);
    }

    [Fact]
    public async Task Projection_rounds_only_the_final_net_quantity_to_six_decimals()
    {
        await using var context = CreateContext();
        var dailyLineId = GuidHelper.NewId();
        var issue = AddIssue(context, dailyLineId, 1.0000004m);
        AddReturn(context, issue, 0.0000001m, received: true);
        await context.SaveChangesAsync();

        var result = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync([dailyLineId], CancellationToken.None);

        result[Convert.ToHexString(dailyLineId)].NetIssuedQuantity.Should().Be(1m);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"mrx-net-issue-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static InventoryIssueLine AddIssue(
        IpcManagementContext context,
        byte[] dailyLineId,
        decimal issuedQuantity)
    {
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = $"ISS-{Guid.NewGuid():N}",
            IssueDate = new DateOnly(2026, 7, 20),
            WarehouseId = GuidHelper.NewId(),
            ReconciliationBatchId = GuidHelper.NewId(),
            IssuedBy = GuidHelper.NewId(),
            CreatedAt = DateTime.UtcNow
        };
        var line = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = issue.IssueId,
            IngredientId = GuidHelper.NewId(),
            UnitId = GuidHelper.NewId(),
            RequestedQty = issuedQuantity,
            IssuedQty = issuedQuantity,
            ReconciliationBatchDailyLineId = dailyLineId,
            Issue = issue
        };
        issue.Inventoryissuelines.Add(line);
        context.Inventoryissues.Add(issue);
        return line;
    }

    private static void AddReturn(
        IpcManagementContext context,
        InventoryIssueLine source,
        decimal quantity,
        bool received)
    {
        var inventoryReturn = new InventoryReturn
        {
            ReturnId = GuidHelper.NewId(),
            ReturnCode = $"RET-{Guid.NewGuid():N}",
            ReturnDate = new DateOnly(2026, 7, 20),
            ReturnType = "RETURN",
            WarehouseId = source.Issue.WarehouseId,
            IssueId = source.IssueId,
            CreatedBy = GuidHelper.NewId(),
            CreatedAt = DateTime.UtcNow,
            ReceivedBy = received ? GuidHelper.NewId() : null,
            ReceivedAt = received ? DateTime.UtcNow : null,
            Issue = source.Issue
        };
        var returnLine = new InventoryReturnLine
        {
            ReturnLineId = GuidHelper.NewId(),
            ReturnId = inventoryReturn.ReturnId,
            IngredientId = source.IngredientId,
            UnitId = source.UnitId,
            SourceIssueLineId = source.IssueLineId,
            Quantity = quantity,
            Return = inventoryReturn,
            SourceIssueLine = source
        };
        inventoryReturn.Inventoryreturnlines.Add(returnLine);
        context.Inventoryreturns.Add(inventoryReturn);
        context.Inventoryreturnlines.Add(returnLine);
    }
}
