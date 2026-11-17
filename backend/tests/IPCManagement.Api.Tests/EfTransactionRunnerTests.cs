using FluentAssertions;
using IPCManagement.Api.Data.Transactions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace IPCManagement.Api.Tests;

public sealed class EfTransactionRunnerTests
{
    [Fact]
    public async Task Caught_nested_failure_rolls_back_its_writes_before_outer_command_continues()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var context = new RetryProbeContext(new DbContextOptionsBuilder<RetryProbeContext>().UseSqlite(connection).Options);
        await context.Database.EnsureCreatedAsync();
        var runner = new EfTransactionRunner(context);
        var rejected = Guid.NewGuid();
        var correction = Guid.NewGuid();
        await runner.ExecuteAsync(async token =>
        {
            try
            {
                await runner.ExecuteAsync(async innerToken =>
                {
                    context.Probes.Add(new RetryProbe { Id = rejected });
                    await context.SaveChangesAsync(innerToken);
                    throw new ArgumentException("domain rejected");
                }, _ => Task.FromResult(false));
            }
            catch (ArgumentException)
            {
                context.Probes.Add(new RetryProbe { Id = correction });
                await context.SaveChangesAsync(token);
            }
        }, _ => Task.FromResult(false));
        context.ChangeTracker.Clear();
        (await context.Probes.Select(row => row.Id).ToListAsync()).Should().Equal(correction);
    }
    [Fact]
    public async Task Nested_domain_operation_joins_outer_transaction_without_committing_or_hiding_rollback()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var context = new RetryProbeContext(new DbContextOptionsBuilder<RetryProbeContext>().UseSqlite(connection).Options);
        await context.Database.EnsureCreatedAsync();
        var runner = new EfTransactionRunner(context);
        var id = Guid.NewGuid();
        var execute = () => runner.ExecuteAsync(async token =>
        {
            await runner.ExecuteAsync(async innerToken =>
            {
                context.Probes.Add(new RetryProbe { Id = id });
                await context.SaveChangesAsync(innerToken);
            }, _ => throw new InvalidOperationException("Only the outer transaction verifies commit."));
            throw new ArgumentException("outer rollback");
        }, _ => Task.FromResult(false));
        await execute.Should().ThrowAsync<ArgumentException>().WithMessage("outer rollback");
        context.ChangeTracker.Clear();
        (await context.Probes.CountAsync()).Should().Be(0);
    }
    [Fact]
    public async Task ExecuteAsync_Should_RunOnce_WithoutTransaction_ForInMemoryProvider()
    {
        var options = new DbContextOptionsBuilder<RetryProbeContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        await using var context = new RetryProbeContext(options);
        var runner = new EfTransactionRunner(context);
        var probeId = Guid.NewGuid();

        await runner.ExecuteAsync(
            async cancellationToken =>
            {
                context.Probes.Add(new RetryProbe { Id = probeId });
                await context.SaveChangesAsync(cancellationToken);
            },
            _ => throw new InvalidOperationException("Non-relational execution must not verify a relational commit."));

        (await context.Probes.CountAsync(item => item.Id == probeId)).Should().Be(1);
    }

    [Fact]
    public async Task ExecuteAsync_Should_RetryWithCleanTracking_WithoutDuplicatingDatabaseSideEffect()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = new DbContextOptionsBuilder<RetryProbeContext>()
            .UseSqlite(connection)
            .Options;
        await using var context = new RetryProbeContext(options);
        await context.Database.EnsureCreatedAsync();

        var attempts = 0;
        var probeId = Guid.NewGuid();
        var runner = new EfTransactionRunner(
            context,
            () => new RetryOnceExecutionStrategy(context));

        await runner.ExecuteAsync(
            async cancellationToken =>
            {
                attempts++;
                context.Probes.Add(new RetryProbe { Id = probeId });
                await context.SaveChangesAsync(cancellationToken);

                if (attempts == 1)
                {
                    throw new RetryableProbeException();
                }
            },
            cancellationToken => context.Probes
                .AsNoTracking()
                .AnyAsync(item => item.Id == probeId, cancellationToken));

        attempts.Should().Be(2);
        var persistedCount = await context.Probes.AsNoTracking().CountAsync(item => item.Id == probeId);
        persistedCount.Should().Be(1);
    }

    private sealed class RetryProbeContext(DbContextOptions<RetryProbeContext> options)
        : DbContext(options)
    {
        public DbSet<RetryProbe> Probes => Set<RetryProbe>();
    }

    private sealed class RetryProbe
    {
        public Guid Id { get; init; }
    }

    private sealed class RetryOnceExecutionStrategy(DbContext context)
        : ExecutionStrategy(context, maxRetryCount: 1, maxRetryDelay: TimeSpan.Zero)
    {
        protected override bool ShouldRetryOn(Exception exception)
        {
            return exception is RetryableProbeException;
        }
    }

    private sealed class RetryableProbeException : Exception;
}
