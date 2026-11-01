using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public sealed class WeeklyMenuImportBatchTests
{
    [Fact]
    public async Task CommitPreparedBatchAsync_Should_RollBackFirstCustomer_ThenRetryOnceWithoutDuplicates()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await CreateSchemaAsync(connection);
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new IpcManagementContext(options);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var ticketStore = new WeeklyMenuImportPreviewTicketStore(cache);
        var persistence = new FailingBatchPersistence(context) { FailSecondCustomer = true };
        var service = CreateService(context, persistence, ticketStore, cache);
        var prepared = CreatePreparedBatch(ticketStore);

        var failed = () => service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);

        await failed.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*CUS-02*Không file nào trong batch được lưu.*");
        await using (var freshAfterFailure = new IpcManagementContext(options))
        {
            (await freshAfterFailure.Menuversions.AsNoTracking().CountAsync()).Should().Be(0);
        }

        persistence.FailSecondCustomer = false;
        persistence.ResetAttempt();
        var retried = await service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);

        retried.Should().HaveCount(2);
        await using (var freshAfterRetry = new IpcManagementContext(options))
        {
            (await freshAfterRetry.Menuversions.AsNoTracking().CountAsync()).Should().Be(2);
        }

        var replay = () => service.CommitPreparedBatchAsync(prepared, null, CancellationToken.None);
        await replay.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Phiên xem trước đã hết hạn hoặc không còn hợp lệ. Vui lòng kiểm tra lại file.");
        await using var freshAfterReplay = new IpcManagementContext(options);
        (await freshAfterReplay.Menuversions.AsNoTracking().CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task Reimport_preview_reports_day_outcomes()
    {
        await using var harness = await ReimportHarness.CreateAsync();

        var preview = await harness.Service.PreviewPreparedAsync(
            harness.Plan(harness.CurrentDishName, harness.ReplacementDishName), harness.Customer, CancellationToken.None);
        var lockedConflict = await harness.Service.PreviewPreparedAsync(
            harness.Plan(harness.ReplacementDishName, harness.CurrentDishName), harness.Customer, CancellationToken.None);

        preview.MrxDayOutcomes.Should().BeEquivalentTo([
            new MrxReimportDayDto(MrxSourceChangeApplierTests.LockedDay, "LOCKED_IDENTICAL"),
            new MrxReimportDayDto(MrxSourceChangeApplierTests.OpenDay, "CHANGED")
        ], options => options.WithStrictOrdering());
        lockedConflict.MrxDayOutcomes.Should().BeEquivalentTo([
            new MrxReimportDayDto(MrxSourceChangeApplierTests.LockedDay, "LOCKED_CONFLICT"),
            new MrxReimportDayDto(MrxSourceChangeApplierTests.OpenDay, "UNCHANGED")
        ], options => options.WithStrictOrdering());
    }

    [Fact]
    public async Task Reimporting_identical_merged_cells_preserves_continuation_slots()
    {
        await using var harness = await ReimportHarness.CreateAsync();
        await harness.AddMergedContinuationAsync();

        var preview = await harness.Service.PreviewPreparedAsync(
            harness.PlanWithMergedContinuations(harness.CurrentDishName, harness.CurrentDishName),
            harness.Customer,
            CancellationToken.None);

        preview.MrxDayOutcomes.Should().BeEquivalentTo([
            new MrxReimportDayDto(MrxSourceChangeApplierTests.LockedDay, "LOCKED_IDENTICAL"),
            new MrxReimportDayDto(MrxSourceChangeApplierTests.OpenDay, "UNCHANGED")
        ], options => options.WithStrictOrdering());
    }

    [Fact]
    public async Task Reimport_with_batch_applies_open_days_only()
    {
        await using var harness = await ReimportHarness.CreateAsync();

        var result = await harness.Service.CommitPreparedSingleAsync(
            harness.Prepared(harness.Plan(harness.CurrentDishName, harness.ReplacementDishName)),
            harness.Scenario.ManagerIdString, ["Quản lý"], CancellationToken.None);

        result.MrxSourceChange!.Status.Should().Be("EXECUTED");
        await using var verify = harness.Scenario.Fixture.CreateContext();
        var latest = await verify.Menuversions.AsNoTracking().OrderByDescending(item => item.VersionNo).FirstAsync();
        var schedules = await verify.Menuschedules.AsNoTracking().Include(item => item.Menu).ThenInclude(item => item.Menuitems)
            .Where(item => item.MenuVersionId == latest.MenuVersionId).ToListAsync();
        schedules.Single(item => item.ServiceDate == MrxSourceChangeApplierTests.LockedDay).Menu.Menuitems.Single().DishId
            .Should().Equal(harness.CurrentDishId);
        schedules.Single(item => item.ServiceDate == MrxSourceChangeApplierTests.OpenDay).Menu.Menuitems.Single().DishId
            .Should().Equal(harness.ReplacementDishId);
        (await verify.Reconciliationsourcerevisions.SingleAsync()).ApplyMode.Should().Be(MrxSourceChangeApplier.ReimportMode);
    }

    [Fact]
    public async Task Reimport_identical_locked_day_is_skipped()
    {
        await using var harness = await ReimportHarness.CreateAsync();

        await harness.Service.CommitPreparedSingleAsync(
            harness.Prepared(harness.Plan(harness.CurrentDishName, harness.ReplacementDishName)),
            harness.Scenario.ManagerIdString, ["Quản lý"], CancellationToken.None);

        await using var verify = harness.Scenario.Fixture.CreateContext();
        (await verify.Reconciliationsourcedeltas.AsNoTracking().ToListAsync())
            .Should().OnlyContain(item => item.ServiceDate == MrxSourceChangeApplierTests.OpenDay);
        (await verify.Reconciliationbatchdailylines.AsNoTracking()
            .SingleAsync(item => item.DailyLineId == harness.Scenario.LockedDaily.DailyLineId)).Version.Should().Be(1);
    }

    [Fact]
    public async Task Reimport_changed_locked_day_is_rejected()
    {
        await using var harness = await ReimportHarness.CreateAsync();
        var beforeVersions = await harness.Scenario.Context.Menuversions.CountAsync();

        var action = () => harness.Service.CommitPreparedSingleAsync(
            harness.Prepared(harness.Plan(harness.ReplacementDishName, harness.CurrentDishName)),
            harness.Scenario.ManagerIdString, ["Quản lý"], CancellationToken.None);

        (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which.Code.Should().Be(MrxErrorCodes.DayLocked);
        harness.Scenario.Context.ChangeTracker.Clear();
        (await harness.Scenario.Context.Menuversions.CountAsync()).Should().Be(beforeVersions);
        (await harness.Scenario.Context.Menuamendments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Coordinator_reimport_creates_pending_request()
    {
        await using var harness = await ReimportHarness.CreateAsync();

        var result = await harness.Service.CommitPreparedSingleAsync(
            harness.Prepared(harness.Plan(harness.CurrentDishName, harness.ReplacementDishName)),
            harness.Scenario.CoordinatorIdString, ["Điều phối"], CancellationToken.None);

        result.MrxSourceChange!.Status.Should().Be("PENDING_REVIEW");
        await using var verify = harness.Scenario.Fixture.CreateContext();
        (await verify.Menuamendments.SingleAsync()).Status.Should().Be("PENDING_REVIEW");
        (await verify.Menuversions.CountAsync()).Should().Be(1);
        (await verify.Reconciliationsourcerevisions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Reimport_keeps_servings()
    {
        await using var harness = await ReimportHarness.CreateAsync();

        await harness.Service.CommitPreparedSingleAsync(
            harness.Prepared(harness.Plan(harness.CurrentDishName, harness.ReplacementDishName)),
            harness.Scenario.ManagerIdString, ["Quản lý"], CancellationToken.None);

        await using var verify = harness.Scenario.Fixture.CreateContext();
        var planLine = await verify.Mealquantityplanlines.AsNoTracking()
            .SingleAsync(item => item.QuantityPlanLineId == harness.Scenario.OpenPlanLine.QuantityPlanLineId);
        planLine.SavoryServings.Should().Be(100);
        planLine.VegetarianServings.Should().Be(0);
        planLine.FinalServings.Should().Be(100);
    }

    private static WeeklyMenuImportService CreateService(
        IpcManagementContext context,
        IWeeklyMenuImportPersistence persistence,
        WeeklyMenuImportPreviewTicketStore ticketStore,
        IMemoryCache cache)
        => new(
            context,
            new WeeklyMenuCustomerResolver(context),
            new WeeklyMenuImportResultBuilder(context),
            persistence,
            ticketStore,
            new EfTransactionRunner(context),
            cache);

    private static IReadOnlyList<PreparedWeeklyMenuImport> CreatePreparedBatch(
        WeeklyMenuImportPreviewTicketStore ticketStore)
    {
        var week = new DateOnly(2026, 8, 3);
        return Enumerable.Range(1, 2).Select(index =>
        {
            var customer = new Customer
            {
                CustomerId = GuidHelper.NewId(),
                CustomerCode = $"CUS-0{index}",
                CustomerName = $"Customer {index}",
                IsActive = true
            };
            var checksum = $"CHECKSUM-{index}";
            var plan = new WeeklyMenuImportPlan(
                $"customer-{index}.xlsx",
                "25000",
                "A",
                week,
                week.AddDays(6),
                1,
                [],
                week)
            {
                SourceChecksum = checksum
            };
            var ticket = ticketStore.Issue(
                checksum,
                GuidHelper.ToGuidString(customer.CustomerId),
                week,
                25000m,
                WeeklyMenuWorkbookParser.ParserVersion);
            return new PreparedWeeklyMenuImport(plan, customer, 25000m, ticket.Token);
        }).ToList();
    }

    private static async Task CreateSchemaAsync(SqliteConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE menuversions (
                menuVersionId BLOB PRIMARY KEY,
                customerId BLOB NOT NULL,
                weekStartDate TEXT NOT NULL,
                versionNo INTEGER NOT NULL,
                status TEXT NOT NULL,
                sourceFileName TEXT NULL,
                sourceChecksum TEXT NULL,
                sourceImportBatch TEXT NULL,
                createdBy BLOB NULL,
                createdAt TEXT NOT NULL,
                publishedBy BLOB NULL,
                publishedAt TEXT NULL,
                updatedAt TEXT NOT NULL,
                successRowCount INTEGER NOT NULL DEFAULT 0,
                errorRowCount INTEGER NOT NULL DEFAULT 0,
                warningRowCount INTEGER NOT NULL DEFAULT 0
            );
            """;
        await command.ExecuteNonQueryAsync();
    }

    private sealed class ReimportHarness : IAsyncDisposable
    {
        private readonly MemoryCache _cache;
        private readonly WeeklyMenuImportPreviewTicketStore _ticketStore;

        private ReimportHarness(
            MrxSourceChangeApplierTests.Scenario scenario,
            Customer customer,
            Dish replacementDish,
            string currentDishName,
            byte[] currentDishId,
            WeeklyMenuImportService service,
            MemoryCache cache,
            WeeklyMenuImportPreviewTicketStore ticketStore)
        {
            Scenario = scenario;
            Customer = customer;
            ReplacementDishId = replacementDish.DishId;
            ReplacementDishName = replacementDish.DishName;
            CurrentDishName = currentDishName;
            CurrentDishId = currentDishId;
            Service = service;
            _cache = cache;
            _ticketStore = ticketStore;
        }

        public MrxSourceChangeApplierTests.Scenario Scenario { get; }
        public Customer Customer { get; }
        public byte[] ReplacementDishId { get; }
        public string ReplacementDishName { get; }
        public string CurrentDishName { get; }
        public byte[] CurrentDishId { get; }
        public WeeklyMenuImportService Service { get; }

        public static async Task<ReimportHarness> CreateAsync()
        {
            var scenario = await MrxSourceChangeApplierTests.Scenario.CreateAsync();
            var currentDishId = scenario.LockedDaily.Contributors.Single().DishId;
            var currentDish = await scenario.Context.Dishes.Include(item => item.Dishboms)
                .SingleAsync(item => item.DishId == currentDishId);
            var replacement = new Dish
            {
                DishId = GuidHelper.NewId(), DishCode = "DISH-REIMPORT", DishName = "Món thay thế import", IsActive = true
            };
            scenario.Context.Dishes.Add(replacement);
            scenario.Context.Dishboms.Add(new DishBom
            {
                BomId = GuidHelper.NewId(), DishId = replacement.DishId, IngredientId = scenario.Fixture.IngredientId,
                UnitId = scenario.Fixture.UnitId, GrossQtyPerServing = 3m, WasteRatePercent = 0,
                BomStatus = "PUBLISHED", EffectiveFrom = MrxSourceChangeApplierTests.LockedDay
            });
            await scenario.Context.SaveChangesAsync();
            var customer = await scenario.Context.Customers.SingleAsync();
            var cache = new MemoryCache(new MemoryCacheOptions());
            var tickets = new WeeklyMenuImportPreviewTicketStore(cache);
            var operationContext = new IPCManagement.Api.Data.Transactions.SystemOperationRequestContext
            {
                Mode = SystemOperationEligibility.MaterialReconciliation,
                OperationKey = "coordination.weekly-menu.import.commit",
                ExpectedModeVersion = 1
            };
            var service = new WeeklyMenuImportService(
                scenario.Context,
                new WeeklyMenuCustomerResolver(scenario.Context),
                new WeeklyMenuImportResultBuilder(scenario.Context),
                new FailingBatchPersistence(scenario.Context),
                tickets,
                new ImmediateTransactionRunner(),
                cache,
                operationContext);
            return new ReimportHarness(scenario, customer, replacement, currentDish.DishName, currentDish.DishId, service, cache, tickets);
        }

        public WeeklyMenuImportPlan Plan(string lockedDishName, string openDishName)
        {
            var plan = new WeeklyMenuImportPlan(
                "reimport.xlsx", "CUS 25k", "C", MrxSourceChangeApplierTests.LockedDay,
                MrxSourceChangeApplierTests.LockedDay.AddDays(6), 2,
                [
                    new WeeklyMenuImportDayColumn("D", MrxSourceChangeApplierTests.LockedDay, "t2", "Thứ hai", 7),
                    new WeeklyMenuImportDayColumn("F", MrxSourceChangeApplierTests.OpenDay, "t4", "Thứ tư", 7)
                ],
                MrxSourceChangeApplierTests.LockedDay)
            {
                SourceChecksum = Guid.NewGuid().ToString("N")
            };
            plan.Items.Add(Item(MrxSourceChangeApplierTests.LockedDay, "t2", "D", lockedDishName));
            plan.Items.Add(Item(MrxSourceChangeApplierTests.OpenDay, "t4", "F", openDishName));
            return plan;
        }

        public WeeklyMenuImportPlan PlanWithMergedContinuations(string lockedDishName, string openDishName)
        {
            var plan = Plan(lockedDishName, openDishName);
            plan.Items.Add(ContinuationItem(MrxSourceChangeApplierTests.LockedDay, "t2", "D", lockedDishName));
            plan.Items.Add(ContinuationItem(MrxSourceChangeApplierTests.OpenDay, "t4", "F", openDishName));
            return plan;
        }

        public async Task AddMergedContinuationAsync()
        {
            var schedules = await Scenario.Context.Menuschedules
                .Include(item => item.Menu)
                    .ThenInclude(menu => menu.Menuitems)
                .Where(item => item.ServiceDate == MrxSourceChangeApplierTests.LockedDay
                    || item.ServiceDate == MrxSourceChangeApplierTests.OpenDay)
                .ToListAsync();
            foreach (var schedule in schedules)
            {
                var main = schedule.Menu.Menuitems.Single(item => item.DishSlot == "savory-main");
                Scenario.Context.Menuitems.Add(new MenuItem
                {
                    MenuItemId = GuidHelper.NewId(), MenuId = schedule.MenuId, DishId = main.DishId,
                    DishSlot = "savory-sub1", DisplayOrder = 2
                });
            }
            await Scenario.Context.SaveChangesAsync();
        }

        public PreparedWeeklyMenuImport Prepared(WeeklyMenuImportPlan plan)
        {
            var ticket = _ticketStore.Issue(
                plan.SourceChecksum!, GuidHelper.ToGuidString(Customer.CustomerId), plan.WeekStartDate,
                25_000m, WeeklyMenuWorkbookParser.ParserVersion);
            return new PreparedWeeklyMenuImport(plan, Customer, 25_000m, ticket.Token);
        }

        private static ParsedWeeklyMenuItem Item(DateOnly date, string dayKey, string column, string dishName) => new()
        {
            SourceOrder = 1, ServiceDate = date, DayKey = dayKey, SourceRowNumber = 9, SourceColumn = column,
            SectionLabel = "MENU MẶN- CA SÁNG", SectionKey = "savory-morning", SourceShift = "MORNING",
            SourceShiftLabel = "Ca sáng", DbShiftName = "MORNING", VariantKey = "savory", VariantLabel = "Mặn",
            Slot = "main", SlotLabel = "Món chính", DishName = dishName
        };

        private static ParsedWeeklyMenuItem ContinuationItem(DateOnly date, string dayKey, string column, string dishName) => new()
        {
            SourceOrder = 2, ServiceDate = date, DayKey = dayKey, SourceRowNumber = 10, SourceColumn = column,
            SectionLabel = "MENU MẶN- CA SÁNG", SectionKey = "savory-morning", SourceShift = "MORNING",
            SourceShiftLabel = "Ca sáng", DbShiftName = "MORNING", VariantKey = "savory", VariantLabel = "Mặn",
            Slot = "sub1", SlotLabel = "Món mặn 2", DishName = dishName, RowSpan = 1, IsMergedContinuation = true
        };

        public async ValueTask DisposeAsync()
        {
            _cache.Dispose();
            await Scenario.DisposeAsync();
        }
    }

    private sealed class FailingBatchPersistence(IpcManagementContext context) : IWeeklyMenuImportPersistence
    {
        private int _customerNumber;
        public bool FailSecondCustomer { get; set; }

        public void ResetAttempt() => _customerNumber = 0;

        public Task<WeeklyMenuImportResultDto> CommitAsync(
            WeeklyMenuImportPlan plan,
            Customer customer,
            decimal priceTierAmount,
            string? actorUserId,
            CancellationToken cancellationToken)
        {
            _customerNumber++;
            if (FailSecondCustomer && _customerNumber == 2)
            {
                throw new BusinessRuleException("Lỗi cưỡng bức ở khách hàng thứ hai.");
            }

            var menuVersionId = GuidHelper.NewId();
            context.Menuversions.Add(new MenuVersion
            {
                MenuVersionId = menuVersionId,
                CustomerId = customer.CustomerId,
                WeekStartDate = plan.WeekStartDate,
                VersionNo = 1,
                Status = "DRAFT",
                SourceFileName = plan.FileName,
                SourceChecksum = plan.SourceChecksum,
                SourceImportBatch = $"BATCH-{customer.CustomerCode}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            return Task.FromResult(new WeeklyMenuImportResultDto
            {
                Committed = true,
                CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
                CustomerCode = customer.CustomerCode,
                MenuVersionId = GuidHelper.ToGuidString(menuVersionId),
                SourceChecksum = plan.SourceChecksum
            });
        }
    }
}
