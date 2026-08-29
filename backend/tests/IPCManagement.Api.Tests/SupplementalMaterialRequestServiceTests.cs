using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Tests;

public sealed class SupplementalMaterialRequestServiceTests
{
    [Fact]
    public async Task CreateAsync_ShouldPersistPendingRequestFromReceivedIssueLine()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();

        var result = await CreateService(context).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-pending",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2.5m,
                Reason = "Phát sinh thêm suất",
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.Status.Should().Be("PENDING_WAREHOUSE_REVIEW");
        result.ConcurrencyVersion.Should().Be(1);
        result.RequestedQty.Should().Be(2.5m);
        result.IngredientName.Should().Be("Gạo");
        var saved = await context.Supplementalmaterialrequests.SingleAsync();
        saved.IssueLineId.Should().Equal(seed.IssueLineId);
        saved.Reason.Should().Be("Phát sinh thêm suất");
        (await context.Lifecyclecommandreceipts.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(1);
        (await context.Lifecycletransitions.SingleAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest)))
            .AggregateSequence.Should().Be(0);
        (await context.Lifecycleoutboxmessages.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_ShouldReturnTheSingleOpenExceptionForTheSameIssueLine()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var request = new CreateSupplementalMaterialRequest
        {
            CommandId = "supplemental-create-single",
            IssueId = GuidHelper.ToGuidString(seed.IssueId),
            IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
            RequestedQty = 2.5m,
            Reason = "Thiếu suất đột xuất",
        };

        var first = await service.CreateAsync(
            request,
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));
        var replayOrOverlap = await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-overlap",
                IssueId = request.IssueId,
                IssueLineId = request.IssueLineId,
                RequestedQty = 4m,
                Reason = "Một yêu cầu chồng lấn không được phép tạo exception mới",
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        replayOrOverlap.RequestId.Should().Be(first.RequestId);
        replayOrOverlap.RequestedQty.Should().Be(2.5m);
        (await context.Supplementalmaterialrequests.CountAsync()).Should().Be(1);
        (await context.Auditlogs.CountAsync(item => item.EntityName == nameof(SupplementalMaterialRequest) && item.FieldName == "Create"))
            .Should().Be(1);
    }

    [Fact]
    public async Task CreateAsync_ShouldReturnExistingOpenRequest_WhenDatabaseUniqueFenceRejectsConcurrentInsert()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        var existing = new SupplementalMaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "SUP-EXISTING",
            IssueId = seed.IssueId,
            IssueLineId = seed.IssueLineId,
            WarehouseId = seed.WarehouseId,
            IngredientId = seed.IngredientId,
            UnitId = seed.UnitId,
            RequestedQty = 2m,
            Status = "PENDING_WAREHOUSE_REVIEW",
            RequestedBy = seed.UserId,
            RequestedAt = DateTime.UtcNow,
        };
        context.Supplementalmaterialrequests.Add(existing);
        await context.SaveChangesAsync();

        var result = await CreateService(context, transactionRunner: new DuplicateOpenIssueLineTransactionRunner()).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-pending",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 3m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        result.RequestId.Should().Be(GuidHelper.ToGuidString(existing.RequestId));
        (await context.Supplementalmaterialrequests.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Model_ShouldDeclareGeneratedUniqueOpenIssueLineFence()
    {
        await using var context = CreateContext();
        var entityType = context.Model.FindEntityType(typeof(SupplementalMaterialRequest))!;

        entityType.FindProperty("OpenIssueLineId")!.GetComputedColumnSql()
            .Should().Contain("status");
        entityType.GetIndexes().Should().ContainSingle(index =>
            index.IsUnique && index.Properties.Select(property => property.Name).SequenceEqual(new[] { "OpenIssueLineId" }));
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectIssueThatKitchenHasNotReceived()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: null);
        await context.SaveChangesAsync();

        var action = () => CreateService(context).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-unreceived",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 1,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        await action.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*xác nhận đã nhận*");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectLegacyIssueLineWithoutDemandProvenance()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();
        context.Inventoryissuelines.Single().MaterialRequestLineId = null;
        await context.SaveChangesAsync();

        var action = () => CreateService(context).CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-legacy",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 1m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        await action.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đúng nguồn nhu cầu DEFAULT*");
    }

    [Fact]
    public async Task CreateAsync_ShouldRejectExactReconciliationSourceWhileDefaultIsActiveWithoutEffects()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        var reconciliationBatchId = GuidHelper.NewId();
        var reconciliationBatchLineId = GuidHelper.NewId();
        var issue = context.Inventoryissues.Local.Single(item => item.IssueId.SequenceEqual(seed.IssueId));
        var issueLine = issue.Inventoryissuelines.Single(item => item.IssueLineId.SequenceEqual(seed.IssueLineId));
        issue.MaterialRequestId = null;
        issue.ReconciliationBatchId = reconciliationBatchId;
        issueLine.MaterialRequestLineId = null;
        issueLine.ReconciliationBatchLineId = reconciliationBatchLineId;
        await context.SaveChangesAsync();
        var before = await CompleteLedgerSnapshotAsync(context);
        var service = CreateService(context, requestContext: new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.Default,
            OperationKey = "supplementalmaterialrequests.create",
            ExpectedModeVersion = 11,
            Disposition = OperationDisposition.Retained,
        });

        var action = () => service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-exact-reconciliation-source",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 1m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        await action.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đúng nguồn nhu cầu DEFAULT*");
        (await CompleteLedgerSnapshotAsync(context)).Should().BeEquivalentTo(before);
        issue.ReconciliationBatchId.Should().Equal(reconciliationBatchId);
        issueLine.ReconciliationBatchLineId.Should().Equal(reconciliationBatchLineId);
    }

    [Fact]
    public async Task PublicLifecycle_ShouldRejectWhileMaterialReconciliationIsActiveWithoutEffects()
    {
        await using var context = CreateContext();
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow);
        await context.SaveChangesAsync();
        var defaultService = CreateService(context);
        var created = await defaultService.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-before-switch",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));
        var before = await SnapshotAsync(context);
        var inactive = CreateService(context, requestContext: new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "supplementalmaterialrequests.test",
            ExpectedModeVersion = 9,
            Disposition = OperationDisposition.Retained,
        });

        var list = () => inactive.GetPagedAsync(new SupplementalMaterialRequestFilterDto());
        var detail = () => inactive.GetByIdAsync(created.RequestId);
        var create = () => inactive.CreateAsync(new CreateSupplementalMaterialRequest
        {
            CommandId = "supplemental-create-inactive",
            IssueId = GuidHelper.ToGuidString(seed.IssueId),
            IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
            RequestedQty = 1m,
        }, GuidHelper.ToGuidString(seed.UserId), GuidHelper.ToGuidString(seed.WarehouseId));
        var fulfill = () => inactive.FulfillAsync(created.RequestId,
            new FulfillSupplementalMaterialRequest { CommandId = "supplemental-fulfill-inactive", ExpectedVersion = 1, Quantity = 1m },
            GuidHelper.ToGuidString(seed.UserId), GuidHelper.ToGuidString(seed.WarehouseId));
        var route = () => inactive.RouteToPurchasingAsync(created.RequestId,
            new RouteSupplementalMaterialRequestToPurchasing { CommandId = "supplemental-route-inactive", ExpectedVersion = 1 },
            GuidHelper.ToGuidString(seed.UserId), GuidHelper.ToGuidString(seed.WarehouseId));
        var reject = () => inactive.RejectAsync(created.RequestId,
            new RejectSupplementalMaterialRequest { Reason = "inactive" },
            GuidHelper.ToGuidString(seed.UserId), GuidHelper.ToGuidString(seed.WarehouseId));

        await list.Should().ThrowAsync<BusinessRuleException>();
        await detail.Should().ThrowAsync<BusinessRuleException>();
        await create.Should().ThrowAsync<BusinessRuleException>();
        await fulfill.Should().ThrowAsync<BusinessRuleException>();
        await route.Should().ThrowAsync<BusinessRuleException>();
        await reject.Should().ThrowAsync<BusinessRuleException>();
        (await SnapshotAsync(context)).Should().BeEquivalentTo(before);
    }

    private static async Task<object> SnapshotAsync(IpcManagementContext context) => new
    {
        Requests = await context.Supplementalmaterialrequests.CountAsync(),
        Issues = await context.Inventoryissues.CountAsync(),
        PurchaseRequests = await context.Purchaserequests.CountAsync(),
        Movements = await context.Stockmovements.CountAsync(),
        Audits = await context.Auditlogs.CountAsync(),
        Transitions = await context.Lifecycletransitions.CountAsync(),
        Outbox = await context.Lifecycleoutboxmessages.CountAsync(),
        Receipts = await context.Lifecyclecommandreceipts.CountAsync(),
        State = await context.Supplementalmaterialrequests.Select(item => new { item.RequestId, item.Status, item.RequestedQty }).SingleAsync(),
    };

    private static async Task<object> CompleteLedgerSnapshotAsync(IpcManagementContext context) => new
    {
        Requests = await context.Supplementalmaterialrequests.CountAsync(),
        Issues = await context.Inventoryissues.CountAsync(),
        IssueLines = await context.Inventoryissuelines.CountAsync(),
        PurchaseRequests = await context.Purchaserequests.CountAsync(),
        PurchaseRequestLines = await context.Purchaserequestlines.CountAsync(),
        Stocks = await context.Currentstocks.OrderBy(item => item.IngredientId).Select(item => new { item.WarehouseId, item.IngredientId, item.UnitId, item.CurrentQty }).ToListAsync(),
        Movements = await context.Stockmovements.CountAsync(),
        Audits = await context.Auditlogs.CountAsync(),
        Transitions = await context.Lifecycletransitions.CountAsync(),
        Outbox = await context.Lifecycleoutboxmessages.CountAsync(),
        Receipts = await context.Lifecyclecommandreceipts.CountAsync(),
    };

    [Fact]
    public async Task GetPagedAsync_ShouldSearchByIngredientName()
    {
        await using var context = CreateContext();
        var rice = SeedReceivedIssueLine(context, DateTime.UtcNow, ingredientCode: "GAO", ingredientName: "Gạo");
        var salt = SeedReceivedIssueLine(context, DateTime.UtcNow, ingredientCode: "MUOI", ingredientName: "Muối", warehouseId: rice.WarehouseId);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-rice",
                IssueId = GuidHelper.ToGuidString(rice.IssueId),
                IssueLineId = GuidHelper.ToGuidString(rice.IssueLineId),
                RequestedQty = 1,
            },
            GuidHelper.ToGuidString(rice.UserId),
            GuidHelper.ToGuidString(rice.WarehouseId));
        await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-salt",
                IssueId = GuidHelper.ToGuidString(salt.IssueId),
                IssueLineId = GuidHelper.ToGuidString(salt.IssueLineId),
                RequestedQty = 1,
            },
            GuidHelper.ToGuidString(salt.UserId),
            GuidHelper.ToGuidString(salt.WarehouseId));

        var result = await service.GetPagedAsync(new SupplementalMaterialRequestFilterDto
        {
            PageNumber = 1,
            PageSize = 20,
            SearchKeyword = "Muối",
        });

        result.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle().Which.IngredientName.Should().Be("Muối");
    }

    [Fact]
    public async Task FulfillAsync_ShouldCreateSupplementalIssue_DecreaseStock_AndExposeRemainingQuantity()
    {
        await using var context = CreateContext();
        var sourceIssueDate = new DateOnly(2024, 1, 15);
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow, issueDate: sourceIssueDate);
        var stock = new CurrentStock
        {
            WarehouseId = seed.WarehouseId,
            IngredientId = seed.IngredientId,
            UnitId = seed.UnitId,
            CurrentQty = 5,
            LastUpdated = DateTime.UtcNow,
        };
        context.Currentstocks.Add(stock);
        await context.SaveChangesAsync();
        var stockLedger = Substitute.For<IStockLedgerService>();
        stockLedger.RemoveStockWithCheckAsync(
                Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<byte[]>(), Arg.Any<decimal>(),
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<byte[]>(), Arg.Any<byte[]>(),
                Arg.Any<string>(), Arg.Any<string>())
            .Returns(call =>
            {
                var quantity = call.ArgAt<decimal>(3);
                var requestId = call.ArgAt<byte[]>(6);
                stock.CurrentQty -= quantity;
                context.Stockmovements.Add(new StockMovement
                {
                    MovementId = GuidHelper.NewId(),
                    MovementDate = DateTime.UtcNow,
                    WarehouseId = seed.WarehouseId,
                    IngredientId = seed.IngredientId,
                    UnitId = seed.UnitId,
                    MovementType = "SUPPLEMENTAL",
                    RefTable = "supplementalmaterialrequests",
                    RefId = requestId,
                    QuantityIn = 0,
                    QuantityOut = quantity,
                    BeforeQty = 5,
                    AfterQty = 5 - quantity,
                    PerformedBy = seed.UserId,
                    Reason = "test",
                });
                return Task.CompletedTask;
            });
        var service = CreateService(context, stockLedger);
        var created = await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-fulfill",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 2.5m,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var result = await service.FulfillAsync(
            created.RequestId,
            new FulfillSupplementalMaterialRequest { CommandId = "supplemental-fulfill", ExpectedVersion = created.ConcurrencyVersion, Quantity = 2.5m },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var replay = await service.FulfillAsync(
            created.RequestId,
            new FulfillSupplementalMaterialRequest { CommandId = "supplemental-fulfill", ExpectedVersion = created.ConcurrencyVersion, Quantity = 2.5m },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var stale = () => service.FulfillAsync(
            created.RequestId,
            new FulfillSupplementalMaterialRequest { CommandId = "supplemental-fulfill-stale", ExpectedVersion = created.ConcurrencyVersion, Quantity = 0.5m },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));
        await stale.Should().ThrowAsync<DbUpdateConcurrencyException>();

        result.Status.Should().Be("ISSUED");
        result.ConcurrencyVersion.Should().Be(2);
        replay.Should().BeEquivalentTo(result);
        result.FulfilledQty.Should().Be(2.5m);
        result.RemainingQty.Should().Be(0);
        result.ActionDisabledReason.Should().Be("Kho đã cấp đủ; đang chờ bếp kiểm đếm và ký nhận.");
        stock.CurrentQty.Should().Be(2.5m);
        var supplementalIssue = await context.Inventoryissues.SingleAsync(item => item.IssueCode.StartsWith("ISS-SUP-"));
        supplementalIssue.IssueDate.Should().Be(sourceIssueDate);
        supplementalIssue.ShiftName.Should().Be("AFTERNOON");
        supplementalIssue.Inventoryissuelines.Single().MaterialRequestLineId
            .Should().Equal(context.Inventoryissuelines.Single(item => item.IssueLineId == seed.IssueLineId).MaterialRequestLineId);
        (await context.Inventoryissues.CountAsync(item => item.IssueCode.StartsWith("ISS-SUP-"))).Should().Be(1);
        (await context.Stockmovements.CountAsync(item => item.RefTable == "supplementalmaterialrequests")).Should().Be(1);
        (await context.Lifecyclecommandreceipts.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
        (await context.Lifecycletransitions.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
        (await context.Lifecycletransitions.AsNoTracking()
            .Where(item => item.AggregateType == nameof(SupplementalMaterialRequest))
            .OrderBy(item => item.AggregateSequence)
            .Select(item => item.AggregateSequence)
            .ToArrayAsync()).Should().Equal(0, 1);
        (await context.Lifecycleoutboxmessages.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
        (await context.Auditlogs.CountAsync(item => item.BusinessArea == "Lifecycle" && item.EntityName == nameof(SupplementalMaterialRequest))).Should().Be(2);
    }

    [Fact]
    public async Task RouteToPurchasingAsync_ShouldCreateTraceableDraftForOnlyMissingQuantity()
    {
        await using var context = CreateContext();
        var sourceIssueDate = new DateOnly(2024, 1, 15);
        var seed = SeedReceivedIssueLine(context, receivedAt: DateTime.UtcNow, issueDate: sourceIssueDate);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var created = await service.CreateAsync(
            new CreateSupplementalMaterialRequest
            {
                CommandId = "supplemental-create-route",
                IssueId = GuidHelper.ToGuidString(seed.IssueId),
                IssueLineId = GuidHelper.ToGuidString(seed.IssueLineId),
                RequestedQty = 3,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var result = await service.RouteToPurchasingAsync(
            created.RequestId,
            new RouteSupplementalMaterialRequestToPurchasing
            {
                CommandId = "supplemental-route",
                ExpectedVersion = created.ConcurrencyVersion,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var replay = await service.RouteToPurchasingAsync(
            created.RequestId,
            new RouteSupplementalMaterialRequestToPurchasing
            {
                CommandId = "supplemental-route",
                ExpectedVersion = created.ConcurrencyVersion,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));

        var stale = () => service.RouteToPurchasingAsync(
            created.RequestId,
            new RouteSupplementalMaterialRequestToPurchasing
            {
                CommandId = "supplemental-route-stale",
                ExpectedVersion = created.ConcurrencyVersion,
            },
            GuidHelper.ToGuidString(seed.UserId),
            GuidHelper.ToGuidString(seed.WarehouseId));
        await stale.Should().ThrowAsync<DbUpdateConcurrencyException>();

        result.Status.Should().Be("NEEDS_PURCHASE");
        result.ConcurrencyVersion.Should().Be(2);
        replay.Should().BeEquivalentTo(result);
        result.PurchaseRequestCode.Should().StartWith("PR-SUP-");
        var purchaseLine = await context.Purchaserequestlines.SingleAsync();
        purchaseLine.PurchaseQty.Should().Be(3);
        purchaseLine.IngredientId.Should().Equal(seed.IngredientId);
        purchaseLine.MaterialRequestLineId.Should().Equal(
            context.Inventoryissuelines.Single(item => item.IssueLineId == seed.IssueLineId).MaterialRequestLineId);
        var purchaseRequest = await context.Purchaserequests.SingleAsync();
        purchaseRequest.PurchaseForDate.Should().Be(sourceIssueDate);
        purchaseRequest.ShiftName.Should().Be("AFTERNOON");
        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(1);
        (await context.Lifecyclecommandreceipts.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
        (await context.Lifecycletransitions.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
        (await context.Lifecycleoutboxmessages.CountAsync(item => item.AggregateType == nameof(SupplementalMaterialRequest))).Should().Be(2);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new IpcManagementContext(options);
    }

    private static SupplementalMaterialRequestService CreateService(
        IpcManagementContext context,
        IStockLedgerService? stockLedgerService = null,
        IEfTransactionRunner? transactionRunner = null,
        SystemOperationRequestContext? requestContext = null)
    {
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.SaveChangesAsync().Returns(_ => context.SaveChangesAsync());
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            context.Inventoryissues.Local.Select(item => item.WarehouseId).FirstOrDefault() ??
            context.Supplementalmaterialrequests.Local.Select(item => item.WarehouseId).First());
        return new SupplementalMaterialRequestService(
            context,
            unitOfWork,
            stockLedgerService ?? Substitute.For<IStockLedgerService>(),
            transactionRunner ?? new EfTransactionRunner(context),
            resolver,
            requestContext);
    }

    private sealed class DuplicateOpenIssueLineTransactionRunner : IEfTransactionRunner
    {
        public Task ExecuteAsync(
            Func<CancellationToken, Task> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
            => throw DuplicateKeyException();

        public Task<TResult> ExecuteProtectedAsync<TResult>(
            string operationKey,
            long expectedModeVersion,
            Func<CancellationToken, Task<TResult>> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("This test double does not support protected transactions.");

        public Task<TResult> ExecuteAsync<TResult>(
            Func<CancellationToken, Task<TResult>> operation,
            Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted,
            CancellationToken cancellationToken = default)
            => throw DuplicateKeyException();

        private static DbUpdateException DuplicateKeyException()
            => new(
                "Concurrent insert failed.",
                new InvalidOperationException("Duplicate entry for key 'uxSupplementalMaterialRequestsOpenIssueLine'"));
    }

    private static (byte[] IssueId, byte[] IssueLineId, byte[] WarehouseId, byte[] UserId, byte[] IngredientId, byte[] UnitId, byte[] MaterialRequestId) SeedReceivedIssueLine(
        IpcManagementContext context,
        DateTime? receivedAt,
        DateOnly? issueDate = null,
        string ingredientCode = "GAO",
        string ingredientName = "Gạo",
        byte[]? warehouseId = null)
    {
        var issueId = GuidHelper.NewId();
        var issueLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        warehouseId ??= GuidHelper.NewId();
        var userId = GuidHelper.NewId();
        var materialRequestId = GuidHelper.NewId();
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = ingredientCode, IngredientName = ingredientName, UnitId = unitId, WarehouseId = warehouseId, IsActive = true };
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", ConvertRateToBase = 1 };
        var materialRequestLine = new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = materialRequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredientId,
            UnitId = unitId,
            TotalServings = 1,
            GrossQtyPerServing = 10,
            BomRatePercent = 100,
            AppliedPortionRuleSource = "TEST",
            AppliedPortionRatePercent = 100,
            TotalRequiredQty = 10,
            CurrentStockQty = 0,
            SuggestedPurchaseQty = 0,
            Ingredient = ingredient,
            Unit = unit,
        };
        var productionPlanLine = new ProductionPlanLine
        {
            PlanLineId = materialRequestLine.PlanLineId,
            PlanId = GuidHelper.NewId(),
            QuantityPlanLineId = GuidHelper.NewId(),
            CustomerId = GuidHelper.NewId(),
            MenuId = GuidHelper.NewId(),
            DishId = GuidHelper.NewId(),
            ShiftName = "AFTERNOON",
            TotalServings = 1,
        };
        var issue = new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = "ISS-TEST",
            IssueDate = issueDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            ShiftName = "MORNING",
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            IssuedBy = userId,
            ReceivedBy = receivedAt is null ? null : userId,
            ReceivedAt = receivedAt,
            CreatedAt = DateTime.UtcNow,
        };
        var line = new InventoryIssueLine
        {
            IssueLineId = issueLineId,
            IssueId = issueId,
            IngredientId = ingredientId,
            UnitId = unitId,
            MaterialRequestLineId = materialRequestLine.RequestLineId,
            RequestedQty = 10,
            IssuedQty = 10,
            Issue = issue,
            Ingredient = ingredient,
            Unit = unit,
        };
        issue.Inventoryissuelines.Add(line);
        context.AddRange(unit, ingredient, productionPlanLine, materialRequestLine, issue, line);
        return (issueId, issueLineId, warehouseId, userId, ingredientId, unitId, materialRequestId);
    }
}
