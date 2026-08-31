using System.Reflection;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationWarehouseIssueRequestFixtureTests
{
    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);
    private static readonly string[] ForbiddenHeaderFragments =
        ["authorization", "cookie", "api-key", "apikey", "host", "origin", "referer", "forwarded", "token", "secret"];

    [Fact]
    public async Task Tracked_production_request_loses_mode_change_at_public_controller_with_complete_zero_ledger()
    {
        var fixture = await ReadFixtureAsync();
        Assert.Equal(1, fixture.SchemaVersion);
        Assert.NotEmpty(fixture.Headers);
        Assert.All(fixture.Headers.Keys, name =>
            Assert.DoesNotContain(ForbiddenHeaderFragments, fragment => name.Contains(fragment, StringComparison.OrdinalIgnoreCase)));

        var controllerRoute = typeof(InventoryIssuesController).GetCustomAttribute<RouteAttribute>()!.Template;
        var action = typeof(InventoryIssuesController).GetMethod(nameof(InventoryIssuesController.CreateAsync))!;
        Assert.NotNull(action.GetCustomAttribute<HttpPostAttribute>());
        Assert.Equal("POST", fixture.Method);
        Assert.Equal($"/{controllerRoute}", fixture.Path);

        var request = fixture.Body.Deserialize<CreateInventoryIssueRequest>(WebJson);
        Assert.NotNull(request);
        Assert.False(string.IsNullOrWhiteSpace(request.CommandId));
        var sourceLine = Assert.Single(request.Lines);
        var actor = GuidHelper.NewId();
        var actorId = GuidHelper.ToGuidString(actor);
        var batchId = GuidHelper.ParseGuidString(request.ReconciliationBatchId)!;
        var batchLineId = GuidHelper.ParseGuidString(sourceLine.ReconciliationBatchLineId)!;
        var ingredientId = GuidHelper.ParseGuidString(sourceLine.IngredientId)!;
        var unitId = GuidHelper.ParseGuidString(sourceLine.UnitId)!;
        var warehouseId = GuidHelper.NewId();

        await using var context = CreateContext();
        var unit = new Unit { UnitId = unitId, UnitCode = "KG", UnitName = "kg", BaseUnitCode = "KG", ConvertRateToBase = 1 };
        var warehouse = new Warehouse { WarehouseId = warehouseId, WarehouseCode = "WH-FIXTURE", WarehouseName = "Fixture warehouse", WarehouseType = "MAIN", IsOperationalActive = true };
        var ingredient = new Ingredient { IngredientId = ingredientId, IngredientCode = "ING-FIXTURE", IngredientName = "Fixture ingredient", UnitId = unitId, WarehouseId = warehouseId, Unit = unit, Warehouse = warehouse, IsActive = true };
        context.AddRange(
            unit,
            warehouse,
            ingredient,
            new CurrentStock { WarehouseId = warehouseId, IngredientId = ingredientId, UnitId = unitId, CurrentQty = 20 },
            new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.MaterialReconciliation, Version = 7, UpdatedAt = DateTime.UtcNow, UpdatedBy = actor },
            new ReconciliationBatch
            {
                BatchId = batchId,
                MenuVersionId = GuidHelper.NewId(),
                QuantityImportBatchId = GuidHelper.NewId(),
                Status = "TRANSFERRED",
                Version = request.ExpectedVersion,
                CreatedBy = actor,
                CreatedAt = DateTime.UtcNow,
                Lines =
                [
                    new ReconciliationBatchLine
                    {
                        BatchLineId = batchLineId,
                        IngredientId = ingredientId,
                        CanonicalUnitId = unitId,
                        RequiredQuantity = sourceLine.RequestedQty,
                        FrozenTolerance = 0.1m,
                        ToleranceSourceKind = "SYSTEM_DEFAULT",
                        ToleranceSourceVersion = "1",
                        Version = 1,
                    },
                ],
            });
        await context.SaveChangesAsync();

        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "inventory.issues.create.reconciliation",
            ExpectedModeVersion = 7,
            Disposition = OperationDisposition.ReconciliationOnly,
        };
        var guard = new SystemOperationModeGuard(context);
        var modeService = new SystemOperationModeService(context, guard, new ImmediateTransactionRunner());
        await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(SystemOperationEligibility.Default, 7, true, "Fixture stale replay"),
            actorId);
        context.ChangeTracker.Clear();
        var before = CaptureLedger(context);

        var service = new InventoryIssueService(
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(new CurrentStockRepository(context), new StockMovementRepository(context)),
            new ImmediateTransactionRunner(),
            new FixedWarehouseResolver(warehouseId),
            context,
            requestContext,
            guard);
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<System.Security.Claims.ClaimsPrincipal>()).Returns(actorId);
        var controller = new InventoryIssuesController(service, currentUser);

        await Assert.ThrowsAsync<SystemOperationConflictException>(() => controller.CreateAsync(request));

        context.ChangeTracker.Clear();
        Assert.Equal(before, CaptureLedger(context));
    }

    [Fact]
    public async Task Tracked_fixture_rejects_unsupported_schema_and_forbidden_headers()
    {
        var fixture = await ReadFixtureAsync();
        var unsupported = fixture with { SchemaVersion = fixture.SchemaVersion + 1 };
        var forbidden = fixture with { Headers = new Dictionary<string, string>(fixture.Headers, StringComparer.OrdinalIgnoreCase) { ["Authorization"] = "redacted" } };

        Assert.Throws<InvalidDataException>(() => ValidateFixture(unsupported));
        Assert.Throws<InvalidDataException>(() => ValidateFixture(forbidden));
    }

    private static async Task<TrackedRequestFixture> ReadFixtureAsync()
    {
        var path = FindRepositoryFile("contracts", "phase30", "reconciliation-stale-request.json");
        await using var stream = File.OpenRead(path);
        var fixture = await JsonSerializer.DeserializeAsync<TrackedRequestFixture>(stream, WebJson)
            ?? throw new InvalidDataException("Tracked request fixture is empty.");
        ValidateFixture(fixture);
        return fixture;
    }

    private static void ValidateFixture(TrackedRequestFixture fixture)
    {
        if (fixture.SchemaVersion != 1) throw new InvalidDataException($"Unsupported request fixture schema {fixture.SchemaVersion}.");
        if (fixture.Headers.Keys.Any(name => ForbiddenHeaderFragments.Any(fragment => name.Contains(fragment, StringComparison.OrdinalIgnoreCase))))
            throw new InvalidDataException("Tracked request fixture contains a forbidden header.");
    }

    private static string FindRepositoryFile(params string[] relativeSegments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine([current.FullName, .. relativeSegments]);
            if (File.Exists(candidate)) return candidate;
            current = current.Parent;
        }
        throw new FileNotFoundException("Could not locate tracked repository request fixture.");
    }

    private static CompleteLedger CaptureLedger(IpcManagementContext context)
    {
        var batch = context.Reconciliationbatches.AsNoTracking().Single();
        return new CompleteLedger(
            batch.Status,
            batch.Version,
            context.Inventoryissues.Count(),
            context.Inventoryissuelines.Count(),
            context.Stockmovements.Count(),
            string.Join('|', context.Currentstocks.AsNoTracking().OrderBy(item => item.IngredientId).Select(item => item.CurrentQty)),
            context.Lifecycletransitions.Count(),
            context.Auditlogs.Count(),
            context.Lifecyclecommandreceipts.Count());
    }

    private static IpcManagementContext CreateContext() => new(
        new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-request-fixture-{Guid.NewGuid():N}")
            .Options);

    private sealed class FixedWarehouseResolver(byte[] warehouseId) : IOperationalWarehouseResolver
    {
        public Task<byte[]> ResolveAsync(CancellationToken cancellationToken = default) => Task.FromResult(warehouseId);
    }

    private sealed record TrackedRequestFixture(
        int SchemaVersion,
        string Method,
        string Path,
        Dictionary<string, string> Headers,
        JsonElement Body);

    private sealed record CompleteLedger(
        string WorkflowStatus,
        long WorkflowVersion,
        int Issues,
        int Lines,
        int Movements,
        string Stock,
        int Lifecycle,
        int Audits,
        int Receipts);
}
