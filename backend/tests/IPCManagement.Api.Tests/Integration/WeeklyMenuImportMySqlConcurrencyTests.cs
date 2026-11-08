using System.Data;
using System.Data.Common;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using MySqlConnector;

namespace IPCManagement.Api.Tests.Integration;

public sealed class WeeklyMenuImportMySqlConcurrencyTests
{
    [RequiresMySqlFact]
    public async Task Batch_created_after_preflight_rejects_the_whole_import_inside_transaction()
    {
        await using var fixture = await Fixture.CreateAsync();
        var gate = new BeforeTransactionGate();
        await using var context = fixture.Context(gate);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var import = fixture.Import(context, cache);
        var pending = import.Service.CommitPreparedBatchAsync(import.Items, fixture.ActorId, CancellationToken.None);
        try
        {
            await gate.Entered.Task.WaitAsync(TimeSpan.FromSeconds(30));
            await using var writer = fixture.Context();
            await fixture.CreateBatchAsync(writer);
        }
        finally { gate.Release.TrySetResult(); }

        Func<Task> finish = async () => await pending;
        await finish.Should().ThrowAsync<BusinessRuleException>().WithMessage("Nhóm import chỉ hỗ trợ phạm vi chưa có lô đối soát*");
        await fixture.AssertUnchangedImportAsync();
    }

    [RequiresMySqlFact]
    public async Task In_transaction_scope_read_blocks_a_concurrent_batch_insert_until_import_finishes()
    {
        await using var fixture = await Fixture.CreateAsync();
        var gate = new AdmissionReadGate(fixture.SourceCustomerId);
        await using var context = fixture.Context(gate);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var import = fixture.Import(context, cache);
        var pending = import.Service.CommitPreparedBatchAsync(import.Items, fixture.ActorId, CancellationToken.None);
        IsolationLevel isolation = default;
        Exception? writerError = null;
        try
        {
            isolation = await gate.Entered.Task.WaitAsync(TimeSpan.FromSeconds(30));
            await using var writer = fixture.Context();
            await writer.Database.OpenConnectionAsync();
            await writer.Database.ExecuteSqlRawAsync("SET SESSION innodb_lock_wait_timeout = 1;");
            writerError = await Record.ExceptionAsync(() => fixture.CreateBatchAsync(writer));
        }
        finally { gate.Release.TrySetResult(); }

        Func<Task> finish = async () => await pending;
        await finish.Should().ThrowAsync<BusinessRuleException>().WithMessage("*kế hoạch*COMPLETED*");
        writerError.Should().NotBeNull("the actual concurrent batch insert must encounter the import's range lock");
        writerError!.GetBaseException().Should().BeOfType<MySqlException>().Which.Number.Should().Be(1205);
        isolation.Should().Be(IsolationLevel.Serializable);
        await using var verify = fixture.Context();
        (await verify.Reconciliationbatches.CountAsync(item => item.MenuVersionId == fixture.VersionId)).Should().Be(0);
        var batch = await fixture.CreateBatchAsync(verify);
        batch.Lines.Sum(item => item.RequiredQuantity).Should().Be(200m);
        await fixture.AssertUnchangedImportAsync();
    }

    private sealed class BeforeTransactionGate : DbTransactionInterceptor
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
            DbConnection connection, TransactionStartingEventData eventData, InterceptionResult<DbTransaction> result,
            CancellationToken cancellationToken = default)
        {
            Entered.TrySetResult();
            await Release.Task.WaitAsync(TimeSpan.FromSeconds(30), cancellationToken);
            return result;
        }
    }

    private sealed class AdmissionReadGate(byte[] customerId) : DbCommandInterceptor
    {
        private int _entered;
        public TaskCompletionSource<IsolationLevel> Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData,
            DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.Transaction is not null
                && command.CommandText.Contains("reconciliationbatches", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("menuversions", StringComparison.OrdinalIgnoreCase)
                && command.Parameters.Cast<DbParameter>().Any(parameter => parameter.Value is byte[] id && id.SequenceEqual(customerId))
                && Interlocked.CompareExchange(ref _entered, 1, 0) == 0)
            {
                Entered.TrySetResult(command.Transaction.IsolationLevel);
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(30), cancellationToken);
            }
            return result;
        }
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly string _connection;
        private readonly byte[] _actor;
        private readonly long _modeVersion;
        private readonly byte[] _importId = GuidHelper.NewId();
        private readonly byte[] _dishId = GuidHelper.NewId();
        private readonly string _suffix = Guid.NewGuid().ToString("N")[..10];
        private readonly DateOnly _week = new(2026, 10, 12);
        private readonly Customer _source = new() { CustomerId = GuidHelper.NewId(), IsActive = true };
        private readonly Customer _fresh = new() { CustomerId = GuidHelper.NewId(), IsActive = true };
        public byte[] VersionId { get; } = GuidHelper.NewId();
        public byte[] SourceCustomerId => _source.CustomerId;
        public string ActorId => GuidHelper.ToGuidString(_actor);

        private Fixture(string connection, byte[] actor, long modeVersion)
        { _connection = connection; _actor = actor; _modeVersion = modeVersion; }

        public IpcManagementContext Context(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(_connection, new MySqlServerVersion(new Version(9, 5, 0)))
            .AddInterceptors(interceptors).Options);

        public static async Task<Fixture> CreateAsync()
        {
            var configured = Environment.GetEnvironmentVariable("IPC_TEST_CONNECTION_STRING")
                ?? throw new InvalidOperationException("A run-owned MySQL clone is required.");
            var builder = new MySqlConnectionStringBuilder(configured);
            var runId = Environment.GetEnvironmentVariable("MRX_EVIDENCE_RUN_ID");
            if (string.IsNullOrWhiteSpace(runId) || !System.Text.RegularExpressions.Regex.IsMatch(runId, "^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$")
                || builder.Database != $"ipc_mrx_evidence_{runId}")
                throw new InvalidOperationException("Refusing fixtures outside the exact run-owned evidence clone.");
            await using var context = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>()
                .UseMySql(builder.ConnectionString, new MySqlServerVersion(new Version(9, 5, 0))).Options);
            var mode = await new SystemOperationModeGuard(context).ReadRequiredAsync();
            mode.Mode.Should().Be(SystemOperationEligibility.MaterialReconciliation);
            var actor = await context.Users.Where(item => item.IsActive == true && item.Role.RoleCode == "ADMIN").Select(item => item.UserId).FirstAsync();
            var fixture = new Fixture(builder.ConnectionString, actor, mode.Version);
            await fixture.SeedAsync(context);
            return fixture;
        }

        private async Task SeedAsync(IpcManagementContext context)
        {
            var unit = await context.Units.SingleAsync(item => item.UnitCode == "KG");
            var warehouse = await context.Warehouses.FirstAsync(item => item.IsOperationalActive);
            _source.CustomerCode = "MS" + _suffix; _source.CustomerName = "Declared menu race source " + _suffix;
            _fresh.CustomerCode = "MF" + _suffix; _fresh.CustomerName = "Declared menu race fresh " + _suffix;
            context.Customers.AddRange(_source, _fresh);
            await CustomerWeekMenuTierInvariant.RequireAsync(context, _source.CustomerId, _week, 25000);
            await context.SaveChangesAsync();
            var ingredient = new Ingredient { IngredientId = GuidHelper.NewId(), IngredientCode = "MI" + _suffix,
                IngredientName = "Declared menu race ingredient " + _suffix, UnitId = unit.UnitId, WarehouseId = warehouse.WarehouseId, IsActive = true };
            var dish = new Dish { DishId = _dishId, DishCode = "MD" + _suffix, DishName = "Declared menu race dish " + _suffix, IsActive = true };
            context.Ingredients.Add(ingredient); context.Dishes.Add(dish);
            context.Dishboms.Add(new DishBom { BomId = GuidHelper.NewId(), DishId = _dishId, IngredientId = ingredient.IngredientId,
                UnitId = unit.UnitId, PriceTierAmount = 25000, GrossQtyPerServing = 2, WasteRatePercent = 0, BomStatus = "PUBLISHED", EffectiveFrom = _week });
            context.Menuversions.Add(new MenuVersion { MenuVersionId = VersionId, CustomerId = _source.CustomerId,
                WeekStartDate = _week, VersionNo = 1, Status = "PUBLISHED", CreatedBy = _actor, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow });
            var menu = new Menu { MenuId = GuidHelper.NewId(), MenuCode = "MM" + _suffix, MenuName = "Declared menu race", IsActive = true };
            var schedule = new MenuSchedule { MenuScheduleId = GuidHelper.NewId(), CustomerId = _source.CustomerId, MenuId = menu.MenuId,
                MenuVersionId = VersionId, WeekStartDate = _week, ServiceDate = _week, ShiftName = "MORNING", MenuPrice = 25000, BomRatePercent = 100, Status = "ACTIVE" };
            context.Menus.Add(menu); context.Menuschedules.Add(schedule);
            context.Menuitems.Add(new MenuItem { MenuItemId = GuidHelper.NewId(), MenuId = menu.MenuId, DishId = _dishId, DisplayOrder = 1, DishSlot = "savory-main" });
            context.Quantityimportbatches.Add(new QuantityImportBatch { ImportBatchId = _importId, BatchCode = "MQ" + _suffix,
                SourceType = "EXCEL", ImportedBy = _actor, ImportedAt = DateTime.UtcNow, Status = "CONFIRMED", MenuVersionId = VersionId,
                ContentFingerprint = "declared-menu-race-" + _suffix, FingerprintFormatVersion = ReconciliationQuantityImportService.CurrentFingerprintFormatVersion, SourceLabel = "Declared menu race" });
            var quantity = new MealQuantityPlan { QuantityPlanId = GuidHelper.NewId(), PlanCode = "MP" + _suffix, ImportBatchId = _importId,
                ServiceDate = _week, Status = "COMPLETED", ConfirmationTime = new TimeOnly(9, 0), ConfirmedBy = _actor };
            context.Mealquantityplans.Add(quantity);
            context.Mealquantityplanlines.Add(new MealQuantityPlanLine { QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = quantity.QuantityPlanId,
                MenuScheduleId = schedule.MenuScheduleId, CustomerId = _source.CustomerId, MenuId = menu.MenuId, ShiftName = "MORNING",
                ForecastServings = 100, ConfirmedServings = 100, FinalServings = 100, SavoryServings = 100, VegetarianServings = 0 });
            await context.SaveChangesAsync();
        }

        private SystemOperationRequestContext Operation(string key) => new() { Mode = SystemOperationEligibility.MaterialReconciliation,
            ExpectedModeVersion = _modeVersion, OperationKey = key, Disposition = OperationDisposition.ReconciliationOnly };

        public async Task<ReconciliationBatchDto> CreateBatchAsync(IpcManagementContext context)
        {
            var operation = Operation("reconciliation.batches.create");
            var service = new ReconciliationBatchService(context, new EfTransactionRunner(context, operation, new SystemOperationModeGuard(context)), operation);
            return await service.CreateDraftAsync(new CreateReconciliationDraftRequest(GuidHelper.ToGuidString(VersionId), GuidHelper.ToGuidString(_importId)), ActorId);
        }

        public (WeeklyMenuImportService Service, PreparedWeeklyMenuImport[] Items) Import(IpcManagementContext context, IMemoryCache cache)
        {
            var operation = Operation("coordination.weekly-menu.import.commit");
            var builder = new WeeklyMenuImportResultBuilder(context);
            var tickets = new WeeklyMenuImportPreviewTicketStore(cache);
            var service = new WeeklyMenuImportService(context, new WeeklyMenuCustomerResolver(context), builder,
                new WeeklyMenuImportPersistence(context, builder, new WeeklyMenuAuditActorResolver(context)), tickets,
                new EfTransactionRunner(context, operation, new SystemOperationModeGuard(context)), cache, operation);
            PreparedWeeklyMenuImport Prepared(Customer customer)
            {
                var plan = new WeeklyMenuImportPlan("declared-race.xlsx", "25k", "C", _week, _week.AddDays(6), 1, [], _week)
                { SourceChecksum = "declared-race-" + _suffix + customer.CustomerCode };
                plan.Items.Add(new ParsedWeeklyMenuItem { SourceOrder = 1, ServiceDate = _week, DayKey = "t2", SourceRowNumber = 9,
                    SourceColumn = "D", SectionLabel = "MENU MẶN- CA SÁNG", SectionKey = "savory-morning", SourceShift = "MORNING",
                    SourceShiftLabel = "Ca sáng", DbShiftName = "MORNING", VariantKey = "savory", VariantLabel = "Mặn", Slot = "main", SlotLabel = "Món chính",
                    DishName = "Declared menu race dish " + _suffix, DishId = GuidHelper.ToGuidString(_dishId), ExistingDish = true });
                var ticket = tickets.Issue(plan.SourceChecksum, GuidHelper.ToGuidString(customer.CustomerId), _week, 25000, WeeklyMenuWorkbookParser.ParserVersion);
                return new PreparedWeeklyMenuImport(plan, customer, 25000, ticket.Token);
            }
            return (service, [Prepared(_fresh), Prepared(_source)]);
        }

        public async Task AssertUnchangedImportAsync()
        {
            await using var verify = Context();
            (await verify.Menuversions.CountAsync(item => item.CustomerId == _fresh.CustomerId)).Should().Be(0);
            (await verify.Menuschedules.CountAsync(item => item.CustomerId == _fresh.CustomerId)).Should().Be(0);
            (await verify.Menuversions.CountAsync(item => item.CustomerId == _source.CustomerId)).Should().Be(1);
            (await verify.Menuschedules.Where(item => item.CustomerId == _source.CustomerId).Select(item => item.MenuPrice).ToListAsync()).Should().Equal(25000m);
            (await verify.Reconciliationsourcerevisions.CountAsync(item => item.Batch.MenuVersionId == VersionId)).Should().Be(0);
        }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
