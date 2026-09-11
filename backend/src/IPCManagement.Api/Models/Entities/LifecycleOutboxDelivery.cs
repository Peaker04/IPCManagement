namespace IPCManagement.Api.Models.Entities;

public sealed class LifecycleOutboxDelivery
{
    public byte[] DeliveryId { get; set; } = null!;
    public byte[] OutboxMessageId { get; set; } = null!;
    public string ConsumerName { get; set; } = null!;
    public DateTime ProcessedAt { get; set; }
}
