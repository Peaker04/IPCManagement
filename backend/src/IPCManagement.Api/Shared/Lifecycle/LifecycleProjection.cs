namespace IPCManagement.Api.Infrastructure.Lifecycle;

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

public static class DemandFulfillmentStatus
{
    public const string Missing = "MISSING";
    public const string InProgress = "IN_PROGRESS";
    public const string Fulfilled = "FULFILLED";

    public static string Resolve(decimal fulfilledQuantity, decimal outstandingQuantity)
        => outstandingQuantity <= 0m
            ? Fulfilled
            : fulfilledQuantity > 0m
                ? InProgress
                : Missing;
}

public static class DecisionCorrectionCompletionPolicy
{
    public static bool IsComplete(IEnumerable<string> effectiveDecisionIds, IEnumerable<string> correctedDecisionIds)
    {
        var corrected = correctedDecisionIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var effective = effectiveDecisionIds.ToArray();
        return effective.Length > 0 && effective.All(corrected.Contains);
    }
}
