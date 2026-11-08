namespace IPCManagement.Api.Models.Entities;

public partial class LifecycleTransition
{
    public byte[] TransitionId { get; set; } = null!;
    public string AggregateType { get; set; } = null!;
    public byte[] AggregateId { get; set; } = null!;
    public string CommandId { get; set; } = null!;
    public int AggregateSequence { get; set; }
    public string? FromState { get; set; }
    public string ToState { get; set; } = null!;
    public byte[]? ActorId { get; set; }
    public long ExpectedVersion { get; set; }
    public string? Reason { get; set; }
    public string? CorrelationId { get; set; }
    public string? CausationId { get; set; }
    public string? PayloadJson { get; set; }
    public int SchemaVersion { get; set; } = 1;
    public DateTime CreatedAt { get; set; }
}
