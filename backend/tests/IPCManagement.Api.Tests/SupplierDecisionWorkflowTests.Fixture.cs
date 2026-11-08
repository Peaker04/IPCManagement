using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using MySqlConnector;
using System.Security.Cryptography;
using System.Text;
using System.Data.Common;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public partial class SupplierDecisionWorkflowTests
{
    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"supplier-decision-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static PurchaseOrderService CreatePurchaseOrderService(IpcManagementContext context)
        => new(
            context,
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context));

    private static (
        PurchaseRequest Request,
        Supplier SupplierA,
        Supplier SupplierB,
        IReadOnlyList<PurchaseLineSupplierDecision> Decisions)
        SeedApprovedPurchaseRequestForOrders(IpcManagementContext context)
    {
        var unit = SeedUnit(context, $"KG-{Guid.NewGuid():N}", "kg", "KG", 1m);
        var supplierA = SeedSupplier(context, $"SUP-PO-A-{Guid.NewGuid():N}", "Supplier PO A");
        var supplierB = SeedSupplier(context, $"SUP-PO-B-{Guid.NewGuid():N}", "Supplier PO B");
        var receivingWarehouseId = GuidHelper.NewId();
        var request = new PurchaseRequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = $"PR-PO-{Guid.NewGuid():N}",
            RequestDate = new DateOnly(2026, 7, 22),
            PurchaseForDate = new DateOnly(2026, 7, 23),
            Status = "APPROVED",
            CreatedBy = UserIdBytes
        };
        var decisions = new List<PurchaseLineSupplierDecision>();
        foreach (var (supplier, proposedPrice, fingerprintSeed) in new[]
                 {
                     (supplierA, 110m, 'A'),
                     (supplierB, 120m, 'B')
                 })
        {
            var ingredient = new Ingredient
            {
                IngredientId = GuidHelper.NewId(),
                IngredientCode = $"ING-PO-{Guid.NewGuid():N}",
                IngredientName = $"Ingredient {fingerprintSeed}",
                UnitId = unit.UnitId,
                WarehouseId = GuidHelper.NewId(),
                ReferencePrice = 100m,
                IsActive = true,
                Unit = unit
            };
            var line = new PurchaseRequestLine
            {
                PurchaseRequestLineId = GuidHelper.NewId(),
                PurchaseRequestId = request.PurchaseRequestId,
                MaterialRequestLineId = GuidHelper.NewId(),
                IngredientId = ingredient.IngredientId,
                SupplierId = supplier.SupplierId,
                UnitId = unit.UnitId,
                RequiredQty = 10m,
                CurrentStockQty = 0m,
                PurchaseQty = 10m,
                EstimatedUnitPrice = proposedPrice,
                ExpectedDeliveryDate = request.PurchaseForDate,
                PurchaseRequest = request,
                Ingredient = ingredient,
                Supplier = supplier,
                Unit = unit
            };
            var decision = new PurchaseLineSupplierDecision
            {
                PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                SupplierId = supplier.SupplierId,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = request.RequestDate,
                EvidenceReferencePrice = 100m,
                ProposedUnitPrice = proposedPrice,
                ProposedDeliveryDate = request.PurchaseForDate,
                ReceivingWarehouseId = receivingWarehouseId,
                PurchasingTerms = "NET 30",
                ConfirmedBy = UserIdBytes,
                ConfirmedAt = DateTime.UtcNow,
                DecisionFingerprint = new string(fingerprintSeed, 64),
                Version = 1,
                Status = "CURRENT",
                CurrentDecisionKey = line.PurchaseRequestLineId,
                PurchaseRequestLine = line,
                Supplier = supplier
            };
            if (PurchasePricePolicy.RequiresException(
                    PurchasePricePolicy.CalculateVariancePercent(100m, proposedPrice)))
            {
                decision.Purchasepriceexceptions.Add(new PurchasePriceException
                {
                    PurchasePriceExceptionId = GuidHelper.NewId(),
                    PurchaseLineSupplierDecisionId = decision.PurchaseLineSupplierDecisionId,
                    ReferencePrice = 100m,
                    ProposedPrice = proposedPrice,
                    VariancePercent = 20m,
                    EvidenceType = decision.EvidenceType,
                    EvidenceId = decision.EvidenceId,
                    EvidenceDate = decision.EvidenceDate,
                    Reason = "Giá tăng theo báo giá hiện hành",
                    ProposalFingerprint = decision.DecisionFingerprint,
                    ProposalVersion = decision.Version,
                    RequestedBy = UserIdBytes,
                    RequestedAt = DateTime.UtcNow,
                    Status = "APPROVED",
                    DecidedBy = UserIdBytes,
                    DecisionReason = "Quản lý đã duyệt",
                    DecidedAt = DateTime.UtcNow,
                    PurchaseLineSupplierDecision = decision
                });
            }

            line.SupplierDecisions.Add(decision);
            request.Purchaserequestlines.Add(line);
            decisions.Add(decision);
        }

        context.Purchaserequests.Add(request);
        return (request, supplierA, supplierB, decisions);
    }

    private static bool MySqlMigrationTestsEnabled()
        => string.Equals(
            Environment.GetEnvironmentVariable("IPC_RUN_MYSQL_MIGRATION_TESTS"),
            "1",
            StringComparison.Ordinal);

    private static IpcManagementContext CreateMySqlContext(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(
                DisposableConnectionString(database),
                new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;
        return new IpcManagementContext(options);
    }

    private static async Task<long> SchemaObjectCountAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static async Task<int> ExecuteNonQueryAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return await command.ExecuteNonQueryAsync();
    }

    private static string DisposableConnectionString(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var configured = Environment.GetEnvironmentVariable("IPC_TEST_CONNECTION_STRING");
        if (string.IsNullOrWhiteSpace(configured))
        {
            throw new InvalidOperationException(
                "IPC_TEST_CONNECTION_STRING phải trỏ tới MySQL test riêng để chạy migration replay.");
        }

        return new MySqlConnectionStringBuilder(configured)
        {
            Database = database
        }.ConnectionString;
    }

    private static async Task<string> SupplierSnapshotFingerprintAsync(string database)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT CONCAT(HEX(purchaseRequestLineId), '|', COALESCE(HEX(supplierId), '<NULL>'))
            FROM purchaserequestlines
            ORDER BY HEX(purchaseRequestLineId);
            """;
        await using var reader = await command.ExecuteReaderAsync();
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        while (await reader.ReadAsync())
        {
            hash.AppendData(Encoding.UTF8.GetBytes(reader.GetString(0)));
            hash.AppendData("\n"u8);
        }

        return Convert.ToHexString(hash.GetHashAndReset());
    }

    private static string FindRepositoryFile(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine([current.FullName, .. segments]);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Không tìm thấy file fixture: {Path.Combine(segments)}");
    }

    private static Task CreateWorkbenchSqliteSchemaAsync(IpcManagementContext context)
        => context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                requestScope TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE materialrequestlines (
                requestLineId BLOB PRIMARY KEY,
                requestId BLOB NOT NULL,
                suggestedPurchaseQty TEXT NOT NULL
            );
            CREATE TABLE purchaserequests (
                purchaseRequestId BLOB PRIMARY KEY,
                purchaseRequestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                purchaseForDate TEXT NOT NULL,
                shiftName TEXT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                approvedBy BLOB NULL,
                approvedAt TEXT NULL
            );
            CREATE TABLE ingredients (
                ingredientId BLOB PRIMARY KEY,
                ingredientCode TEXT NOT NULL,
                ingredientName TEXT NOT NULL,
                unitId BLOB NOT NULL,
                warehouseId BLOB NOT NULL,
                referencePrice TEXT NOT NULL,
                isFreshDaily INTEGER NOT NULL,
                isActive INTEGER NULL
            );
            CREATE TABLE purchaserequestlines (
                purchaseRequestLineId BLOB PRIMARY KEY,
                purchaseRequestId BLOB NOT NULL,
                materialRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                supplierId BLOB NULL,
                isLegacySupplierSnapshot INTEGER NOT NULL DEFAULT 0,
                unitId BLOB NOT NULL,
                requiredQty TEXT NOT NULL,
                currentStockQty TEXT NOT NULL,
                purchaseQty TEXT NOT NULL,
                estimatedUnitPrice TEXT NOT NULL,
                expectedDeliveryDate TEXT NULL,
                note TEXT NULL
            );
            CREATE TABLE purchaseorders (
                purchaseOrderId BLOB PRIMARY KEY,
                purchaseOrderCode TEXT NOT NULL,
                purchaseRequestId BLOB NOT NULL,
                supplierId BLOB NOT NULL,
                proposedDeliveryDate TEXT NULL,
                receivingWarehouseId BLOB NULL,
                purchasingTerms TEXT NULL,
                orderDate TEXT NOT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            CREATE TABLE purchaseorderlines (
                purchaseOrderLineId BLOB PRIMARY KEY,
                purchaseOrderId BLOB NOT NULL,
                purchaseRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                unitId BLOB NOT NULL,
                orderedQty TEXT NOT NULL,
                receivedQty TEXT NOT NULL,
                unitPrice TEXT NOT NULL
            );
            """);

    private static PurchaseRequestWorkflowService CreateService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

    private static IpcManagementContext CreateSqliteContext(
        SqliteConnection connection,
        DbCommandInterceptor interceptor)
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;
        return new IpcManagementContext(options);
    }

    private static Supplier SeedSupplier(IpcManagementContext context)
        => SeedSupplier(context, "SUP-WORKBENCH", "Supplier workbench");

    private static Supplier SeedSupplier(
        IpcManagementContext context,
        string code,
        string name,
        bool isActive = true)
    {
        var supplier = new Supplier
        {
            SupplierId = GuidHelper.NewId(),
            SupplierCode = code,
            SupplierName = name,
            IsActive = isActive
        };
        context.Suppliers.Add(supplier);
        return supplier;
    }

    private static SupplierQuotation SeedQuotation(
        IpcManagementContext context,
        Supplier supplier,
        Ingredient ingredient,
        decimal unitPrice,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo = null)
    {
        if (context.Entry(ingredient).State == EntityState.Detached)
        {
            context.Ingredients.Add(ingredient);
        }

        var quotation = new SupplierQuotation
        {
            QuotationId = GuidHelper.NewId(),
            SupplierId = supplier.SupplierId,
            IngredientId = ingredient.IngredientId,
            UnitPrice = unitPrice,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Supplier = supplier,
            Ingredient = ingredient
        };
        context.Supplierquotations.Add(quotation);
        return quotation;
    }

    private static Unit SeedUnit(
        IpcManagementContext context,
        string code,
        string name,
        string baseUnitCode,
        decimal convertRateToBase)
    {
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = code,
            UnitName = name,
            BaseUnitCode = baseUnitCode,
            ConvertRateToBase = convertRateToBase
        };
        context.Units.Add(unit);
        return unit;
    }

    private static InventoryReceiptLine SeedReceiptLine(
        IpcManagementContext context,
        Supplier supplier,
        Ingredient ingredient,
        Unit unit,
        DateOnly receiptDate,
        decimal unitPrice)
    {
        var receipt = new InventoryReceipt
        {
            ReceiptId = GuidHelper.NewId(),
            ReceiptCode = $"REC-{Guid.NewGuid():N}",
            ReceiptDate = receiptDate,
            WarehouseId = GuidHelper.NewId(),
            SupplierId = supplier.SupplierId,
            CreatedBy = UserIdBytes,
            CreatedAt = DateTime.UtcNow,
            Supplier = supplier
        };
        var line = new InventoryReceiptLine
        {
            ReceiptLineId = GuidHelper.NewId(),
            ReceiptId = receipt.ReceiptId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            Quantity = 1m,
            UnitPrice = unitPrice,
            Receipt = receipt,
            Ingredient = ingredient,
            Unit = unit
        };
        receipt.Inventoryreceiptlines.Add(line);
        context.Inventoryreceipts.Add(receipt);
        context.Inventoryreceiptlines.Add(line);
        return line;
    }

    private static PurchaseRequest SeedPurchaseProgress(
        IpcManagementContext context,
        MaterialRequest demand,
        string status,
        Supplier? supplier = null,
        decimal estimatedUnitPrice = 100m,
        bool withOrder = false)
    {
        var materialLine = demand.Materialrequestlines.Single();
        var request = new PurchaseRequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = $"PR-{demand.RequestDate:yyyyMMdd}-FULLDAY",
            RequestDate = demand.RequestDate,
            PurchaseForDate = demand.RequestDate,
            Status = status,
            CreatedBy = UserIdBytes
        };
        var line = new PurchaseRequestLine
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = request.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = supplier?.SupplierId,
            UnitId = materialLine.UnitId,
            RequiredQty = 10m,
            CurrentStockQty = 0m,
            PurchaseQty = 10m,
            EstimatedUnitPrice = supplier is null ? 0m : estimatedUnitPrice,
            ExpectedDeliveryDate = supplier is null ? null : demand.RequestDate,
            PurchaseRequest = request,
            MaterialRequestLine = materialLine,
            Ingredient = materialLine.Ingredient,
            Supplier = supplier,
            Unit = materialLine.Unit
        };
        if (supplier is not null)
        {
            line.SupplierDecisions.Add(new PurchaseLineSupplierDecision
            {
                PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                SupplierId = supplier.SupplierId,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = demand.RequestDate,
                EvidenceReferencePrice = 100m,
                ProposedUnitPrice = estimatedUnitPrice,
                ProposedDeliveryDate = demand.RequestDate,
                ConfirmedBy = UserIdBytes,
                ConfirmedAt = DateTime.UtcNow,
                DecisionFingerprint = Convert.ToHexString(SHA256.HashData(line.PurchaseRequestLineId)),
                Version = 1,
                Status = "CURRENT",
                CurrentDecisionKey = line.PurchaseRequestLineId,
                PurchaseRequestLine = line
            });
        }
        request.Purchaserequestlines.Add(line);
        context.Purchaserequests.Add(request);

        if (withOrder)
        {
            var order = new PurchaseOrder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-WORKBENCH",
                PurchaseRequestId = request.PurchaseRequestId,
                SupplierId = supplier!.SupplierId,
                OrderDate = demand.RequestDate,
                Status = "PARTIALLYRECEIVED",
                CreatedBy = UserIdBytes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PurchaseRequest = request,
                Supplier = supplier,
                Purchaseorderlines =
                [
                    new PurchaseOrderLine
                    {
                        PurchaseOrderLineId = GuidHelper.NewId(),
                        PurchaseRequestLineId = line.PurchaseRequestLineId,
                        IngredientId = line.IngredientId,
                        UnitId = line.UnitId,
                        OrderedQty = 10m,
                        ReceivedQty = 5m,
                        UnitPrice = estimatedUnitPrice,
                        PurchaseRequestLine = line,
                        Ingredient = line.Ingredient,
                        Unit = line.Unit
                    }
                ]
            };
            request.Purchaseorders.Add(order);
            context.Purchaseorders.Add(order);
        }

        return request;
    }

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }

        public void Reset() => SelectCount = 0;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static MaterialRequest SeedDemand(
        IpcManagementContext context,
        string status,
        DateOnly serviceDate,
        string scope,
        string? requestCode = null)
    {
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = $"KG-{Guid.NewGuid():N}",
            UnitName = "kg",
            ConvertRateToBase = 1
        };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = $"ING-{Guid.NewGuid():N}",
            IngredientName = requestCode ?? "Ingredient",
            UnitId = unit.UnitId,
            WarehouseId = GuidHelper.NewId(),
            ReferencePrice = 100,
            IsActive = true,
            Unit = unit
        };
        var plan = new ProductionPlan
        {
            PlanId = GuidHelper.NewId(),
            PlanCode = $"PLAN-{Guid.NewGuid():N}",
            PlanDate = serviceDate,
            WeekStartDate = serviceDate.AddDays(-(int)serviceDate.DayOfWeek + 1),
            Status = "FINALIZED",
            CreatedBy = UserIdBytes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var demand = new MaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = requestCode ?? $"MR-{Guid.NewGuid():N}",
            PlanId = plan.PlanId,
            RequestDate = serviceDate,
            RequestScope = scope,
            Status = status,
            CreatedBy = UserIdBytes,
            Plan = plan
        };
        demand.Materialrequestlines.Add(new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = demand.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            TotalRequiredQty = 10,
            SuggestedPurchaseQty = 10,
            Ingredient = ingredient,
            Unit = unit,
            Request = demand
        });
        context.Materialrequests.Add(demand);
        return demand;
    }
}
