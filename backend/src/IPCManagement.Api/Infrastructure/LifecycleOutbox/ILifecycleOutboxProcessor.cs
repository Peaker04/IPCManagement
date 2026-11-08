namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public interface ILifecycleOutboxProcessor
{
    Task<int> ProcessBatchAsync(CancellationToken cancellationToken = default);
}
