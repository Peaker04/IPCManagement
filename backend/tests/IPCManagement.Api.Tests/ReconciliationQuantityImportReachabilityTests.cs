using System.IO.Compression;
using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationQuantityImportReachabilityTests
{
    private static readonly DateOnly Week = new(2026, 9, 7);

    [Fact]
    public async Task Production_controllers_create_distinct_authorities_and_exact_replay_is_idempotent()
    {
        await using var firstFixture = await Fixture.CreateAsync();
        await using var secondFixture = await Fixture.CreateAsync();
        var firstBefore = await firstFixture.InventoryAsync();
        var secondBefore = await secondFixture.InventoryAsync();

        var first = await firstFixture.CreateCanonicalSourceAsync("ANV", 120);
        var second = await secondFixture.CreateCanonicalSourceAsync("AMANN", 140);

        Assert.NotEqual(first.QuantityPreview.ContentFingerprint, second.QuantityPreview.ContentFingerprint);
        Assert.NotEqual(first.Commit.ImportBatchId, second.Commit.ImportBatchId);
        Assert.NotEqual(first.Commit.ReconciliationBatchId, second.Commit.ReconciliationBatchId);

        var replay = Payload<QuantityImportCommitDto>(await firstFixture.ReconciliationController.CommitQuantityImport(
            new(first.QuantityPreview.Token, first.QuantityPreview.ContentFingerprint, first.SourceLabel), default));
        Assert.True(replay.IdempotentReplay);
        Assert.Equal(first.Commit.ImportBatchId, replay.ImportBatchId);
        Assert.Equal(first.Commit.ReconciliationBatchId, replay.ReconciliationBatchId);

        Assert.Single(await firstFixture.Context.Reconciliationbatches.AsNoTracking().ToListAsync());
        Assert.Single(await secondFixture.Context.Reconciliationbatches.AsNoTracking().ToListAsync());
        Assert.NotEmpty(await firstFixture.Context.Reconciliationbatchlines.AsNoTracking().ToListAsync());
        Assert.NotEmpty(await firstFixture.Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync());
        Assert.Equal(firstBefore, await firstFixture.InventoryAsync());
        Assert.Equal(secondBefore, await secondFixture.InventoryAsync());
    }

    [Fact]
    public async Task Preview_conflict_and_failed_workbook_transaction_leave_authority_and_inventory_unchanged()
    {
        await using var fixture = await Fixture.CreateAsync();
        var before = await fixture.InventoryAsync();

        var failedFile = FormFile("broken.xlsx", "PK-not-a-valid-xlsx"u8.ToArray());
        var failed = await fixture.WeeklyMenuController.CommitWeeklyMenuImportAsync(
            failedFile, fixture.CustomerIdString, Week.ToString("yyyy-MM-dd"), 25000m, "invalid-ticket", default);
        Assert.IsType<BadRequestObjectResult>(failed);
        await fixture.AssertNoReconciliationAuthorityAsync();
        Assert.Equal(before, await fixture.InventoryAsync());

        var source = await fixture.CreateCanonicalSourceAsync("ANV", 120, commitQuantity: false);
        Assert.Empty(fixture.Context.Quantityimportbatches);
        Assert.All(fixture.Context.Mealquantityplans, plan => Assert.Null(plan.ImportBatchId));
        Assert.Empty(fixture.Context.Reconciliationbatches);

        var line = await fixture.Context.Mealquantityplanlines.SingleAsync();
        line.FinalServings++;
        await fixture.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => fixture.ReconciliationController.CommitQuantityImport(
            new(source.QuantityPreview.Token, source.QuantityPreview.ContentFingerprint, source.SourceLabel), default));
        await fixture.AssertNoReconciliationAuthorityAsync();
        Assert.Equal(before, await fixture.InventoryAsync());
    }

    [Theory]
    [InlineData(MaterialDefect.NoEligibleBom)]
    [InlineData(MaterialDefect.PartialMissingBom)]
    [InlineData(MaterialDefect.AllSubPrecision)]
    [InlineData(MaterialDefect.MixedSubPrecision)]
    [InlineData(MaterialDefect.InvalidUnitConversion)]
    [InlineData(MaterialDefect.MissingTolerance)]
    public async Task Invalid_material_projection_rolls_back_all_import_link_and_draft_authority(MaterialDefect defect)
    {
        await using var fixture = await Fixture.CreateAsync();
        var before = await fixture.InventoryAsync();

        var error = await Record.ExceptionAsync(() =>
            fixture.CreateCanonicalSourceAsync("INVALID", 120, materialDefect: defect));
        Assert.True(error is InvalidOperationException or BusinessRuleException, error?.ToString());

        await fixture.AssertNoReconciliationAuthorityAsync();
        Assert.Empty(await fixture.Context.Reconciliationbatchlines.AsNoTracking().ToListAsync());
        Assert.Empty(await fixture.Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync());
        Assert.Empty(await fixture.Context.Auditlogs.Where(x => x.BusinessArea == "Reconciliation").ToListAsync());
        Assert.Equal(before, await fixture.InventoryAsync());
    }

    [Fact]
    public void Reachability_suite_source_rejects_prohibited_fixture_authority()
    {
        var source = File.ReadAllText(Path.Combine(RepositoryRoot(),
            "backend", "tests", "IPCManagement.Api.Tests", "ReconciliationQuantityImportReachabilityTests.cs"));
        var prohibitedPatterns = new[]
        {
            @"new\s+" + nameof(QuantityImportBatch) + @"\s*[({]",
            @"new\s+" + nameof(ReconciliationBatch) + @"\s*[({]",
            @"\." + "Import" + "BatchId" + @"\s*=(?!=)"
        };
        Assert.All(prohibitedPatterns, pattern => Assert.DoesNotMatch(new Regex(pattern), source));
    }

    private static T Payload<T>(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<ApiResponse<T>>(ok.Value).Data!;
    }

    private static IFormFile FormFile(string name, byte[] bytes)
        => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name);

    private static string RepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, ".git")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException("Repository root not found.");
    }

    public enum MaterialDefect
    {
        None,
        NoEligibleBom,
        PartialMissingBom,
        AllSubPrecision,
        MixedSubPrecision,
        InvalidUnitConversion,
        MissingTolerance
    }

    private sealed record SourceResult(
        string SourceLabel,
        QuantityImportPreviewDto QuantityPreview,
        QuantityImportCommitDto Commit);

    private sealed record InventoryCounts(
        int PurchaseRequests,
        int PurchaseOrders,
        int Receipts,
        int Issues,
        int Movements,
        int Lots,
        int Snapshots,
        int CurrentStock);

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        private readonly MemoryCache cache;
        public IpcManagementContext Context { get; }
        public WeeklyMenuImportsController WeeklyMenuController { get; }
        public MenuSchedulesController MenuSchedulesController { get; }
        public MealQuantityPlansController MealQuantityPlansController { get; }
        public ReconciliationBatchesController ReconciliationController { get; }
        public string CustomerIdString { get; }
        private string UserIdString { get; }

        private Fixture(
            SqliteConnection connection,
            MemoryCache cache,
            IpcManagementContext context,
            WeeklyMenuImportsController weeklyMenuController,
            MenuSchedulesController menuSchedulesController,
            MealQuantityPlansController mealQuantityPlansController,
            ReconciliationBatchesController reconciliationController,
            string customerIdString,
            string userIdString)
        {
            this.connection = connection;
            this.cache = cache;
            Context = context;
            WeeklyMenuController = weeklyMenuController;
            MenuSchedulesController = menuSchedulesController;
            MealQuantityPlansController = mealQuantityPlansController;
            ReconciliationController = reconciliationController;
            CustomerIdString = customerIdString;
            UserIdString = userIdString;
        }

        public static async Task<Fixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new ReachabilityContext(options);
            await context.Database.EnsureCreatedAsync();
            await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");

            var roleId = GuidHelper.NewId();
            var userId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            context.AddRange(
                new Role { RoleId = roleId, RoleCode = "COORDINATION", RoleName = "Coordination" },
                new User { UserId = userId, RoleId = roleId, Username = "reachability", FullName = "Reachability", PasswordHash = "hash", IsActive = true, CreatedAt = DateTime.UtcNow },
                new Customer { CustomerId = customerId, CustomerCode = "SCOPE", CustomerName = "Reachability Scope", IsActive = true });
            await context.SaveChangesAsync();

            var cache = new MemoryCache(new MemoryCacheOptions());
            var currentUser = new StubCurrentUser(GuidHelper.ToGuidString(userId));
            var transactionRunner = new ReachabilityTransactionRunner(new EfTransactionRunner(context));
            var ticketStore = new WeeklyMenuImportPreviewTicketStore(cache);
            var resultBuilder = new WeeklyMenuImportResultBuilder(context);
            var importService = new WeeklyMenuImportService(
                context,
                new WeeklyMenuCustomerResolver(context),
                resultBuilder,
                new WeeklyMenuImportPersistence(context, resultBuilder, new WeeklyMenuAuditActorResolver(context)),
                ticketStore,
                transactionRunner,
                cache);
            var weeklyController = new WeeklyMenuImportsController(null!, null!, importService, null!, null!, null!, null!, currentUser)
            {
                ControllerContext = ControllerContext()
            };
            var scheduleController = new MenuSchedulesController(new MenuScheduleService(context, transactionRunner), currentUser)
            {
                ControllerContext = ControllerContext()
            };
            var quantityController = new MealQuantityPlansController(new MealQuantityPlanService(context, transactionRunner), currentUser)
            {
                ControllerContext = ControllerContext()
            };
            var requestContext = new SystemOperationRequestContext
            {
                OperationKey = "reconciliation.quantity-import.commit",
                ExpectedModeVersion = 1,
                Disposition = OperationDisposition.Retained
            };
            var batchService = new ReconciliationBatchService(context, transactionRunner, requestContext);
            var reconciliationController = new ReconciliationBatchesController(
                batchService,
                null!,
                new ReconciliationQuantityImportService(context, transactionRunner, requestContext, cache, batchService),
                currentUser)
            {
                ControllerContext = ControllerContext()
            };

            return new Fixture(connection, cache, context, weeklyController, scheduleController, quantityController,
                reconciliationController, GuidHelper.ToGuidString(customerId), GuidHelper.ToGuidString(userId));
        }

        public async Task<SourceResult> CreateCanonicalSourceAsync(
            string sourceMarker,
            int servings,
            bool commitQuantity = true,
            MaterialDefect materialDefect = MaterialDefect.None)
        {
            var canonicalUnit = new Unit
            {
                UnitId = GuidHelper.NewId(), UnitCode = $"KG-{sourceMarker}", UnitName = "Kilogram",
                BaseUnitCode = "KG", ConvertRateToBase = 1m
            };
            var bomUnit = materialDefect == MaterialDefect.InvalidUnitConversion
                ? new Unit { UnitId = GuidHelper.NewId(), UnitCode = $"G-{sourceMarker}", UnitName = "Gram", BaseUnitCode = "G", ConvertRateToBase = 1m }
                : canonicalUnit;
            Context.Units.Add(canonicalUnit);
            if (!ReferenceEquals(bomUnit, canonicalUnit)) Context.Units.Add(bomUnit);

            foreach (var (name, index) in WorkbookDishNames(sourceMarker).Select((name, index) => (name, index)))
            {
                var dish = new Dish
                {
                    DishId = GuidHelper.NewId(),
                    DishCode = $"REACH-{sourceMarker}-{index:00}",
                    DishName = name,
                    IsActive = true
                };
                var ingredient = new Ingredient
                {
                    IngredientId = GuidHelper.NewId(), IngredientCode = $"ING-{sourceMarker}-{index:00}",
                    IngredientName = $"Ingredient {index}", UnitId = canonicalUnit.UnitId,
                    WarehouseId = GuidHelper.NewId(), ReferencePrice = 1m, IsActive = true, Unit = canonicalUnit
                };
                Context.AddRange(dish, ingredient);
                var omitBom = materialDefect == MaterialDefect.NoEligibleBom;
                if (!omitBom)
                {
                    Context.Dishboms.Add(new DishBom
                    {
                        BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish,
                        IngredientId = ingredient.IngredientId, Ingredient = ingredient,
                        UnitId = bomUnit.UnitId, Unit = bomUnit,
                        GrossQtyPerServing = materialDefect == MaterialDefect.AllSubPrecision ? 0.000000001m : 0.1m,
                        PriceTierAmount = 25000m, BomStatus = "PUBLISHED", EffectiveFrom = Week.AddDays(-1)
                    });
                    if (materialDefect == MaterialDefect.MixedSubPrecision)
                    {
                        var traceIngredient = new Ingredient
                        {
                            IngredientId = GuidHelper.NewId(), IngredientCode = $"ING-{sourceMarker}-TRACE-{index:00}",
                            IngredientName = "Subprecision ingredient", UnitId = canonicalUnit.UnitId,
                            WarehouseId = GuidHelper.NewId(), ReferencePrice = 1m, IsActive = true, Unit = canonicalUnit
                        };
                        Context.Add(traceIngredient);
                        Context.Dishboms.Add(new DishBom
                        {
                            BomId = GuidHelper.NewId(), DishId = dish.DishId, Dish = dish,
                            IngredientId = traceIngredient.IngredientId, Ingredient = traceIngredient,
                            UnitId = canonicalUnit.UnitId, Unit = canonicalUnit, GrossQtyPerServing = 0.000000001m,
                            PriceTierAmount = 25000m, BomStatus = "PUBLISHED", EffectiveFrom = Week.AddDays(-1)
                        });
                    }
                }
            }
            if (materialDefect != MaterialDefect.MissingTolerance)
            {
                Context.Reconciliationtolerances.Add(new ReconciliationTolerance
                {
                    ToleranceId = GuidHelper.NewId(), ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope,
                    Value = ReconciliationToleranceAuthority.SystemDefaultValue,
                    Version = ReconciliationToleranceAuthority.SystemDefaultVersion,
                    CreatedBy = GuidHelper.ParseGuidString(UserIdString)!, CreatedAt = DateTime.UtcNow
                });
            }
            await Context.SaveChangesAsync();
            var workbook = BuildWorkbook(sourceMarker);
            var fileName = $"weekly-menu-{sourceMarker}-{Week:yyyy-MM-dd}.xlsx";
            var preview = Payload<WeeklyMenuImportResultDto>(await WeeklyMenuController.PreviewWeeklyMenuImportAsync(
                FormFile(fileName, workbook), CustomerIdString, Week.ToString("yyyy-MM-dd"), 25000m, default));
            Assert.False(preview.Validation.HasCriticalErrors,
                string.Join(" | ", preview.Validation.Issues.Select(issue => $"{issue.Code}:{issue.Message}")));
            Assert.False(string.IsNullOrWhiteSpace(preview.PreviewToken));

            var committedMenu = Payload<WeeklyMenuImportResultDto>(await WeeklyMenuController.CommitWeeklyMenuImportAsync(
                FormFile(fileName, workbook), CustomerIdString, Week.ToString("yyyy-MM-dd"), 25000m, preview.PreviewToken, default));
            Assert.True(committedMenu.Committed);

            if (materialDefect == MaterialDefect.PartialMissingBom)
            {
                var selectedDishIds = await Context.Menuitems
                    .Where(item => item.Menu.Menuschedules.Any(schedule => schedule.MenuVersionId == GuidHelper.ParseGuidString(committedMenu.MenuVersionId!)))
                    .OrderBy(item => item.DisplayOrder)
                    .Select(item => item.DishId)
                    .Distinct()
                    .ToListAsync();
                Assert.True(selectedDishIds.Count > 1);
                var missingDishIds = selectedDishIds.Take(selectedDishIds.Count - 1).ToList();
                Context.Dishboms.RemoveRange(Context.Dishboms.Where(bom => missingDishIds.Contains(bom.DishId)));
                await Context.SaveChangesAsync();
                Context.ChangeTracker.Clear();
            }

            var schedule = await Context.Menuschedules.OrderBy(item => item.ServiceDate).FirstAsync();
            var published = Payload<MenuScheduleDto>(await MenuSchedulesController.UpdateMenuScheduleVersionAsync(
                GuidHelper.ToGuidString(schedule.MenuScheduleId),
                new UpdateMenuScheduleVersionRequest { Status = "ACTIVE", Reason = "Reachability production path" }));
            Assert.Equal("ACTIVE", published.MenuVersionStatus);

            var quantity = Payload<MealQuantityPlanDto>(await MealQuantityPlansController.UpsertQuickServingsAsync(
                new UpsertQuickServingsRequest
                {
                    CustomerId = CustomerIdString,
                    ServiceDate = schedule.ServiceDate.ToString("yyyy-MM-dd"),
                    ShiftName = schedule.ShiftName,
                    Servings = servings,
                    Complete = true
                }));
            Assert.Equal("COMPLETED", quantity.Status);

            var sourceLabel = $"{sourceMarker}-{committedMenu.SourceChecksum}";
            Assert.False(string.IsNullOrWhiteSpace(committedMenu.MenuVersionId));
            var quantityPreview = Payload<QuantityImportPreviewDto>(await ReconciliationController.PreviewQuantityImport(
                new(committedMenu.MenuVersionId!, sourceLabel), default));
            Assert.NotEmpty(quantityPreview.Plans);
            Assert.NotEmpty(quantityPreview.Plans.SelectMany(plan => plan.Lines).Select(line => line.QuantityPlanLineId));
            Assert.Empty(Context.Quantityimportbatches);
            Assert.All(Context.Mealquantityplans.Where(plan => plan.ImportBatchId == null), plan => Assert.Null(plan.ImportBatchId));

            if (!commitQuantity)
                return new SourceResult(sourceLabel, quantityPreview, null!);

            var commit = Payload<QuantityImportCommitDto>(await ReconciliationController.CommitQuantityImport(
                new(quantityPreview.Token, quantityPreview.ContentFingerprint, sourceLabel), default));
            var readback = Payload<ReconciliationBatchDto>(await ReconciliationController.Get(commit.ReconciliationBatchId, default));
            Assert.Equal("DRAFT", readback.Status);
            Assert.Equal(commit.ImportBatchId, readback.QuantityImportBatchId);
            Assert.NotEmpty(readback.Lines);
            Assert.All(readback.Lines, line =>
            {
                Assert.True(line.RequiredQuantity > 0);
                Assert.True(line.FrozenTolerance >= 0);
            });
            var contributors = await Context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync();
            Assert.NotEmpty(contributors);
            Assert.All(contributors, contributor => Assert.True(contributor.SourceQuantity > 0));
            Assert.Single(await Context.Reconciliationbatches.Where(batch => batch.QuantityImportBatchId != null && batch.QuantityImportBatchId.SequenceEqual(GuidHelper.ParseGuidString(commit.ImportBatchId)!)).ToListAsync());

            var ready = Payload<ReconciliationBatchDto>(await ReconciliationController.Ready(
                commit.ReconciliationBatchId, new ReadyReconciliationBatchRequest(readback.Version), default));
            Assert.Equal("READY", ready.Status);
            return new SourceResult(sourceLabel, quantityPreview, commit);
        }

        public async Task AssertNoReconciliationAuthorityAsync()
        {
            Assert.Empty(await Context.Quantityimportbatches.AsNoTracking().ToListAsync());
            Assert.All(await Context.Mealquantityplans.AsNoTracking().ToListAsync(), plan => Assert.Null(plan.ImportBatchId));
            Assert.Empty(await Context.Reconciliationbatches.AsNoTracking().ToListAsync());
        }

        public async Task<InventoryCounts> InventoryAsync() => new(
            await Context.Purchaserequests.CountAsync(),
            await Context.Purchaseorders.CountAsync(),
            await Context.Inventoryreceipts.CountAsync(),
            await Context.Inventoryissues.CountAsync(),
            await Context.Stockmovements.CountAsync(),
            await Context.Currentstocklots.CountAsync(),
            await Context.Stocksnapshots.CountAsync(),
            await Context.Currentstocks.CountAsync());

        public async ValueTask DisposeAsync()
        {
            cache.Dispose();
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }

        private static ControllerContext ControllerContext() => new()
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "reachability")], "test"))
            }
        };
    }

    private sealed class ReachabilityTransactionRunner(IEfTransactionRunner inner) : IEfTransactionRunner
    {
        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion,
            Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded,
            System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);
    }

    private sealed class ReachabilityContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.UseCollation("BINARY");
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var index in entity.GetIndexes())
                    index.SetDatabaseName($"{entity.GetTableName()}_{index.GetDatabaseName()}");
            }
            foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
            {
                if (property.GetColumnType()?.StartsWith("enum(", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetColumnType("TEXT");
                if (property.GetCollation()?.Contains("utf8mb4", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetCollation("BINARY");
                if (property.GetDefaultValueSql()?.Contains("CURRENT_TIMESTAMP(6)", StringComparison.OrdinalIgnoreCase) == true)
                    property.SetDefaultValueSql("CURRENT_TIMESTAMP");
            }
        }
    }

    private sealed class StubCurrentUser(string userId) : ICurrentUserService
    {
        public string? GetUserId(ClaimsPrincipal user) => userId;
        public IReadOnlyList<string> GetRoleNames(ClaimsPrincipal user) => ["COORDINATION"];
        public string? GetWarehouseId(ClaimsPrincipal user) => null;
    }

    private static IReadOnlyList<string> WorkbookDishNames(string marker) =>
    [
        $"Món chính sáng {marker}", $"Món phụ sáng {marker}", $"Rau sáng {marker}", $"Canh sáng {marker}", $"Tráng miệng sáng {marker}",
        $"Món chay sáng {marker}", $"Món phụ chay sáng {marker}", $"Rau chay sáng {marker}", $"Canh chay sáng {marker}", $"Tráng miệng chay sáng {marker}",
        $"Món chính chiều {marker}", $"Món phụ chiều {marker}", $"Rau chiều {marker}", $"Canh chiều {marker}", $"Tráng miệng chiều {marker}",
        $"Món chay chiều {marker}", $"Món phụ chay chiều {marker}", $"Rau chay chiều {marker}", $"Canh chay chiều {marker}", $"Tráng miệng chay chiều {marker}"
    ];

    private static byte[] BuildWorkbook(string marker)
    {
        var builder = typeof(WeeklyMenuTemplateService).Assembly
            .GetType("IPCManagement.Api.Features.SampleData.Services.WeeklyMenuTemplateWorkbookBuilder")!
            .GetMethod("Build", BindingFlags.Public | BindingFlags.Static)!;
        var bytes = (byte[])builder.Invoke(null, [Week, "ANV"])!;
        return PopulateTemplate(bytes, new Dictionary<string, string>
        {
            ["D9"] = $"Món chính sáng {marker}", ["D10"] = $"Món phụ sáng {marker}",
            ["D11"] = $"Rau sáng {marker}", ["D12"] = $"Canh sáng {marker}", ["D13"] = $"Tráng miệng sáng {marker}",
            ["D15"] = $"Món chay sáng {marker}", ["D16"] = $"Món phụ chay sáng {marker}",
            ["D17"] = $"Rau chay sáng {marker}", ["D18"] = $"Canh chay sáng {marker}", ["D19"] = $"Tráng miệng chay sáng {marker}",
            ["D22"] = $"Món chính chiều {marker}", ["D23"] = $"Món phụ chiều {marker}",
            ["D24"] = $"Rau chiều {marker}", ["D25"] = $"Canh chiều {marker}", ["D26"] = $"Tráng miệng chiều {marker}",
            ["D28"] = $"Món chay chiều {marker}", ["D29"] = $"Món phụ chay chiều {marker}",
            ["D30"] = $"Rau chay chiều {marker}", ["D31"] = $"Canh chay chiều {marker}", ["D32"] = $"Tráng miệng chay chiều {marker}"
        });
    }

    private static byte[] PopulateTemplate(byte[] workbookBytes, IReadOnlyDictionary<string, string> valuesByCell)
    {
        using var output = new MemoryStream();
        output.Write(workbookBytes);
        output.Position = 0;
        using (var archive = new ZipArchive(output, ZipArchiveMode.Update, leaveOpen: true))
        {
            const string worksheetPath = "xl/worksheets/sheet1.xml";
            var entry = archive.GetEntry(worksheetPath)!;
            XDocument worksheet;
            using (var stream = entry.Open()) worksheet = XDocument.Load(stream);
            XNamespace spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            foreach (var (cellReference, value) in valuesByCell)
            {
                var cell = worksheet.Descendants(spreadsheet + "c")
                    .Single(candidate => (string?)candidate.Attribute("r") == cellReference);
                cell.SetAttributeValue("t", "inlineStr");
                cell.Elements(spreadsheet + "v").Remove();
                cell.Elements(spreadsheet + "is").Remove();
                cell.Add(new XElement(spreadsheet + "is", new XElement(spreadsheet + "t", value)));
            }
            entry.Delete();
            var replacement = archive.CreateEntry(worksheetPath, CompressionLevel.Optimal);
            using var writer = new StreamWriter(replacement.Open());
            worksheet.Save(writer, SaveOptions.DisableFormatting);
        }
        return output.ToArray();
    }
}
