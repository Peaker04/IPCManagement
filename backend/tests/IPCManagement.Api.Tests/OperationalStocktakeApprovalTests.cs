using IPCManagement.Api.Workflows.OperationalApprovals;
using System.Security.Claims;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace IPCManagement.Api.Tests;

public sealed class OperationalStocktakeApprovalTests
{
    [Theory]
    [InlineData("PENDING", "REVIEWING", "KK-MATCH", 205)]
    [InlineData("PROCESSED", "APPROVED", "KK-MATCH", 205)]
    [InlineData("PENDING", "REVIEWING", "KIỂM KÊ", 355)]
    [InlineData("PROCESSED", "APPROVED", "KIỂM KÊ", 355)]
    public async Task Stocktake_pages_traverse_more_than_two_hundred_exact_matches_with_bounded_sql_reads(string state, string status, string search, int expectedCount)
    {
        var probe = new StocktakeReadProbe();
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync(probe);
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);");
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        for (var i = 0; i < 355; i++) db.Stocktakes.Add(new Stocktake { StocktakeId = IPCManagement.Api.Helpers.GuidHelper.NewId(),
            StocktakeCode = (i < 150 ? "KK-OTHER-" : "KK-MATCH-") + i.ToString("D4"), Status = status,
            CreatedAt = new DateTime(2026, 11, 16), ApprovedAt = state == "PROCESSED" ? new DateTime(2026, 11, 17) : null,
            WarehouseId = fixture.WarehouseId, CreatedBy = fixture.UserId });
        await db.SaveChangesAsync();
        var routing = Substitute.For<IApprovalRoutingService>();
        var service = new OperationalApprovalService(db, new ApprovalInboxService(db, routing, new OperationalInventoryInboxSource(db)), Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), routing);
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Manager"), new Claim(ClaimTypes.NameIdentifier, fixture.UserIdString)], "test"));
        string? cursor = null;
        var ids = new List<string>();
        do
        {
            var page = await service.GetPageAsync(actor, new ApprovalInboxQueryDto { State = state, TargetType = "stocktake", Limit = 20,
                SearchKeyword = search, Week = "2026-11-16", Cursor = cursor });
            Assert.InRange(page.Items.Count, 1, 20);
            ids.AddRange(page.Items.Select(x => x.TargetId)); cursor = page.NextCursor;
        } while (cursor is not null);
        Assert.Equal(expectedCount, ids.Count); Assert.Equal(expectedCount, ids.Distinct().Count());
        Assert.NotEmpty(probe.Limits); Assert.All(probe.Limits, value => Assert.InRange(value, 1, 100));
    }

    private sealed class StocktakeReadProbe : DbCommandInterceptor
    {
        internal List<int> Limits { get; } = [];
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData,
            InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("FROM \"stocktakes\"", StringComparison.Ordinal) && command.CommandText.Contains("LIMIT", StringComparison.Ordinal))
            {
                var tail = command.CommandText[(command.CommandText.LastIndexOf("LIMIT", StringComparison.Ordinal) + 5)..].TrimStart();
                var parameter = tail.Split([' ', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries)[0];
                if (command.Parameters.Contains(parameter)) Limits.Add(Convert.ToInt32(command.Parameters[parameter].Value));
            }
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    [Theory]
    [InlineData(ApprovalDecision.Approve, "APPROVED", 2)]
    [InlineData(ApprovalDecision.Reject, "REJECTED", 0)]
    public async Task Stocktake_hub_uses_real_inventory_owner_and_replay_never_adjusts_stock_twice(ApprovalDecision decision, string status, int delta)
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);");
        var id = IPCManagement.Api.Helpers.GuidHelper.NewId();
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = fixture.UserId });
        db.Currentstocks.Add(new CurrentStock { WarehouseId = fixture.WarehouseId, IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId, CurrentQty = 10, LastUpdated = DateTime.UtcNow });
        db.Stocktakes.Add(new Stocktake { StocktakeId = id, StocktakeCode = "KK-REAL", WarehouseId = fixture.WarehouseId,
            CreatedBy = fixture.UserId, CreatedAt = new DateTime(2026, 11, 16), Status = "REVIEWING", Stocktakelines = [new StocktakeLine {
                LineId = IPCManagement.Api.Helpers.GuidHelper.NewId(), StocktakeId = id, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
                SystemQty = 10, ActualQty = 12, DiscrepancyQty = 2, Reason = "Kiểm đếm" }] });
        await db.SaveChangesAsync();
        var before = await db.Currentstocks.Select(x => x.CurrentQty).SingleAsync();
        var ledger = new StockLedgerService(new CurrentStockRepository(db), new StockMovementRepository(db), db);
        var stocktakes = new StocktakeService(new StocktakeRepository(db), new UnitOfWork(db), ledger, new EfTransactionRunner(db),
            Substitute.For<IOperationalWarehouseResolver>(), db);
        var service = new OperationalApprovalService(db, Substitute.For<IApprovalInboxService>(), Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>(), null, stocktakes);
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Manager"), new Claim(ClaimTypes.NameIdentifier, fixture.UserIdString)], "test"));
        var target = new Guid(id).ToString();
        var detail = await service.GetDetailAsync(actor, "stocktake", target);
        var command = new OperationalApprovalActionRequest { CommandId = Guid.NewGuid().ToString(), ExpectedModeVersion = 1,
            ExpectedFingerprint = detail.Fingerprint, Decision = decision, Reason = "Đã đối chiếu kiểm đếm" };
        await using var staleDb = fixture.CreateContext();
        await new StocktakeRepository(staleDb).GetByIdWithLinesAsync(id);
        var first = await service.DecideAsync(actor, "stocktake", target, command);
        var replay = await service.DecideAsync(actor, "stocktake", target, command);
        Assert.Equal(status, first.Status);
        Assert.Equal(System.Text.Json.JsonSerializer.Serialize(first), System.Text.Json.JsonSerializer.Serialize(replay));
        Assert.Equal(before + delta, await db.Currentstocks.Select(x => x.CurrentQty).SingleAsync());
        Assert.Equal(delta == 0 ? 0 : 1, await db.Stockmovements.CountAsync(x => x.RefTable == "stocktakes"));
        Assert.Equal(command.Reason, Assert.Single(await db.Auditlogs.Where(x => x.EntityName == nameof(Stocktake) && x.FieldName == "Status").ToListAsync()).Reason);
        Assert.Single(await db.Lifecyclecommandreceipts.Where(x => x.AggregateType == "OperationalApproval:DEFAULT:stocktake").ToListAsync());
        var staleOwner = new StocktakeService(new StocktakeRepository(staleDb), new UnitOfWork(staleDb),
            new StockLedgerService(new CurrentStockRepository(staleDb), new StockMovementRepository(staleDb), staleDb),
            new EfTransactionRunner(staleDb), Substitute.For<IOperationalWarehouseResolver>(), staleDb);
        await Assert.ThrowsAsync<IPCManagement.Api.Exceptions.ResourceConflictException>(() => staleOwner.RejectAsync(target, fixture.UserIdString, "Leaf đã đọc trạng thái cũ"));
    }

    [Fact]
    public async Task Pending_stocktake_has_exact_system_actual_variance_context_and_is_excluded_from_mrx()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(false);
        await using var db = fixture.CreateContext();
        await db.Database.ExecuteSqlRawAsync("CREATE TABLE systemoperationmodes (id INTEGER PRIMARY KEY, mode TEXT NOT NULL, version INTEGER NOT NULL, updatedBy BLOB NOT NULL, updatedAt TEXT NOT NULL, reason TEXT NULL);");
        var actorId = fixture.UserId;
        var actor = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Manager"),
            new Claim(ClaimTypes.NameIdentifier, fixture.UserIdString)], "test"));
        var unitId = fixture.UnitId;
        var ingredientId = fixture.IngredientId;
        var warehouseId = fixture.WarehouseId;
        var stocktakeId = IPCManagement.Api.Helpers.GuidHelper.NewId();
        db.Systemoperationmodes.Add(new SystemOperationMode { Mode = "DEFAULT", Version = 1, UpdatedBy = actorId });
        db.Stocktakes.Add(new Stocktake { StocktakeId = stocktakeId, StocktakeCode = "KK-1", Status = "REVIEWING", WarehouseId = warehouseId, CreatedBy = actorId,
            CreatedAt = new DateTime(2026, 11, 16, 1, 0, 0, DateTimeKind.Utc), Stocktakelines = [new StocktakeLine {
                LineId = IPCManagement.Api.Helpers.GuidHelper.NewId(), StocktakeId = stocktakeId, IngredientId = ingredientId, UnitId = unitId,
                SystemQty = 10, ActualQty = 8, DiscrepancyQty = -2, Reason = "Chênh lệch kiểm kê" }] });
        await db.SaveChangesAsync();
        var inbox = Substitute.For<IApprovalInboxService>();
        var service = new OperationalApprovalService(db, inbox, Substitute.For<IApprovalWorkflowService>(),
            Substitute.For<IMenuAmendmentService>(), Substitute.For<IApprovalRoutingService>(), null, Substitute.For<IStocktakeService>());
        var detail = await service.GetDetailAsync(actor, "stocktake", new Guid(stocktakeId).ToString());
        Assert.Equal("KK-1", detail.Item.TargetCode);
        var line = Assert.Single(detail.Stocktake!.Lines);
        Assert.Equal(10, line.SystemQty); Assert.Equal(8, line.ActualQty); Assert.Equal(-2, line.DiscrepancyQty);
        Assert.Contains("APPROVE", detail.AllowedActions);
        Assert.Empty(inbox.ReceivedCalls());
        (await db.Systemoperationmodes.SingleAsync()).Mode = "MATERIAL_RECONCILIATION"; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.GetDetailAsync(actor, "stocktake", new Guid(stocktakeId).ToString()));
    }
}
