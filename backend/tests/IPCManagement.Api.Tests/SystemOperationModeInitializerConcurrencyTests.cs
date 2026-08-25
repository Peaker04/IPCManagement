using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class SystemOperationModeInitializerConcurrencyTests
{
    [Fact]
    public async Task Two_relational_initializers_return_valid_default_authority_without_server_error()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"ipc-operation-mode-{Guid.NewGuid():N}.db");
        try
        {
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite($"Data Source={databasePath};Default Timeout=10")
                .Options;
            await using (var setup = new OperationModeTestContext(options)) await setup.Database.EnsureCreatedAsync();

            await using var firstContext = new OperationModeTestContext(options);
            await using var secondContext = new OperationModeTestContext(options);
            var barrier = new Barrier(2);
            var first = new SystemOperationModeInitializer(firstContext, new BarrierTransactionRunner(barrier));
            var second = new SystemOperationModeInitializer(secondContext, new BarrierTransactionRunner(barrier));

            var results = await Task.WhenAll(first.InitializeAsync(Guid.NewGuid().ToString()), second.InitializeAsync(Guid.NewGuid().ToString()));

            Assert.All(results, result =>
            {
                Assert.Equal(SystemOperationEligibility.Default, result.Mode);
                Assert.Equal(1, result.Version);
            });
            Assert.Single(results, result => result.Inserted);
            Assert.Single(results, result => !result.Inserted);
            await using var verification = new OperationModeTestContext(options);
            var authority = await verification.Systemoperationmodes.SingleAsync();
            Assert.Equal((byte)1, authority.Id);
            Assert.Equal(SystemOperationEligibility.Default, authority.Mode);
            Assert.Equal(1, authority.Version);
        }
        finally { SqliteConnection.ClearAllPools(); File.Delete(databasePath); }
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
