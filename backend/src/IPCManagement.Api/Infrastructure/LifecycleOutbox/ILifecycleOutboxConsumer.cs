using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public interface ILifecycleOutboxConsumer
{
    string ConsumerName { get; }
    Task ConsumeAsync(LifecycleOutboxMessage message, CancellationToken cancellationToken);
}
