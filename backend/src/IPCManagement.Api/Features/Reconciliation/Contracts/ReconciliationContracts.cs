namespace IPCManagement.Api.Features.Reconciliation.Contracts;

public sealed record ReconciliationBatchDto(string BatchId, string MenuVersionId, string QuantityImportBatchId, string Status, long Version, DateTime CreatedAt, DateTime? ReadyAt, DateTime? CompletedAt, IReadOnlyList<ReconciliationLineDto> Lines);
public sealed record ReconciliationLineDto(string BatchLineId, string IngredientId, string CanonicalUnitId, decimal RequiredQuantity, decimal FrozenTolerance, decimal? PurchasedQuantity, decimal? IssuedQuantity, decimal? PurchasedRequiredDifference, decimal? IssuedRequiredDifference, decimal? PurchasedIssuedDifference, IReadOnlyList<string> Triggers, string Status, long Version, ReconciliationDispositionDto? Disposition);
public sealed record ReconciliationDispositionDto(string Category, string Reason, long Version, DateTime DisposedAt);
public sealed record CreateReconciliationDraftRequest(string MenuVersionId, string QuantityImportBatchId);
public sealed record ReadyReconciliationBatchRequest(long ExpectedVersion);
public sealed record UpsertReconciliationActualRequest(decimal Quantity, long? ExpectedVersion, bool ConfirmZero, string? CorrectionReason);
public sealed record SetReconciliationDispositionRequest(string Category, string Reason, long? ExpectedVersion);
public sealed record CompleteReconciliationBatchRequest(long ExpectedVersion);
