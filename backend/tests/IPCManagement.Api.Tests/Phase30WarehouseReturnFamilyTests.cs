using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public partial class Phase30WarehouseReturnFamilyTests
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

    internal static Fixture CreateFixture(string lineage, string? mode = null)
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

        var requestContext = new SystemOperationRequestContext
        {
            Mode = mode,
            OperationKey = "inventoryreturns.create",
            ExpectedModeVersion = 3,
            Disposition = OperationDisposition.Retained,
        };
        var service = new InventoryReturnService(
            returnRepository,
            issueRepository,
            unitOfWork,
            stockLedger,
            new ImmediateTransactionRunner(),
            warehouseResolver,
            requestContext: requestContext);
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

        return new Fixture(service, returnRepository, unitOfWork, stockLedger, issue, request, Guid.NewGuid().ToString(), requestContext);
    }

    internal sealed record Fixture(
        InventoryReturnService Service,
        IInventoryReturnRepository ReturnRepository,
        IUnitOfWork UnitOfWork,
        IStockLedgerService StockLedger,
        InventoryIssue Issue,
        CreateInventoryReturnRequest Request,
        string UserId,
        SystemOperationRequestContext RequestContext);
}

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task Phase30WarehouseReturnFamily_ReconciliationCorrectionChangesStockAndNetOnlyOnceOnRetry()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var reconciliationBatchId = GuidHelper.NewId();
        var reconciliationBatchLineId = GuidHelper.NewId();
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = "ISS-RECON-RETURN",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            ReconciliationBatchId = reconciliationBatchId,
            IssuedBy = fixture.UserId,
            ReceivedBy = fixture.UserId,
            ReceivedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = issueLineId,
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    ReconciliationBatchLineId = reconciliationBatchLineId,
                    RequestedQty = 5m,
                    IssuedQty = 5m,
                }
            ]
        });
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 10m,
            LastUpdated = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();
        var service = CreateInventoryReturnService(context);
        var command = new CreateInventoryReturnRequest
        {
            CommandId = "phase30-recon-return-create",
            ReturnDate = new DateOnly(2026, 6, 15),
            ReturnType = "RETURN",
            IssueId = GuidHelper.ToGuidString(issueId),
            Reason = "Reconciliation family correction",
            Lines =
            [
                new CreateInventoryReturnLineRequest
                {
                    SourceIssueLineId = GuidHelper.ToGuidString(issueLineId),
                    IngredientId = fixture.IngredientIdString,
                    UnitId = GuidHelper.ToGuidString(fixture.UnitId),
                    Quantity = 2m,
                }
            ]
        };

        var created = await service.CreateAsync(command, fixture.UserIdString);
        var createReplay = await service.CreateAsync(command, fixture.UserIdString);
        var confirmation = new ConfirmInventoryReturnReceiptRequest { CommandId = "phase30-recon-return-confirm" };
        await service.ConfirmReceiptAsync(created!.ReturnId, confirmation, fixture.UserIdString);
        await service.ConfirmReceiptAsync(created.ReturnId, confirmation, fixture.UserIdString);

        createReplay!.ReturnId.Should().Be(created.ReturnId);
        (await context.Inventoryreturns.CountAsync()).Should().Be(1);
        var persistedReturnLine = await context.Inventoryreturnlines.SingleAsync();
        persistedReturnLine.SourceIssueLineId.Should().Equal(issueLineId);
        (await context.Currentstocks.Select(item => item.CurrentQty).SingleAsync()).Should().Be(12m);
        (await context.Stockmovements.CountAsync(item => item.MovementType == "RETURN")).Should().Be(1);
        (await context.Lifecycletransitions.CountAsync(item => item.AggregateType == "InventoryReturn")).Should().Be(2);

        var defaultReturned = await (
            from returnLine in context.Inventoryreturnlines
            join inventoryReturn in context.Inventoryreturns on returnLine.ReturnId equals inventoryReturn.ReturnId
            join sourceIssue in context.Inventoryissues on inventoryReturn.IssueId equals sourceIssue.IssueId
            where sourceIssue.MaterialRequestId != null
            select (decimal?)returnLine.Quantity).SumAsync() ?? 0m;
        var reconciliationIssued = await context.Inventoryissuelines
            .Where(line => line.ReconciliationBatchLineId == reconciliationBatchLineId)
            .SumAsync(line => line.IssuedQty);
        var reconciliationReturned = await context.Inventoryreturnlines
            .Where(line => line.SourceIssueLineId == issueLineId)
            .SumAsync(line => line.Quantity);
        defaultReturned.Should().Be(0m);
        (reconciliationIssued - reconciliationReturned).Should().Be(3m);
    }
}
