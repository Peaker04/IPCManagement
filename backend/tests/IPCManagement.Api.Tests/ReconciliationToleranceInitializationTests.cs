using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationToleranceInitializationTests
{
    [Fact]
    public async Task Zero_rows_creates_locked_audited_system_default()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new ToleranceTestContext(options);
            var actorId = Guid.NewGuid();

            var result = await CreateInitializer(context).InitializeAsync(actorId.ToString());

            Assert.True(result.Inserted);
            Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultScope, result.ScopeKind);
            Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultValue, result.Value);
            Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultVersion, result.Version);
            Assert.Equal(actorId.ToString(), result.CreatedBy);
            Assert.NotEqual(default, result.CreatedAt);

            var authority = await context.Reconciliationtolerances.AsNoTracking().SingleAsync();
            Assert.Null(authority.ScopeId);
            Assert.Equal(result.Value, authority.Value);
            Assert.Equal(result.Version, authority.Version);
            Assert.Equal(actorId.ToByteArray(), authority.CreatedBy);
            Assert.Equal(result.CreatedAt, authority.CreatedAt);
        });
    }

    [Fact]
    public async Task Rerun_preserves_original_audit_and_is_idempotent()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new ToleranceTestContext(options);
            var initializer = CreateInitializer(context);
            var firstActor = Guid.NewGuid().ToString();

            var first = await initializer.InitializeAsync(firstActor);
            var second = await initializer.InitializeAsync(Guid.NewGuid().ToString());

            Assert.True(first.Inserted);
            Assert.False(second.Inserted);
            Assert.Equal(first, second with { Inserted = true });
            Assert.Equal(1, await context.Reconciliationtolerances.CountAsync());
        });
    }

    [Theory]
    [InlineData(0.4, 1)]
    [InlineData(0.5, 0)]
    [InlineData(0.5, 2)]
    public async Task Drifted_system_default_fails_closed(double value, long version)
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new ToleranceTestContext(options);
            context.Reconciliationtolerances.Add(CreateAuthority((decimal)value, version));
            await context.SaveChangesAsync();

            await Assert.ThrowsAsync<ReconciliationToleranceAuthorityException>(() =>
                CreateInitializer(context).InitializeAsync(Guid.NewGuid().ToString()));

            Assert.Equal(1, await context.Reconciliationtolerances.CountAsync());
        });
    }

    [Fact]
    public void Multiple_system_defaults_fail_closed_before_resolution()
    {
        Assert.Throws<ReconciliationToleranceAuthorityException>(() =>
            ReconciliationToleranceAuthority.ReadSystemDefault([CreateAuthority(), CreateAuthority()]));
    }

    [Fact]
    public async Task Two_relational_initializers_produce_one_winner_and_one_idempotent_loser()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var firstContext = new ToleranceTestContext(options);
            await using var secondContext = new ToleranceTestContext(options);
            var barrier = new Barrier(2);
            var first = new ReconciliationToleranceInitializer(firstContext, new BarrierTransactionRunner(barrier));
            var second = new ReconciliationToleranceInitializer(secondContext, new BarrierTransactionRunner(barrier));

            var results = await Task.WhenAll(
                first.InitializeAsync(Guid.NewGuid().ToString()),
                second.InitializeAsync(Guid.NewGuid().ToString()));

            Assert.All(results, result =>
            {
                Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultScope, result.ScopeKind);
                Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultValue, result.Value);
                Assert.Equal(ReconciliationToleranceAuthority.SystemDefaultVersion, result.Version);
            });
            Assert.Single(results, result => result.Inserted);
            Assert.Single(results, result => !result.Inserted);

            await using var verification = new ToleranceTestContext(options);
            Assert.Single(await verification.Reconciliationtolerances.AsNoTracking().ToListAsync());
        });
    }

    private static ReconciliationToleranceInitializer CreateInitializer(ToleranceTestContext context) =>
        new(context, new ImmediateTransactionRunner());

    private static ReconciliationTolerance CreateAuthority(decimal? value = null, long? version = null) => new()
    {
        ToleranceId = Guid.NewGuid().ToByteArray(),
        ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope,
        ScopeId = null,
        Value = value ?? ReconciliationToleranceAuthority.SystemDefaultValue,
        Version = version ?? ReconciliationToleranceAuthority.SystemDefaultVersion,
        CreatedBy = Guid.NewGuid().ToByteArray(),
        CreatedAt = DateTime.UtcNow
    };

    private static async Task WithDatabaseAsync(Func<DbContextOptions<IpcManagementContext>, Task> test)
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-reconciliation-tolerance-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite($"Data Source={databasePath};Default Timeout=10")
                .Options;
            await using (var setup = new ToleranceTestContext(options))
                await setup.Database.EnsureCreatedAsync();
            await test(options);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
    }

    private sealed class BarrierTransactionRunner(Barrier barrier) : IEfTransactionRunner
    {
        private async Task<TResult> Run<TResult>(Func<CancellationToken, Task<TResult>> operation, CancellationToken token)
        {
            await Task.Run(() => barrier.SignalAndWait(token), token);
            return await operation(token);
        }

        public async Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => await Run(async token => { await operation(token); return true; }, cancellationToken);
        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => Run(operation, cancellationToken);
        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default) => Run(operation, cancellationToken);
    }

    private sealed class ToleranceTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            foreach (var entityType in typeof(ReconciliationTolerance).Assembly.GetTypes().Where(type => type.Namespace == typeof(ReconciliationTolerance).Namespace && type.IsClass && type != typeof(ReconciliationTolerance)))
                modelBuilder.Ignore(entityType);
            modelBuilder.Entity<ReconciliationTolerance>(entity =>
            {
                entity.HasKey(row => row.ToleranceId);
                entity.Property(row => row.SystemDefaultKey)
                    .HasComputedColumnSql("CASE WHEN ScopeKind = 'SYSTEM_DEFAULT' THEN 1 ELSE NULL END", stored: false);
                entity.HasIndex(row => row.SystemDefaultKey).IsUnique();
                entity.Property(row => row.Version).IsConcurrencyToken();
            });
        }
    }
}
