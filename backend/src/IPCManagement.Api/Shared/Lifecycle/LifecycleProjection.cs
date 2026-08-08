namespace IPCManagement.Api.Shared.Lifecycle;

public sealed record LifecycleEvidenceReference(
    string SourceType,
    string SourceId,
    string SourceLineId,
    string State,
    long Sequence);

public sealed record LifecycleProjectionSnapshot(
    string AggregateType,
    string AggregateId,
    string Classification,
    string CurrentState,
    IReadOnlyList<string> Blockers,
    IReadOnlyList<LifecycleEvidenceReference> Evidence);

public sealed record LifecycleReconciliationLine(
    string SourceLineId,
    string UnitId,
    decimal DemandQuantity,
    decimal PostedReceiptQuantity,
    decimal IssuedQuantity,
    decimal AcceptedReturnQuantity,
    decimal ApprovedAdjustmentQuantity)
{
    public decimal AvailableForIssue => PostedReceiptQuantity - IssuedQuantity + AcceptedReturnQuantity + ApprovedAdjustmentQuantity;
    public decimal UnresolvedDemand => DemandQuantity - IssuedQuantity;
}

public sealed record LifecycleOutboxHealth(
    int PendingCount,
    int ProcessingCount,
    int FailedCount,
    int PoisonCount,
    DateTime? OldestPendingAt);
