using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class MealQuantityPlanPolicyTests
{
    private const string BatchExistsMessage = "Tuần này đã có lô đối soát. Vui lòng dùng chức năng Điều chỉnh nguồn.";
    private static readonly DateOnly Week = new(2026, 6, 15);

    [Theory]
    [InlineData("MORNING", "ANV-25K", "QTYK-20260728-M-ANV25K")]
    [InlineData("AFTERNOON", "ANV-25K", "QTYK-20260728-A-ANV25K")]
    [InlineData("MORNING", "---", "QTYK-20260728-M-CUS")]
    public void BuildQuickServingPlanCode_Should_CreateStableSafeCode(
        string shiftName,
        string customerCode,
        string expected)
        => MealQuantityPlanPolicy.BuildQuickServingPlanCode(
                new DateOnly(2026, 7, 28),
                shiftName,
                customerCode)
            .Should()
            .Be(expected);

    [Theory]
    [InlineData(null, 20)]
    [InlineData(280, null)]
    [InlineData(null, null)]
    public async Task Mrx_quick_servings_requires_both_split_values(int? savory, int? vegetarian)
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.MaterialReconciliation);

        var act = () => harness.QuickServingsAsync(savory, vegetarian);

        await act.Should().ThrowAsync<ArgumentException>().WithMessage("*suất mặn*suất chay*");
        (await harness.Context.Mealquantityplanlines.CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData(-1, 20)]
    [InlineData(0, 0)]
    public async Task Mrx_quick_servings_rejects_negative_or_zero_total(int savory, int vegetarian)
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.MaterialReconciliation);

        var act = () => harness.QuickServingsAsync(savory, vegetarian);

        await act.Should().ThrowAsync<ArgumentException>();
        (await harness.Context.Mealquantityplanlines.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Mrx_quick_servings_sets_final_as_sum()
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.MaterialReconciliation);

        await harness.QuickServingsAsync(280, 20, servingsIgnored: 5);

        harness.Context.ChangeTracker.Clear();
        var line = await harness.Context.Mealquantityplanlines.AsNoTracking().SingleAsync();
        line.SavoryServings.Should().Be(280);
        line.VegetarianServings.Should().Be(20);
        line.FinalServings.Should().Be(300);
        line.ForecastServings.Should().Be(300);
    }

    [Fact]
    public async Task Mrx_quick_servings_rejected_when_draft_batch_exists()
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.MaterialReconciliation);
        await harness.AddBatchAsync("DRAFT");

        var act = () => harness.QuickServingsAsync(280, 20);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage(BatchExistsMessage);
        (await harness.Context.Mealquantityplanlines.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Mrx_bulk_update_rejected_when_batch_exists()
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.MaterialReconciliation);
        await harness.AddBatchAsync("DRAFT");
        var dishId = await harness.AddDishAsync();

        var (success, message, _) = await harness.BulkUpdateAsync(dishId);

        success.Should().BeFalse();
        message.Should().Be(BatchExistsMessage);
        harness.Context.ChangeTracker.Clear();
        (await harness.Context.Menuitems.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Default_bulk_update_unaffected_by_draft_batch()
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.Default);
        await harness.AddBatchAsync("DRAFT");
        var dishId = await harness.AddDishAsync();

        var (success, _, _) = await harness.BulkUpdateAsync(dishId);

        success.Should().BeTrue();
    }

    [Fact]
    public async Task Default_quick_servings_unchanged()
    {
        await using var harness = await Harness.CreateAsync(SystemOperationEligibility.Default);

        await harness.QuickServingsAsync(null, null, servingsIgnored: 100);

        harness.Context.ChangeTracker.Clear();
        var line = await harness.Context.Mealquantityplanlines.AsNoTracking().SingleAsync();
        line.FinalServings.Should().Be(100);
        line.ForecastServings.Should().Be(100);
        line.SavoryServings.Should().BeNull();
        line.VegetarianServings.Should().BeNull();
    }

    private sealed class Harness : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly SystemOperationRequestContext _requestContext;
        private readonly byte[] _customerId = GuidHelper.NewId();
        private readonly byte[] _menuVersionId = GuidHelper.NewId();
        private readonly byte[] _userId = GuidHelper.NewId();

        private Harness(SqliteConnection connection, TestContext context, string mode)
        {
            _connection = connection;
            Context = context;
            _requestContext = new SystemOperationRequestContext { Mode = mode };
        }

        public IpcManagementContext Context { get; }

        public static async Task<Harness> CreateAsync(string mode)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
            var context = new TestContext(options);
            await context.Database.EnsureCreatedAsync();
            await context.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys = OFF;");
            var harness = new Harness(connection, context, mode);
            await harness.SeedAsync();
            return harness;
        }

        private async Task SeedAsync()
        {
            var menuId = GuidHelper.NewId();
            Context.Customers.Add(new Customer { CustomerId = _customerId, CustomerCode = "CUS", CustomerName = "Customer", IsActive = true });
            Context.Menus.Add(new Menu { MenuId = menuId, MenuCode = "M1", MenuName = "Menu" });
            Context.Menuversions.Add(new MenuVersion
            {
                MenuVersionId = _menuVersionId, CustomerId = _customerId, WeekStartDate = Week,
                VersionNo = 1, Status = "PUBLISHED", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
            });
            Context.Menuschedules.Add(new MenuSchedule
            {
                MenuScheduleId = GuidHelper.NewId(), CustomerId = _customerId, MenuId = menuId, MenuVersionId = _menuVersionId,
                ServiceDate = Week, WeekStartDate = Week, ShiftName = "MORNING",
                MenuPrice = 25000, BomRatePercent = 100, Status = "DRAFT"
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async Task AddBatchAsync(string status)
        {
            Context.Reconciliationbatches.Add(new ReconciliationBatch
            {
                BatchId = GuidHelper.NewId(), MenuVersionId = _menuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
                Status = status, Version = 1, CreatedBy = _userId, CreatedAt = DateTime.UtcNow
            });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async Task<string> AddDishAsync()
        {
            var dishId = GuidHelper.NewId();
            Context.Dishes.Add(new Dish { DishId = dishId, DishCode = "D1", DishName = "Dish 1", IsActive = true });
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
            return GuidHelper.ToGuidString(dishId);
        }

        public async Task QuickServingsAsync(int? savory, int? vegetarian, int servingsIgnored = 0)
        {
            await MakeScheduleActiveAsync();
            var service = new MealQuantityPlanService(Context, new EfTransactionRunner(Context), _requestContext);
            await service.UpsertQuickServingsAsync(new UpsertQuickServingsRequest
            {
                CustomerId = GuidHelper.ToGuidString(_customerId),
                ServiceDate = Week.ToString("yyyy-MM-dd"),
                ShiftName = "MORNING",
                Servings = servingsIgnored,
                SavoryServings = savory,
                VegetarianServings = vegetarian,
                Complete = false
            }, GuidHelper.ToGuidString(_userId));
        }

        public Task<(bool Success, string Message, List<string> Warnings)> BulkUpdateAsync(string dishId)
        {
            var service = new WeeklyMenuBulkEditService(Context, new EfTransactionRunner(Context), _requestContext);
            return service.BulkUpdateWeeklyMenuAsync(new BulkUpdateWeeklyMenuRequest
            {
                CustomerId = GuidHelper.ToGuidString(_customerId),
                Slots =
                [
                    new WeeklyMenuSlotUpdateRequest
                    {
                        ServiceDate = Week, ShiftName = "Ca sáng", SlotType = "morningSavory", DishId = dishId
                    }
                ]
            }, GuidHelper.ToGuidString(_userId));
        }

        private async Task MakeScheduleActiveAsync()
        {
            var schedule = await Context.Menuschedules.Include(item => item.MenuVersion).SingleAsync();
            schedule.Status = "ACTIVE";
            await Context.SaveChangesAsync();
            Context.ChangeTracker.Clear();
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    private sealed class TestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
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
}
