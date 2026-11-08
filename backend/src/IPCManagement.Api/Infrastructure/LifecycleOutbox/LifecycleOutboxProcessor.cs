using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public sealed class LifecycleOutboxProcessor(
    IpcManagementContext context,
    IEnumerable<ILifecycleOutboxConsumer> consumers,
    IOptions<LifecycleOutboxOptions> options,
    TimeProvider timeProvider,
    ILogger<LifecycleOutboxProcessor> logger) : ILifecycleOutboxProcessor
{
    private readonly LifecycleOutboxOptions _options = options.Value;
    private readonly IReadOnlyList<ILifecycleOutboxConsumer> _consumers = consumers.ToArray();

    public async Task<int> ProcessBatchAsync(CancellationToken cancellationToken = default)
    {
        if (_consumers.Count == 0)
        {
            throw new InvalidOperationException("Lifecycle outbox relay cần ít nhất một consumer.");
        }

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var staleBefore = now.AddSeconds(-NormalizePositive(_options.LeaseSeconds, 60));
        var batchSize = Math.Clamp(_options.BatchSize, 1, 500);

        var candidateIds = await context.Lifecycleoutboxmessages
            .AsNoTracking()
            .Where(message =>
                message.Status == "PENDING" ||
                (message.Status == "FAILED" && (message.NextAttemptAt == null || message.NextAttemptAt <= now)) ||
                (message.Status == "PROCESSING" && message.LockedAt != null && message.LockedAt <= staleBefore))
            .Where(message => !context.Lifecycleoutboxmessages.Any(earlier =>
                earlier.AggregateType == message.AggregateType &&
                earlier.AggregateId.SequenceEqual(message.AggregateId) &&
                earlier.AggregateSequence < message.AggregateSequence &&
                earlier.Status != "PROCESSED"))
            .OrderBy(message => message.CreatedAt)
            .ThenBy(message => message.OutboxMessageId)
            .Select(message => message.OutboxMessageId)
            .Take(batchSize)
            .ToListAsync(cancellationToken);

        var processed = 0;
        foreach (var messageId in candidateIds)
        {
            if (await TryProcessAsync(messageId, now, staleBefore, cancellationToken))
            {
                processed++;
            }
        }

        return processed;
    }

    private async Task<bool> TryProcessAsync(
        byte[] messageId,
        DateTime now,
        DateTime staleBefore,
        CancellationToken cancellationToken)
    {
        var claimed = await context.Lifecycleoutboxmessages
            .Where(message => message.OutboxMessageId.SequenceEqual(messageId))
            .Where(message =>
                message.Status == "PENDING" ||
                (message.Status == "FAILED" && (message.NextAttemptAt == null || message.NextAttemptAt <= now)) ||
                (message.Status == "PROCESSING" && message.LockedAt != null && message.LockedAt <= staleBefore))
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(message => message.Status, "PROCESSING")
                .SetProperty(message => message.LockedAt, now)
                .SetProperty(message => message.NextAttemptAt, (DateTime?)null)
                .SetProperty(message => message.AttemptCount, message => message.AttemptCount + 1),
                cancellationToken);

        if (claimed == 0)
        {
            return false;
        }

        // ExecuteUpdate bypasses the change tracker. The processor owns this scoped context,
        // so clear any stale tracked message before evaluating the incremented attempt count.
        context.ChangeTracker.Clear();
        var message = await context.Lifecycleoutboxmessages
            .SingleAsync(item => item.OutboxMessageId.SequenceEqual(messageId), cancellationToken);

        try
        {
            foreach (var consumer in _consumers)
            {
                var alreadyDelivered = await context.Lifecycleoutboxdeliveries
                    .AsNoTracking()
                    .AnyAsync(delivery =>
                        delivery.OutboxMessageId.SequenceEqual(messageId) &&
                        delivery.ConsumerName == consumer.ConsumerName,
                        cancellationToken);
                if (alreadyDelivered)
                {
                    continue;
                }

                await consumer.ConsumeAsync(message, cancellationToken);
                context.Lifecycleoutboxdeliveries.Add(new LifecycleOutboxDelivery
                {
                    DeliveryId = GuidHelper.NewId(),
                    OutboxMessageId = message.OutboxMessageId,
                    ConsumerName = consumer.ConsumerName,
                    ProcessedAt = now
                });
                await context.SaveChangesAsync(cancellationToken);
            }

            message.Status = "PROCESSED";
            message.ProcessedAt = now;
            message.LockedAt = null;
            message.NextAttemptAt = null;
            message.LastError = null;
            await context.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var maxAttempts = NormalizePositive(_options.MaxAttempts, 8);
            var isPoison = message.AttemptCount >= maxAttempts;
            message.Status = isPoison ? "POISON" : "FAILED";
            message.LockedAt = null;
            message.ProcessedAt = null;
            message.LastError = Truncate(ex.Message, 2000);
            message.NextAttemptAt = isPoison ? null : now.Add(ComputeBackoff(message.AttemptCount));
            await context.SaveChangesAsync(cancellationToken);
            logger.LogWarning(ex, "Lifecycle outbox {OutboxMessageId} chuyển sang {Status} ở attempt {AttemptCount}",
                Convert.ToHexString(message.OutboxMessageId), message.Status, message.AttemptCount);
            return false;
        }
    }

    private TimeSpan ComputeBackoff(int attemptCount)
    {
        var baseSeconds = NormalizePositive(_options.BaseRetrySeconds, 5);
        var exponent = Math.Clamp(attemptCount - 1, 0, 10);
        return TimeSpan.FromSeconds(Math.Min(baseSeconds * Math.Pow(2, exponent), 3600));
    }

    private static int NormalizePositive(int value, int fallback) => value > 0 ? value : fallback;
    private static string Truncate(string value, int maxLength) => value.Length <= maxLength ? value : value[..maxLength];
}
