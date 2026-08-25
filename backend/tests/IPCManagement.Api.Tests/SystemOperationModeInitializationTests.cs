using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class SystemOperationModeInitializationTests
{
    [Fact]
    public async Task Zero_rows_creates_exactly_one_default_authority()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new OperationModeTestContext(options);
            var result = await CreateInitializer(context).InitializeAsync(Guid.NewGuid().ToString());

            Assert.True(result.Inserted);
            Assert.Equal(SystemOperationEligibility.Default, result.Mode);
            Assert.Equal(1, result.Version);

            var authority = await context.Systemoperationmodes.AsNoTracking().SingleAsync();
            Assert.Equal((byte)1, authority.Id);
            Assert.Equal(SystemOperationEligibility.Default, authority.Mode);
            Assert.Equal(1, authority.Version);
        });
    }

    [Fact]
    public async Task Rerun_with_valid_authority_is_idempotent()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new OperationModeTestContext(options);
            var initializer = CreateInitializer(context);
            var actorId = Guid.NewGuid().ToString();

            var first = await initializer.InitializeAsync(actorId);
            var second = await initializer.InitializeAsync(actorId);

            Assert.True(first.Inserted);
            Assert.False(second.Inserted);
            Assert.Equal(first.Mode, second.Mode);
            Assert.Equal(first.Version, second.Version);
            Assert.Equal(1, await context.Systemoperationmodes.CountAsync());
        });
    }

    [Theory]
    [InlineData(2, SystemOperationEligibility.Default, 1)]
    [InlineData(1, "UNKNOWN", 1)]
    [InlineData(1, SystemOperationEligibility.Default, 0)]
    public async Task Invalid_single_authority_fails_closed(byte id, string mode, long version)
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new OperationModeTestContext(options);
            context.Systemoperationmodes.Add(CreateAuthority(id, mode, version));
            await context.SaveChangesAsync();

            await Assert.ThrowsAsync<SystemOperationAuthorityException>(() =>
                CreateInitializer(context).InitializeAsync(Guid.NewGuid().ToString()));

            Assert.Equal(1, await context.Systemoperationmodes.CountAsync());
        });
    }

    [Fact]
    public async Task Multiple_authorities_fail_closed_without_mutation()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var context = new OperationModeTestContext(options);
            context.Systemoperationmodes.AddRange(
                CreateAuthority(1, SystemOperationEligibility.Default, 1),
                CreateAuthority(2, SystemOperationEligibility.MaterialReconciliation, 1));
            await context.SaveChangesAsync();

            await Assert.ThrowsAsync<SystemOperationAuthorityException>(() =>
                CreateInitializer(context).InitializeAsync(Guid.NewGuid().ToString()));

            Assert.Equal(2, await context.Systemoperationmodes.CountAsync());
        });
    }

    [Fact]
    public async Task Two_relational_initializers_produce_one_winner_and_one_idempotent_loser()
    {
        await WithDatabaseAsync(async options =>
        {
            await using var firstContext = new OperationModeTestContext(options);
            await using var secondContext = new OperationModeTestContext(options);
            var barrier = new Barrier(2);
            var first = new SystemOperationModeInitializer(firstContext, new BarrierTransactionRunner(barrier));
            var second = new SystemOperationModeInitializer(secondContext, new BarrierTransactionRunner(barrier));

            var results = await Task.WhenAll(
                first.InitializeAsync(Guid.NewGuid().ToString()),
                second.InitializeAsync(Guid.NewGuid().ToString()));

            Assert.All(results, result =>
            {
                Assert.Equal(SystemOperationEligibility.Default, result.Mode);
                Assert.Equal(1, result.Version);
            });
            Assert.Single(results, result => result.Inserted);
            Assert.Single(results, result => !result.Inserted);

            await using var verification = new OperationModeTestContext(options);
            var authority = await verification.Systemoperationmodes.AsNoTracking().SingleAsync();
            Assert.Equal((byte)1, authority.Id);
            Assert.Equal(SystemOperationEligibility.Default, authority.Mode);
            Assert.Equal(1, authority.Version);
        });
    }

    private static SystemOperationModeInitializer CreateInitializer(OperationModeTestContext context) =>
        new(context, new ImmediateTransactionRunner());

    private static SystemOperationMode CreateAuthority(byte id, string mode, long version) => new()
    {
        Id = id,
        Mode = mode,
        Version = version,
        UpdatedBy = Guid.NewGuid().ToByteArray(),
        UpdatedAt = DateTime.UtcNow,
        Reason = "test"
    };

    private static async Task WithDatabaseAsync(Func<DbContextOptions<IpcManagementContext>, Task> test)
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-operation-mode-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite($"Data Source={databasePath};Default Timeout=10")
                .Options;
            await using (var setup = new OperationModeTestContext(options))
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

    private sealed class OperationModeTestContext(DbContextOptions<IpcManagementContext> options) : IpcManagementContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            foreach (var entityType in typeof(SystemOperationMode).Assembly.GetTypes().Where(type => type.Namespace == typeof(SystemOperationMode).Namespace && type.IsClass && type != typeof(SystemOperationMode)))
                modelBuilder.Ignore(entityType);
            modelBuilder.Entity<SystemOperationMode>(entity =>
            {
                entity.HasKey(row => row.Id);
                entity.Property(row => row.Mode).IsRequired().HasMaxLength(40);
                entity.Property(row => row.Version).IsConcurrencyToken();
            });
        }
    }
}
