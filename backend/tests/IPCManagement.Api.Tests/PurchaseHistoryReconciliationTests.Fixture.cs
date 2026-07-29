using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Middlewares;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MySqlConnector;
using NSubstitute;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api.Tests;

public partial class PurchaseHistoryReconciliationTests
{
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

    private static PurchaseHistorySourceTrace Trace(string field, string rawValue)
        => new(
            "1.Rau",
            42,
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [field] = rawValue
            });

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"purchase-history-preview-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
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

    private static async Task RecreateDisposableDatabaseAsync(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var builder = new MySqlConnectionStringBuilder(DisposableConnectionString(database))
        {
            Database = "mysql"
        };
        await using var connection = new MySqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"DROP DATABASE IF EXISTS `{database}`; " +
                              $"CREATE DATABASE `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
        await command.ExecuteNonQueryAsync();
    }

    private static async Task BootstrapFreshInstallAsync(string database)
    {
        DatabaseClonePolicy.ValidateTransition(DatabaseClonePolicy.TemplateDatabase, database);
        var schema = await File.ReadAllTextAsync(
            FindRepositoryFile("backend", "database", "IPCmanagement.sql"));
        schema.Should().NotContain("successRowCount");
        schema.Should().NotContain("errorRowCount");
        schema.Should().NotContain("warningRowCount");

        // Chốt an toàn: script cài mới không được tự chọn database. Trước 27/07/2026 nó
        // hard-code `USE ipcManagement;` nên chạy với database đích nào cũng xoá sạch
        // database chính. Giữ hai assertion này để lỗ hổng đó không quay lại.
        schema.Should().NotContain("USE ipcManagement;");
        schema.Should().NotContain("CREATE DATABASE IF NOT EXISTS ipcManagement");

        // Hai index dưới đây từng được khai hai lần (KEY trong CREATE TABLE + CREATE INDEX
        // rời), làm script chết với ERROR 1061 nên test cũ phải cắt bỏ chúng trước khi chạy.
        // Bản khai rời đã bị xoá — pin lại để không ai thêm vào nữa, và script nay chạy nguyên vẹn.
        schema.Should().NotContain(
            "CREATE INDEX        ixApprovalHistoriesTarget     ON approvalhistories(targetType, targetId, actionAt);");
        schema.Should().NotContain(
            "CREATE INDEX        IX_approvalassignments_approverUserId ON approvalassignments(approverUserId);");

        await ExecuteSqlScriptAsync(database, schema);
        await ExecuteSqlScriptAsync(
            database,
            await File.ReadAllTextAsync(
                FindRepositoryFile("backend", "database", "Init_EF_History_For_Old_DB.sql")));

        // Baseline IPCmanagement.sql đã chứa sẵn ba thay đổi dưới đây nhưng
        // Init_EF_History_For_Old_DB.sql không ghi ID của chúng. Đánh dấu đúng ba ID đó để mọi
        // migration sau vẫn chạy, và mọi lỗi schema khác vẫn lộ ra thay vì bị che.
        //
        // 20260702061320_AddImportAuditFields TỪNG nằm trong danh sách này nhưng đó là khai sai:
        // baseline KHÔNG có cả 5 cột nó thêm (menuschedules.menuVersionId,
        // mealquantityplanlines.updatedAt, menuversions.{success,error,warning}RowCount). Đánh dấu
        // sẵn khiến migration bị bỏ qua và database cài mới thiếu đúng 5 cột đó. Đã bỏ khỏi danh
        // sách để nó chạy thật. Trước khi thêm bất kỳ ID nào vào đây, phải đối chiếu từng
        // AddColumn/CreateTable của migration với baseline.
        await ExecuteSqlScriptAsync(
            database,
            """
            INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES
              ('20260702072352_AddProductionPlanUpdatedAt', '9.0.16'),
              ('20260702124738_AddSupplierQuotations', '9.0.16'),
              ('20260702164531_AddPurchaseOrders', '9.0.16');
            """);
    }

    private static async Task ExecuteSqlScriptAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandTimeout = 120;
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<long> SchemaObjectCountAsync(string database, string sql)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        return Convert.ToInt64(await command.ExecuteScalarAsync());
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

    private static async Task<string> ReceiptHistoryFingerprintAsync(string database)
    {
        await using var connection = new MySqlConnection(DisposableConnectionString(database));
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT payload
            FROM (
                SELECT CONCAT_WS('|',
                    'R', HEX(receiptId), receiptCode, DATE_FORMAT(receiptDate, '%Y-%m-%d'),
                    HEX(warehouseId), HEX(supplierId), COALESCE(HEX(purchaseRequestId), '<NULL>'),
                    HEX(createdBy), DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s.%f')) AS payload,
                    CONCAT('R|', HEX(receiptId)) AS sortKey
                FROM inventoryreceipts
                UNION ALL
                SELECT CONCAT_WS('|',
                    'L', HEX(receiptLineId), HEX(receiptId), COALESCE(HEX(purchaseRequestLineId), '<NULL>'),
                    HEX(ingredientId), HEX(unitId), CAST(quantity AS CHAR), CAST(unitPrice AS CHAR),
                    COALESCE(CAST(amount AS CHAR), '<NULL>'), COALESCE(lotNumber, '<NULL>'),
                    COALESCE(DATE_FORMAT(manufactureDate, '%Y-%m-%d'), '<NULL>'),
                    COALESCE(DATE_FORMAT(expiredDate, '%Y-%m-%d'), '<NULL>')) AS payload,
                    CONCAT('L|', HEX(receiptLineId)) AS sortKey
                FROM inventoryreceiptlines
            ) AS receiptHistory
            ORDER BY sortKey;
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

    private static async Task SeedCatalogAsync(IpcManagementContext context)
    {
        context.Units.Add(new Unit
        {
            UnitId = Id(10),
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = Id(20),
            IngredientCode = "ING-RAU-MUONG",
            IngredientName = "Rau muống",
            UnitId = Id(10),
            WarehouseId = Id(40),
            ReferencePrice = 25_000,
            IsFreshDaily = true,
            IsActive = true
        });
        context.Suppliers.Add(new Supplier
        {
            SupplierId = Id(30),
            SupplierCode = "SUP-RAU",
            SupplierName = "Rau",
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task<InventoryReceiptLine> SeedReceiptAsync(
        IpcManagementContext context,
        string receiptCode,
        DateOnly receiptDate,
        byte[] supplierId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        decimal unitPrice,
        string lotNumber,
        byte[]? purchaseRequestId = null)
    {
        var sequence = context.Inventoryreceipts.Local.Count + 50;
        var receipt = new InventoryReceipt
        {
            ReceiptId = Id(sequence),
            ReceiptCode = receiptCode,
            ReceiptDate = receiptDate,
            WarehouseId = Id(40),
            SupplierId = supplierId,
            PurchaseRequestId = purchaseRequestId,
            CreatedBy = Id(41),
            CreatedAt = new DateTime(2026, 7, 20)
        };
        var line = new InventoryReceiptLine
        {
            ReceiptLineId = Id(sequence + 20),
            ReceiptId = receipt.ReceiptId,
            IngredientId = ingredientId,
            UnitId = unitId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            Amount = quantity * unitPrice,
            LotNumber = lotNumber
        };
        context.Inventoryreceipts.Add(receipt);
        context.Inventoryreceiptlines.Add(line);
        await context.SaveChangesAsync();
        return line;
    }

    private static PurchaseHistoryReconciliationService CreatePreviewService(
        IpcManagementContext context,
        params PurchaseHistorySourceCandidate[] candidates)
        => CreatePreviewService(
            context,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidates);

    private static PurchaseHistoryReconciliationService CreatePreviewService(
        IpcManagementContext context,
        string sourceHash,
        DateOnly asOfDate,
        string policyVersion,
        params PurchaseHistorySourceCandidate[] candidates)
        => new(
            context,
            () => new PurchaseHistoryPreviewSource(
                "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx",
                new PurchaseHistoryParseResult(
                    sourceHash,
                    asOfDate,
                    1,
                    1,
                    1,
                    candidates),
                policyVersion));

    private static PurchaseHistoryReconciliationService CreateApplyService(
        IpcManagementContext context,
        string databaseIdentity,
        params PurchaseHistorySourceCandidate[] candidates)
        => CreateApplyService(
            context,
            databaseIdentity,
            new string('A', 64),
            new DateOnly(2026, 7, 20),
            PurchaseHistoryPolicyVersion.Current,
            candidates);

    private static PurchaseHistoryReconciliationService CreateApplyService(
        IpcManagementContext context,
        string databaseIdentity,
        string sourceHash,
        DateOnly asOfDate,
        string policyVersion,
        params PurchaseHistorySourceCandidate[] candidates)
        => new(
            context,
            () => new PurchaseHistoryPreviewSource(
                "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx",
                new PurchaseHistoryParseResult(
                    sourceHash,
                    asOfDate,
                    1,
                    1,
                    1,
                    candidates),
                policyVersion),
            () => databaseIdentity,
            () => new PurchaseHistoryApplySafetyEvidence(
                "wave0-ipc_lane1-to-ipc_e2e_template-20260722",
                new string('C', 64),
                new string('C', 64)));

    private static PurchaseHistoryReconciliationService CreateApplyServiceWithFailure(
        IpcManagementContext context,
        int failureIndex,
        params PurchaseHistorySourceCandidate[] candidates)
        => new(
            context,
            () => new PurchaseHistoryPreviewSource(
                "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx",
                new PurchaseHistoryParseResult(
                    new string('A', 64),
                    new DateOnly(2026, 7, 20),
                    1,
                    1,
                    1,
                    candidates)),
            () => "ipc_lane1",
            () => new PurchaseHistoryApplySafetyEvidence(
                "wave0-ipc_lane1-to-ipc_e2e_template-20260722",
                new string('C', 64),
                new string('C', 64)),
            (index, _) => index == failureIndex
                ? new InvalidOperationException($"Injected action failure at boundary {index}.")
                : null);

    private static PurchaseHistoryApplyRequest AcceptedApplyRequest(PurchaseHistoryPreviewDto preview)
        => new()
        {
            ManifestId = preview.Manifest.ManifestId,
            ManifestHash = preview.Manifest.ManifestHash,
            AcceptedActionIds = preview.Actions.Select(action => action.ActionId).ToList(),
            BackupRestoreEvidence = new BackupRestoreEvidenceRequest
            {
                BackupIdentifier = "wave0-ipc_lane1-to-ipc_e2e_template-20260722",
                TargetFingerprint = new string('C', 64),
                RestoreFingerprint = new string('C', 64),
                RestoreVerified = true
            }
        };

    private static PurchaseHistoryApplyRequest EndpointApplyRequest()
        => new()
        {
            ManifestId = "manifest-1",
            ManifestHash = new string('C', 64),
            AcceptedActionIds = ["action-1"],
            BackupRestoreEvidence = new BackupRestoreEvidenceRequest
            {
                BackupIdentifier = "wave0-ipc_lane1-to-ipc_e2e_template-20260722",
                TargetFingerprint = new string('D', 64),
                RestoreFingerprint = new string('D', 64),
                RestoreVerified = true
            }
        };

    private static PurchaseHistorySourceCandidate Candidate(
        string sheet,
        int row,
        string supplier,
        string ingredient,
        string unit,
        DateOnly date,
        decimal quantity,
        decimal unitPrice)
    {
        var sourceKey = $"{sheet}|{row}";
        var businessKey = $"{date:yyyy-MM-dd}|{ingredient}";
        return new PurchaseHistorySourceCandidate(
            new string('A', 64),
            supplier,
            ingredient,
            unit,
            date,
            quantity,
            unitPrice,
            sourceKey,
            businessKey,
            new string('B', 64),
            new PurchaseHistorySourceTrace(
                sheet,
                row,
                new Dictionary<string, string>
                {
                    ["Nhà cung cấp"] = supplier,
                    ["Tên hàng"] = ingredient,
                    ["Đơn vị tính"] = unit,
                    ["Ngày Giao hàng"] = date.ToString("yyyy-MM-dd"),
                    ["Số lượng"] = quantity.ToString(),
                    ["Đơn giá"] = unitPrice.ToString()
                }))
        {
            Normalization = new PurchaseHistoryNormalizationResult(
                PurchaseHistoryPolicyVersion.Current,
                supplier,
                ingredient,
                unit,
                new PurchaseHistoryPackageSnapshot(unit, null, null),
                date,
                [])
        };
    }

    private static async Task<(int Suppliers, int Ingredients, int Receipts, int Lines, int Movements)> DatabaseCountsAsync(
        IpcManagementContext context)
        => (
            await context.Suppliers.CountAsync(),
            await context.Ingredients.CountAsync(),
            await context.Inventoryreceipts.CountAsync(),
            await context.Inventoryreceiptlines.CountAsync(),
            await context.Stockmovements.CountAsync());

    private static async Task<(int Suppliers, int Ingredients, int Receipts, int Lines, int Movements, int Runs, int Actions)>
        ApplyDatabaseCountsAsync(IpcManagementContext context)
        => (
            await context.Suppliers.CountAsync(),
            await context.Ingredients.CountAsync(),
            await context.Inventoryreceipts.CountAsync(),
            await context.Inventoryreceiptlines.CountAsync(),
            await context.Stockmovements.CountAsync(),
            await context.Purchasehistoryreconciliationruns.CountAsync(),
            await context.Purchasehistoryreconciliationactions.CountAsync());

    private static async Task<string> ReceiptLineSnapshotAsync(IpcManagementContext context, byte[] receiptLineId)
    {
        var line = await context.Inventoryreceiptlines.AsNoTracking()
            .SingleAsync(item => item.ReceiptLineId == receiptLineId);
        return string.Join('|', new[]
        {
            Convert.ToHexString(line.ReceiptLineId),
            Convert.ToHexString(line.ReceiptId),
            line.PurchaseRequestLineId is null ? string.Empty : Convert.ToHexString(line.PurchaseRequestLineId),
            Convert.ToHexString(line.IngredientId),
            Convert.ToHexString(line.UnitId),
            line.Quantity.ToString(),
            line.UnitPrice.ToString(),
            line.LotNumber ?? string.Empty
        });
    }

    private static byte[] Id(int value)
    {
        var bytes = new byte[16];
        BitConverter.GetBytes(value).CopyTo(bytes, 0);
        return bytes;
    }

    private static async Task<WebApplication> CreatePreviewEndpointAppAsync(
        IPurchaseHistoryReconciliationService reconciliationService,
        string environmentName)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = environmentName
        });
        builder.WebHost.UseTestServer();
        builder.Services
            .AddAuthentication(PreviewTestAuthHandler.AuthScheme)
            .AddScheme<AuthenticationSchemeOptions, PreviewTestAuthHandler>(
                PreviewTestAuthHandler.AuthScheme,
                _ => { });
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.CatalogAccess, policy =>
                policy.RequireAuthenticatedUser().RequireRole(AuthorizationPolicies.CatalogRoles));
        });
        builder.Services.AddSingleton(reconciliationService);
        builder.Services.AddSingleton(Substitute.For<IWeeklyMenuQueryService>());
        builder.Services.AddSingleton(Substitute.For<IWeeklyMenuTemplateService>());
        builder.Services.AddSingleton(Substitute.For<IWeeklyMenuImportService>());
        builder.Services.AddSingleton(Substitute.For<IWeeklyMenuImportHistoryService>());
        builder.Services.AddSingleton(Substitute.For<ICustomerImportMappingService>());
        builder.Services.AddSingleton(Substitute.For<IWeeklyMenuBulkEditService>());
        builder.Services.AddSingleton(Substitute.For<ISampleBomImportService>());
        builder.Services.AddControllers().AddApplicationPart(typeof(SampleDataController).Assembly);

        var app = builder.Build();
        app.UseMiddleware<SampleDataProductionGuardMiddleware>();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();
        return app;
    }

    private sealed class PreviewTestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public const string AuthScheme = "PurchaseHistoryPreviewTest";
        public const string RoleHeader = "X-Test-Role";
        public const string UserHeader = "X-Test-User";

        public PreviewTestAuthHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue(RoleHeader, out var role) || string.IsNullOrWhiteSpace(role))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var userId = Request.Headers.TryGetValue(UserHeader, out var configuredUser) &&
                         !string.IsNullOrWhiteSpace(configuredUser)
                ? configuredUser.ToString()
                : "preview-test-user";
            var identity = new ClaimsIdentity(
                [
                    new Claim(ClaimTypes.NameIdentifier, userId),
                    new Claim(ClaimTypes.Role, role.ToString())
                ],
                AuthScheme);
            var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), AuthScheme);
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }

    private sealed class ApplyFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;

        private ApplyFixture(SqliteConnection connection, IpcManagementContext context)
        {
            _connection = connection;
            Context = context;
        }

        public IpcManagementContext Context { get; }

        public static async Task<ApplyFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IpcManagementContext(options);
            await CreateSchemaAsync(connection);
            await SeedCatalogAsync(connection);
            return new ApplyFixture(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }

        private static async Task SeedCatalogAsync(SqliteConnection connection)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                INSERT INTO units(unitId, unitCode, unitName, baseUnitCode, convertRateToBase)
                VALUES ($unitId, 'KG', 'Kilogram', NULL, 1);
                INSERT INTO warehouses(warehouseId, warehouseCode, warehouseName, warehouseType, note)
                VALUES ($warehouseId, 'WH-TEST', 'Kho test', 'TEST', NULL);
                INSERT INTO ingredients(
                    ingredientId, ingredientCode, ingredientName, unitId, warehouseId,
                    referencePrice, isFreshDaily, isActive)
                VALUES ($ingredientId, 'ING-RAU-MUONG', 'Rau muống', $unitId, $warehouseId, 25000, 1, 1);
                INSERT INTO suppliers(supplierId, supplierCode, supplierName, isActive)
                VALUES ($supplierId, 'SUP-RAU', 'Rau', 1);
                """;
            command.Parameters.AddWithValue("$unitId", Id(10));
            command.Parameters.AddWithValue("$warehouseId", Id(40));
            command.Parameters.AddWithValue("$ingredientId", Id(20));
            command.Parameters.AddWithValue("$supplierId", Id(30));
            await command.ExecuteNonQueryAsync();
        }

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE suppliers (
                    supplierId BLOB PRIMARY KEY, supplierCode TEXT NOT NULL,
                    supplierName TEXT NOT NULL, isActive INTEGER NULL);
                CREATE TABLE units (
                    unitId BLOB PRIMARY KEY, unitCode TEXT NOT NULL, unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL, convertRateToBase NUMERIC NOT NULL);
                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY, warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL, warehouseType TEXT NOT NULL, note TEXT NULL);
                CREATE TABLE ingredients (
                    ingredientId BLOB PRIMARY KEY, ingredientCode TEXT NOT NULL,
                    ingredientName TEXT NOT NULL, unitId BLOB NOT NULL, warehouseId BLOB NOT NULL,
                    referencePrice NUMERIC NOT NULL, isFreshDaily INTEGER NOT NULL, isActive INTEGER NULL);
                CREATE TABLE inventoryreceipts (
                    receiptId BLOB PRIMARY KEY, receiptCode TEXT NOT NULL UNIQUE,
                    receiptDate TEXT NOT NULL, warehouseId BLOB NOT NULL, supplierId BLOB NOT NULL,
                    purchaseRequestId BLOB NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL);
                CREATE TABLE inventoryreceiptlines (
                    receiptLineId BLOB PRIMARY KEY, receiptId BLOB NOT NULL,
                    purchaseRequestLineId BLOB NULL, ingredientId BLOB NOT NULL, unitId BLOB NOT NULL,
                    quantity NUMERIC NOT NULL, unitPrice NUMERIC NOT NULL,
                    amount NUMERIC GENERATED ALWAYS AS (quantity * unitPrice) STORED,
                    packageQuantitySnapshot NUMERIC NULL, packageBaseUnitIdSnapshot BLOB NULL,
                    packagePolicyVersionSnapshot TEXT NULL, lotNumber TEXT NULL,
                    manufactureDate TEXT NULL, expiredDate TEXT NULL);
                CREATE TABLE stockmovements (
                    movementId BLOB PRIMARY KEY, movementDate TEXT NOT NULL, warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL, unitId BLOB NOT NULL, movementType TEXT NOT NULL,
                    refTable TEXT NULL, refId BLOB NULL, quantityIn NUMERIC NOT NULL,
                    quantityOut NUMERIC NOT NULL, beforeQty NUMERIC NOT NULL, afterQty NUMERIC NOT NULL,
                    performedBy BLOB NOT NULL);
                CREATE TABLE currentstock (
                    warehouseId BLOB NOT NULL, ingredientId BLOB NOT NULL, unitId BLOB NOT NULL,
                    currentQty NUMERIC NOT NULL, lastUpdated TEXT NOT NULL,
                    PRIMARY KEY (warehouseId, ingredientId, unitId));
                CREATE TABLE purchasehistoryreconciliationruns (
                    purchaseHistoryReconciliationRunId BLOB PRIMARY KEY, manifestId TEXT NOT NULL,
                    manifestHash TEXT NOT NULL UNIQUE, sourceName TEXT NOT NULL, sourceSha256 TEXT NOT NULL,
                    policyVersion TEXT NOT NULL, asOfDate TEXT NOT NULL, databaseFingerprint TEXT NOT NULL,
                    backupIdentifier TEXT NOT NULL, backupTargetFingerprint TEXT NOT NULL,
                    restoreFingerprint TEXT NOT NULL, restoreVerified INTEGER NOT NULL,
                    appliedBy BLOB NOT NULL, appliedAt TEXT NOT NULL, status TEXT NOT NULL,
                    candidateCount INTEGER NOT NULL, currentUniqueBusinessKeyCount INTEGER NOT NULL,
                    auditedDeltaCount INTEGER NOT NULL, actionCount INTEGER NOT NULL,
                    blockerCount INTEGER NOT NULL, keepCount INTEGER NOT NULL, versionCount INTEGER NOT NULL,
                    deactivateCount INTEGER NOT NULL, deleteCount INTEGER NOT NULL, blockCount INTEGER NOT NULL);
                CREATE TABLE purchasehistoryreconciliationactions (
                    purchaseHistoryReconciliationActionId BLOB PRIMARY KEY,
                    purchaseHistoryReconciliationRunId BLOB NOT NULL, actionId TEXT NOT NULL,
                    actionType TEXT NOT NULL, sourceKey TEXT NOT NULL, sourceSheet TEXT NULL,
                    sourceRow INTEGER NULL, businessKey TEXT NULL, targetType TEXT NOT NULL,
                    targetId TEXT NOT NULL, reasonCode TEXT NOT NULL, beforeEvidence TEXT NOT NULL,
                    beforeHash TEXT NOT NULL, afterEvidence TEXT NOT NULL, afterHash TEXT NOT NULL,
                    actionHash TEXT NOT NULL, createdAt TEXT NOT NULL,
                    UNIQUE(purchaseHistoryReconciliationRunId, actionId));
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
