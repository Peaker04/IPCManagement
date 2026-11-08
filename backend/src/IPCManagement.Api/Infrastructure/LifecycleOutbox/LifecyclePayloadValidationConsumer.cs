using System.Text.Json;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public sealed class LifecyclePayloadValidationConsumer : ILifecycleOutboxConsumer
{
    public string ConsumerName => "lifecycle-payload-v1";

    public Task ConsumeAsync(LifecycleOutboxMessage message, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        using var payload = JsonDocument.Parse(message.PayloadJson);
        if (payload.RootElement.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
        {
            throw new InvalidOperationException("Lifecycle outbox payload không hợp lệ.");
        }

        return Task.CompletedTask;
    }
}
