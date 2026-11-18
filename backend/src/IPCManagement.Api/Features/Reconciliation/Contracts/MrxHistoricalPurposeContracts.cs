namespace IPCManagement.Api.Features.Reconciliation.Contracts;

public sealed record MrxHistoricalPurposeAllocation(string Purpose, decimal Quantity, string? DemandMaterialId, long? ExpectedDemandVersion);
public sealed record MrxHistoricalPurposeProposalRequest(string CommandId, string BatchId, DateOnly ServiceDate, string IssueLineId,
    long ExpectedBatchVersion, string Reason, IReadOnlyList<MrxHistoricalPurposeAllocation> Allocations);
public sealed record MrxHistoricalPurposeDecision(string CommandId, long ExpectedVersion, long ExpectedBatchVersion, bool Approve, string Reason);
public sealed record MrxHistoricalPurposeCandidate(string IssueLineId, string IssueCode, string IngredientName, string UnitName,
    decimal UnallocatedQuantity, decimal ReturnedQuantity, string? PendingProposalId, IReadOnlyList<MrxHistoricalPurposeDemand> Demands);
public sealed record MrxHistoricalPurposeDemand(string DemandId, string DemandMaterialId, long Version);
public sealed record MrxHistoricalPurposeDetail(string ProposalId, string BatchId, long BatchVersion, DateOnly ServiceDate,
    string IssueLineId, string IssueCode, string IngredientName, string UnitName, decimal UnallocatedQuantity,
    string Status, long Version, string Reason, string CreatedBy, DateTime CreatedAt, string? DecisionReason,
    IReadOnlyList<MrxHistoricalPurposeAllocation> Allocations);
