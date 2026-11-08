namespace IPCManagement.Api.Models.Entities;

public partial class LifecycleOutboxMessage
{
    public byte[] OutboxMessageId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public string AggregateType { get; set; } = null!;
    public byte[] AggregateId { get; set; } = null!;
    public int AggregateSequence { get; set; }
    public string CommandId { get; set; } = null!;
    public string PayloadJson { get; set; } = null!;
    public string Status { get; set; } = "PENDING";
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }
    public DateTime? LockedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreatedAt { get; set; }
}
