using IPCManagement.Api.Data;
using IPCManagement.Api.HealthChecks;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.LifecycleOutbox;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace IPCManagement.Api.Tests;

public sealed class LifecycleOutboxProcessorTests
{
    [Fact]
    public async Task ProcessBatchAsync_ValidPayload_PersistsDeliveryAndProcessesMessage()
    {
        await using var fixture = await Fixture.CreateAsync();
        var message = fixture.AddMessage(sequence: 1);
        await fixture.Context.SaveChangesAsync();

        var processed = await fixture.CreateProcessor().ProcessBatchAsync();

        Assert.Equal(1, processed);
        var persisted = await fixture.Context.Lifecycleoutboxmessages.SingleAsync();
        Assert.Equal("PROCESSED", persisted.Status);
        Assert.Equal(1, persisted.AttemptCount);
        Assert.NotNull(persisted.ProcessedAt);
        Assert.Single(await fixture.Context.Lifecycleoutboxdeliveries.ToListAsync());
        Assert.True((await fixture.Context.Lifecycleoutboxdeliveries.SingleAsync()).OutboxMessageId.SequenceEqual(message.OutboxMessageId));
    }

    [Fact]
    public async Task ProcessBatchAsync_FailedEarlierSequence_BlocksLaterAggregateMessage()
    {
        await using var fixture = await Fixture.CreateAsync(new ThrowingConsumer());
        fixture.AddMessage(sequence: 1);
        fixture.AddMessage(sequence: 2);
        await fixture.Context.SaveChangesAsync();

        var processed = await fixture.CreateProcessor().ProcessBatchAsync();

        Assert.Equal(0, processed);
        var messages = await fixture.Context.Lifecycleoutboxmessages.OrderBy(item => item.AggregateSequence).ToListAsync();
        Assert.Equal("FAILED", messages[0].Status);
        Assert.Equal("PENDING", messages[1].Status);
        Assert.NotNull(messages[0].NextAttemptAt);
    }

    [Fact]
    public async Task ProcessBatchAsync_LastAllowedFailure_MarksPoison()
    {
        await using var fixture = await Fixture.CreateAsync(new ThrowingConsumer(), maxAttempts: 2);
        var message = fixture.AddMessage(sequence: 1);
        message.AttemptCount = 1;
        await fixture.Context.SaveChangesAsync();

        await fixture.CreateProcessor().ProcessBatchAsync();

        var persisted = await fixture.Context.Lifecycleoutboxmessages.SingleAsync();
        Assert.Equal("POISON", persisted.Status);
        Assert.Equal(2, persisted.AttemptCount);
        Assert.Null(persisted.NextAttemptAt);
    }

    [Fact]
    public async Task ProcessBatchAsync_ExistingConsumerReceipt_DoesNotDeliverTwice()
    {
        var consumer = new CountingConsumer();
        await using var fixture = await Fixture.CreateAsync(consumer);
        var message = fixture.AddMessage(sequence: 1);
        fixture.Context.Lifecycleoutboxdeliveries.Add(new LifecycleOutboxDelivery
        {
            DeliveryId = Guid.NewGuid().ToByteArray(),
            OutboxMessageId = message.OutboxMessageId,
            ConsumerName = consumer.ConsumerName,
            ProcessedAt = fixture.Now
        });
        await fixture.Context.SaveChangesAsync();

        await fixture.CreateProcessor().ProcessBatchAsync();

        Assert.Equal(0, consumer.Count);
        Assert.Equal("PROCESSED", (await fixture.Context.Lifecycleoutboxmessages.SingleAsync()).Status);
        Assert.Single(await fixture.Context.Lifecycleoutboxdeliveries.ToListAsync());
    }

    [Fact]
    public async Task ProcessBatchAsync_StaleProcessingLease_IsReclaimed()
    {
        await using var fixture = await Fixture.CreateAsync();
        var message = fixture.AddMessage(sequence: 1);
        message.Status = "PROCESSING";
        message.LockedAt = fixture.Now.AddMinutes(-5);
        await fixture.Context.SaveChangesAsync();

        var processed = await fixture.CreateProcessor().ProcessBatchAsync();

        Assert.Equal(1, processed);
        Assert.Equal("PROCESSED", (await fixture.Context.Lifecycleoutboxmessages.SingleAsync()).Status);
    }

    [Fact]
    public async Task HealthCheck_DisabledRelay_IsDegradedWithBacklogCounts()
    {
        await using var fixture = await Fixture.CreateAsync(enabled: false);
        fixture.AddMessage(sequence: 1);
        await fixture.Context.SaveChangesAsync();
        var check = new LifecycleOutboxHealthCheck(
            fixture.Context,
            Options.Create(fixture.Options),
            fixture.TimeProvider);

        var result = await check.CheckHealthAsync(new HealthCheckContext());

        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(1, result.Data["pending"]);
        Assert.Equal(false, result.Data["enabled"]);
    }

    [Fact]
    public async Task AdminReplay_PoisonMessage_ResetsDeliveryStateAndWritesAudit()
    {
        await using var fixture = await Fixture.CreateAsync();
        var message = fixture.AddMessage(sequence: 1);
        message.Status = "POISON";
        message.AttemptCount = 8;
        message.LastError = "failed";
        await fixture.Context.SaveChangesAsync();
        var actorId = Guid.NewGuid();
        var service = new LifecycleOutboxAdminService(fixture.Context, new ImmediateTransactionRunner());

        var result = await service.ReplayAsync(
            GuidHelper.ToGuidString(message.OutboxMessageId),
            actorId.ToString(),
            "Đã xử lý nguyên nhân consumer lỗi.",
            CancellationToken.None);

        Assert.Equal("PENDING", result.Status);
        Assert.Equal(0, result.AttemptCount);
        Assert.Null(result.LastError);
        var audit = await fixture.Context.Auditlogs.SingleAsync();
        Assert.Equal("Replay", audit.FieldName);
        Assert.Equal("POISON", audit.OldValue);
        Assert.Equal("PENDING", audit.NewValue);
        Assert.True(audit.ChangedBy.SequenceEqual(actorId.ToByteArray()));
    }

    private sealed class Fixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly ILifecycleOutboxConsumer _consumer;

        private Fixture(
            SqliteConnection connection,
            IpcManagementContext context,
            ILifecycleOutboxConsumer consumer,
            LifecycleOutboxOptions options,
            FixedTimeProvider timeProvider)
        {
            _connection = connection;
            Context = context;
            _consumer = consumer;
            Options = options;
            TimeProvider = timeProvider;
        }

        public IpcManagementContext Context { get; }
        public LifecycleOutboxOptions Options { get; }
        public FixedTimeProvider TimeProvider { get; }
        public DateTime Now => TimeProvider.GetUtcNow().UtcDateTime;

        public static async Task<Fixture> CreateAsync(
            ILifecycleOutboxConsumer? consumer = null,
            int maxAttempts = 8,
            bool enabled = true)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IpcManagementContext(options);
            await context.Database.ExecuteSqlRawAsync(
                """
                CREATE TABLE lifecycleoutboxmessages (
                    outboxMessageId BLOB NOT NULL PRIMARY KEY,
                    eventType TEXT NOT NULL,
                    aggregateType TEXT NOT NULL,
                    aggregateId BLOB NOT NULL,
                    aggregateSequence INTEGER NOT NULL,
                    commandId TEXT NOT NULL,
                    payloadJson TEXT NOT NULL,
                    status TEXT NOT NULL,
                    attemptCount INTEGER NOT NULL DEFAULT 0,
                    nextAttemptAt TEXT NULL,
                    lockedAt TEXT NULL,
                    processedAt TEXT NULL,
                    lastError TEXT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE lifecycleoutboxdeliveries (
                    deliveryId BLOB NOT NULL PRIMARY KEY,
                    outboxMessageId BLOB NOT NULL,
                    consumerName TEXT NOT NULL,
                    processedAt TEXT NOT NULL,
                    CONSTRAINT fkLifecycleOutboxDeliveriesMessage
                        FOREIGN KEY (outboxMessageId) REFERENCES lifecycleoutboxmessages(outboxMessageId),
                    CONSTRAINT uqLifecycleOutboxDeliveriesMessageConsumer UNIQUE (outboxMessageId, consumerName)
                );
                CREATE TABLE auditlogs (
                    auditId BLOB NOT NULL PRIMARY KEY,
                    changedAt TEXT NOT NULL,
                    changedBy BLOB NOT NULL,
                    businessArea TEXT NOT NULL,
                    entityName TEXT NOT NULL,
                    entityId BLOB NULL,
                    fieldName TEXT NULL,
                    oldValue TEXT NULL,
                    newValue TEXT NULL,
                    reason TEXT NULL,
                    correlationId TEXT NULL
                );
                """);

            var relayOptions = new LifecycleOutboxOptions
            {
                Enabled = enabled,
                BatchSize = 20,
                LeaseSeconds = 60,
                MaxAttempts = maxAttempts,
                BaseRetrySeconds = 5,
                WarnPendingAgeSeconds = 300
            };
            return new Fixture(
                connection,
                context,
                consumer ?? new LifecyclePayloadValidationConsumer(),
                relayOptions,
                new FixedTimeProvider(new DateTimeOffset(2026, 8, 10, 2, 0, 0, TimeSpan.FromHours(7))));
        }

        public LifecycleOutboxMessage AddMessage(int sequence)
        {
            var message = new LifecycleOutboxMessage
            {
                OutboxMessageId = Guid.NewGuid().ToByteArray(),
                EventType = "InventoryReceipt.Transitioned",
                AggregateType = "InventoryReceipt",
                AggregateId = Enumerable.Repeat((byte)7, 16).ToArray(),
                AggregateSequence = sequence,
                CommandId = $"command-{sequence}",
                PayloadJson = "{\"state\":\"POSTED\"}",
                Status = "PENDING",
                CreatedAt = Now.AddMinutes(-10)
            };
            Context.Lifecycleoutboxmessages.Add(message);
            return message;
        }

        public LifecycleOutboxProcessor CreateProcessor() => new(
            Context,
            new[] { _consumer },
            Microsoft.Extensions.Options.Options.Create(Options),
            TimeProvider,
            NullLogger<LifecycleOutboxProcessor>.Instance);

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    private sealed class ThrowingConsumer : ILifecycleOutboxConsumer
    {
        public string ConsumerName => "throwing";
        public Task ConsumeAsync(LifecycleOutboxMessage message, CancellationToken cancellationToken)
            => throw new InvalidOperationException("consumer failed");
    }

    private sealed class CountingConsumer : ILifecycleOutboxConsumer
    {
        public string ConsumerName => "counting";
        public int Count { get; private set; }
        public Task ConsumeAsync(LifecycleOutboxMessage message, CancellationToken cancellationToken)
        {
            Count++;
            return Task.CompletedTask;
        }
    }

    public sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
