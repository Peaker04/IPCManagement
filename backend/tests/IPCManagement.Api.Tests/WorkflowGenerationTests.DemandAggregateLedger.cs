using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Theory]
    [InlineData(false, false, false, 0, 0, 200)]
    [InlineData(true, false, false, 40, 0, 160)]
    [InlineData(true, true, false, 40, 40, 160)]
    [InlineData(true, true, true, 40, 40, 160)]
    [InlineData(true, false, false, 200, 0, 0)]
    [InlineData(true, true, true, 200, 200, 0)]
    public async Task DemandAggregateLedger_Should_SeparateAllocationFromPhysicalHandoff(
        bool issued, bool received, bool returned, decimal expectedIssued, decimal expectedReceived, decimal expectedRemaining)
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var line = await context.Materialrequestlines.SingleAsync();
            line.CurrentStockQty = 200m;
            line.SuggestedPurchaseQty = 0m;
            // A read projection must not infer physical events from the request status.
            if (issued)
            {
                var issue = new InventoryIssue
                {
                    IssueId = fixture.IssueId, IssueCode = "ISS-AGGREGATE-LEDGER",
                    IssueDate = new DateOnly(2026, 6, 15), WarehouseId = fixture.WarehouseId,
                    MaterialRequestId = line.RequestId, IssuedBy = fixture.UserId,
                    ReceivedAt = received ? DateTime.UtcNow : null, CreatedAt = DateTime.UtcNow,
                };
                issue.Inventoryissuelines.Add(new InventoryIssueLine
                {
                    IssueLineId = GuidHelper.NewId(), IngredientId = line.IngredientId,
                    UnitId = line.UnitId, MaterialRequestLineId = line.RequestLineId,
                    RequestedQty = expectedIssued, IssuedQty = expectedIssued,
                });
                context.Inventoryissues.Add(issue);
                if (returned)
                {
                    var inventoryReturn = new InventoryReturn
                    {
                        ReturnId = GuidHelper.NewId(), ReturnCode = "RET-AGGREGATE-LEDGER", ReturnType = "RETURN",
                        ReturnDate = issue.IssueDate, IssueId = issue.IssueId, Issue = issue,
                        WarehouseId = fixture.WarehouseId, CreatedBy = fixture.UserId,
                        CreatedAt = DateTime.UtcNow, ReceivedAt = DateTime.UtcNow, ReceivedBy = fixture.UserId,
                    };
                    inventoryReturn.Inventoryreturnlines.Add(new InventoryReturnLine
                    {
                        ReturnLineId = GuidHelper.NewId(), IngredientId = line.IngredientId, UnitId = line.UnitId,
                        SourceIssueLineId = issue.Inventoryissuelines.Single().IssueLineId, Quantity = 10m,
                    });
                    context.Inventoryreturns.Add(inventoryReturn);
                }
            }
            // Even corrupt/colliding MRX lineage must not contribute to DEFAULT handoff.
            var collision = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(), IssueCode = "ISS-MRX-COLLISION",
                IssueDate = new DateOnly(2026, 6, 15), WarehouseId = fixture.WarehouseId,
                MaterialRequestId = line.RequestId, ReconciliationBatchId = GuidHelper.NewId(),
                IssuedBy = fixture.UserId, ReceivedAt = DateTime.UtcNow, CreatedAt = DateTime.UtcNow,
            };
            collision.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(), IngredientId = line.IngredientId,
                UnitId = line.UnitId, MaterialRequestLineId = line.RequestLineId,
                ReconciliationBatchLineId = GuidHelper.NewId(), RequestedQty = 999m, IssuedQty = 999m,
            });
            context.Inventoryissues.Add(collision);
            await context.SaveChangesAsync();
        }
        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto { DateFrom = "2026-06-15", DateTo = "2026-06-15", PageNumber = 1, PageSize = 20 });
        var pagePayload = JsonSerializer.SerializeToElement(page, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        pagePayload.GetProperty("remainingToIssueCount").GetInt32().Should().Be(expectedRemaining > 0 ? 1 : 0);
        pagePayload.GetProperty("pendingKitchenReceiptCount").GetInt32().Should().Be(issued && !received ? 1 : 0);
        page.ShortageCount.Should().Be(0, "legacy generation shortage remains compatible");
        var item = page.Items.Should().ContainSingle().Subject;
        item.CurrentStockQty.Should().Be(200m, "the generation allocation remains historical evidence");
        // Assert the additive public wire contract without changing legacy field meanings.
        var payload = JsonSerializer.SerializeToElement(item, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        payload.GetProperty("issuedQty").GetDecimal().Should().Be(expectedIssued);
        payload.GetProperty("receivedByKitchenQty").GetDecimal().Should().Be(expectedReceived);
        payload.GetProperty("remainingToIssueQty").GetDecimal().Should().Be(expectedRemaining);
    }
    [Fact]
    public async Task DemandAggregateLedger_Should_CountWholeFilterBeforePagination()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" }, fixture.UserIdString);
        var line = await context.Materialrequestlines.SingleAsync();
        line.CurrentStockQty = 200m;
        line.SuggestedPurchaseQty = 0m;
        var other = context.Entry(line).CurrentValues.Clone();
        var second = (MaterialRequestLine)other.ToObject();
        second.RequestLineId = GuidHelper.NewId();
        second.PriceTierAmount = line.PriceTierAmount + 1000m;
        context.Materialrequestlines.Add(second);
        await context.SaveChangesAsync();
        var service = new DemandReportService(context);
        foreach (var pageNumber in new[] { 1, 2, 3 })
        {
            var page = await service.GetIngredientDemandAggregatePageAsync(new IngredientDemandAggregatePageQueryDto
            {
                DateFrom = "2026-06-15", DateTo = "2026-06-15", PageNumber = pageNumber, PageSize = 1,
            });
            var payload = JsonSerializer.SerializeToElement(page, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            page.TotalCount.Should().Be(2);
            page.ShortageCount.Should().Be(0);
            payload.GetProperty("remainingToIssueCount").GetInt32().Should().Be(2);
            payload.GetProperty("pendingKitchenReceiptCount").GetInt32().Should().Be(0);
            page.Items.Count.Should().Be(pageNumber <= 2 ? 1 : 0);
        }
        foreach (var filter in new[]
        {
            new IngredientDemandAggregatePageQueryDto { DateFrom = "2026-06-16" },
            new IngredientDemandAggregatePageQueryDto { SearchKeyword = "absent" },
            new IngredientDemandAggregatePageQueryDto { CustomerId = Guid.NewGuid().ToString() },
        })
        {
            filter.PageNumber = 1;
            filter.PageSize = 1;
            var empty = await service.GetIngredientDemandAggregatePageAsync(filter);
            var emptyPayload = JsonSerializer.SerializeToElement(empty, new JsonSerializerOptions(JsonSerializerDefaults.Web));
            empty.TotalCount.Should().Be(0);
            emptyPayload.GetProperty("remainingToIssueCount").GetInt32().Should().Be(0);
            emptyPayload.GetProperty("pendingKitchenReceiptCount").GetInt32().Should().Be(0);
        }
    }
}
