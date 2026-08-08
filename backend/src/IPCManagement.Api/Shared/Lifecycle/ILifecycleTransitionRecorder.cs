using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Shared.Lifecycle;

public interface ILifecycleTransitionRecorder
{
    Task<LifecycleCommandReceipt?> FindExistingCommandAsync(string commandId, string aggregateType, byte[] aggregateId, CancellationToken cancellationToken = default);
    LifecycleTransition Stage(LifecycleTransitionRequest request);
}

public sealed record LifecycleTransitionRequest(
    string AggregateType,
    byte[] AggregateId,
    string CommandId,
    int AggregateSequence,
    string? FromState,
    string ToState,
    byte[]? ActorId,
    long ExpectedVersion,
    string? Reason,
    string? CorrelationId,
    string? CausationId,
    string PayloadJson,
    string ResponseJson,
    int SchemaVersion = 1);
