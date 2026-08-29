using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public class Phase30WarehouseReturnFamilyTests
{
    [Theory]
    [InlineData("DEFAULT")]
    [InlineData("MATERIAL_RECONCILIATION")]
    public async Task CreateAsync_AcceptsOnlyTheExactIssueLineFamily(string family)
    {
        var fixture = CreateFixture(family);

        var result = await fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        result.Should().NotBeNull();
        fixture.ReturnRepository.Received(1).Add(Arg.Is<InventoryReturn>(created =>
            created.Inventoryreturnlines.Single().SourceIssueLineId!
                .SequenceEqual(fixture.Issue.Inventoryissuelines.Single().IssueLineId)));
        await fixture.UnitOfWork.Received(1).SaveChangesAsync();
    }

    [Theory]
    [InlineData("LEGACY_UNCLASSIFIED")]
    [InlineData("BOTH_FAMILIES")]
    [InlineData("HEADER_LINE_MISMATCH")]
    public async Task CreateAsync_RejectsMalformedLineageBeforeAnyDurableEffect(string lineage)
    {
        var fixture = CreateFixture(lineage);

        var act = () => fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*lineage*");
        fixture.ReturnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
        await fixture.UnitOfWork.DidNotReceive().SaveChangesAsync();
        await fixture.StockLedger.DidNotReceiveWithAnyArgs().AddStockAsync(
            default!, default!, default!, default, default!, default!, default!, default!, default!, default!);
    }

    [Fact]
    public async Task CreateAsync_RejectsForeignExactSourceLineBeforeAnyDurableEffect()
    {
        var fixture = CreateFixture("DEFAULT");
        fixture.Request.Lines.Single().SourceIssueLineId = Guid.NewGuid().ToString();

        var act = () => fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*không thuộc phiếu xuất gốc*");
        fixture.ReturnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
        await fixture.UnitOfWork.DidNotReceive().SaveChangesAsync();
    }

    private static Fixture CreateFixture(string lineage)
    {
        var returnRepository = Substitute.For<IInventoryReturnRepository>();
        var issueRepository = Substitute.For<IInventoryIssueRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var stockLedger = Substitute.For<IStockLedgerService>();
        var warehouseResolver = Substitute.For<IOperationalWarehouseResolver>();
        var warehouseId = Guid.NewGuid().ToString();
        var issueId = Guid.NewGuid().ToString();
        var ingredientId = Guid.NewGuid().ToString();
        var unitId = Guid.NewGuid().ToString();
        var issueBytes = GuidHelper.ParseGuidString(issueId)!;
        var materialRequestId = GuidHelper.NewId();
        var reconciliationBatchId = GuidHelper.NewId();
        var line = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = issueBytes,
            IngredientId = GuidHelper.ParseGuidString(ingredientId)!,
            UnitId = GuidHelper.ParseGuidString(unitId)!,
            RequestedQty = 5m,
            IssuedQty = 5m
        };
        var issue = new InventoryIssue
        {
            IssueId = issueBytes,
            IssueCode = "ISS-PHASE30",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = GuidHelper.ParseGuidString(warehouseId)!,
            IssuedBy = GuidHelper.NewId(),
            ReceivedBy = GuidHelper.NewId(),
            ReceivedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = [line]
        };

        switch (lineage)
        {
            case "DEFAULT":
                issue.MaterialRequestId = materialRequestId;
                line.MaterialRequestLineId = GuidHelper.NewId();
                break;
            case "MATERIAL_RECONCILIATION":
                issue.ReconciliationBatchId = reconciliationBatchId;
                line.ReconciliationBatchLineId = GuidHelper.NewId();
                break;
            case "BOTH_FAMILIES":
                issue.MaterialRequestId = materialRequestId;
                issue.ReconciliationBatchId = reconciliationBatchId;
                line.MaterialRequestLineId = GuidHelper.NewId();
                line.ReconciliationBatchLineId = GuidHelper.NewId();
                break;
            case "HEADER_LINE_MISMATCH":
                issue.MaterialRequestId = materialRequestId;
                line.ReconciliationBatchLineId = GuidHelper.NewId();
                break;
        }

        warehouseResolver.ResolveAsync(Arg.Any<CancellationToken>())
            .Returns(issue.WarehouseId);
        issueRepository.GetByIdWithLinesAsync(Arg.Any<byte[]>()).Returns(issue);
        returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(Arg.Any<byte[]>())
            .Returns(new Dictionary<string, decimal>());

        var service = new InventoryReturnService(
            returnRepository,
            issueRepository,
            unitOfWork,
            stockLedger,
            new ImmediateTransactionRunner(),
            warehouseResolver);
        var request = new CreateInventoryReturnRequest
        {
            ReturnDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = warehouseId,
            IssueId = issueId,
            Reason = "Phase 30 exact-family return",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(line.IssueLineId),
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    Quantity = 1m
                }
            ]
        };

        return new Fixture(service, returnRepository, unitOfWork, stockLedger, issue, request, Guid.NewGuid().ToString());
    }

    private sealed record Fixture(
        InventoryReturnService Service,
        IInventoryReturnRepository ReturnRepository,
        IUnitOfWork UnitOfWork,
        IStockLedgerService StockLedger,
        InventoryIssue Issue,
        CreateInventoryReturnRequest Request,
        string UserId);
}
