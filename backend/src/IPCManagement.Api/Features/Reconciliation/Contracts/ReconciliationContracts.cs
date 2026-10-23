namespace IPCManagement.Api.Features.Reconciliation.Contracts;

using IPCManagement.Api.Shared.Contracts;

public sealed record ReconciliationBatchDto(
    string BatchId,
    string MenuVersionId,
    string QuantityImportBatchId,
    string Status,
    long Version,
    DateTime CreatedAt,
    DateTime? ReadyAt,
    DateTime? CompletedAt,
    IReadOnlyList<ReconciliationLineDto> Lines)
{
    public string? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerCode { get; init; }
    public DateOnly? WeekStartDate { get; init; }
    public DateOnly? WeekEndDate { get; init; }
    public ReconciliationDailyReviewDto? DailyReview { get; init; }
}
public sealed record ReconciliationDailyReviewDto(string WeeklyStatus, IReadOnlyList<ReconciliationLineDto> Lines);
public sealed record ReconciliationLineDto(string BatchLineId, string IngredientId, string? IngredientCode, string? IngredientName, string CanonicalUnitId, string? CanonicalUnitName, decimal RequiredQuantity, decimal FrozenTolerance, decimal? PurchasedQuantity, long? PurchasedVersion, decimal? IssuedQuantity, long? IssuedVersion, decimal? PurchasedRequiredDifference, decimal? IssuedRequiredDifference, decimal? PurchasedIssuedDifference, IReadOnlyList<string> Triggers, string Status, long Version, ReconciliationDispositionDto? Disposition, IReadOnlyList<string>? IssueNotes = null)
{
    public string? DailyLineId { get; init; }
    public DateOnly? ServiceDate { get; init; }
}
public sealed record ReconciliationDispositionDto(string Category, string Reason, long Version, DateTime DisposedAt);
public sealed class ReconciliationBatchPageQuery : PagedRequestDto
{
    public string? CustomerId { get; set; }
    public DateOnly? WeekStartDate { get; set; }
    public string? Status { get; set; }
}
public sealed record ReconciliationBatchSummaryDto(
    string BatchId,
    string Status,
    long Version,
    DateTime CreatedAt,
    DateTime? ReadyAt,
    DateTime? CompletedAt,
    string CustomerId,
    string? CustomerCode,
    string? CustomerName,
    DateOnly WeekStartDate,
    DateOnly WeekEndDate);
public sealed record ReconciliationDispositionCategoryDto(string Value, string Label);
public sealed record ReconciliationDraftSourceDto(string MenuVersionId, string MenuLabel, string QuantityImportBatchId, string ImportBatchLabel);
public sealed record ReconciliationSourceChangeDto(string ChangeId, DateTime ChangedAt, string Actor, string BusinessArea, string EntityName, string? EntityId, string? FieldName, string? OldValue, string? NewValue, string? Reason);
public sealed class ReconciliationSourceDeltaPageQuery : PagedRequestDto
{
    public string? BatchId { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string? WorkKind { get; set; }
}
public sealed record ReconciliationSourceDeltaQueueItemDto(
    string SourceDeltaId,
    string SourceRevisionId,
    string BatchId,
    string DailyLineId,
    DateOnly ServiceDate,
    string IngredientId,
    string? IngredientCode,
    string? IngredientName,
    string CanonicalUnitId,
    string? CanonicalUnitName,
    decimal PreviousRequiredQuantity,
    decimal NewRequiredQuantity,
    decimal DeltaQuantity,
    string WorkKind,
    string Status,
    long Version,
    DateTime CreatedAt);
public sealed record PreviewQuantityImportRequest(string MenuVersionId, string? SourceLabel);
public sealed record CommitQuantityImportRequest(string Token, string ContentFingerprint, string? SourceLabel);
public sealed record QuantityImportMaterialContributionDto(string DishBomId, string IngredientId, string IngredientCode, string IngredientName, decimal GrossQuantityPerServing, string SourceUnitId, string SourceUnitName, decimal RequiredQuantity, string CanonicalUnitId, string CanonicalUnitName);
public sealed record QuantityImportDishDto(string DishId, string DishCode, string DishName, string? DishSlot, int DisplayOrder, IReadOnlyList<QuantityImportMaterialContributionDto> Materials);
public sealed record QuantityImportPlanLineDto(string QuantityPlanLineId, string MenuScheduleId, string CustomerId, string MenuId, string Shift, int FinalServings, string MenuCode, string MenuName, IReadOnlyList<QuantityImportDishDto> Dishes);
public sealed record QuantityImportPlanDto(string QuantityPlanId, string PlanCode, DateOnly ServiceDate, string Status, DateTime RowVersion, IReadOnlyList<QuantityImportPlanLineDto> Lines);
public sealed record QuantityImportPreviewDto(string Token, DateTimeOffset ExpiresAt, string ContentFingerprint, int FingerprintFormatVersion, IReadOnlyList<QuantityImportPlanDto> Plans, IReadOnlyList<string> Diagnostics);
public sealed record QuantityImportCommitDto(string ImportBatchId, string ReconciliationBatchId, string ContentFingerprint, bool IdempotentReplay);
public sealed record CreateReconciliationDraftRequest(string MenuVersionId, string QuantityImportBatchId);
public sealed record ReadyReconciliationBatchRequest(long ExpectedVersion);
public sealed record TransferReconciliationBatchRequest(long ExpectedVersion);
public sealed record ReconciliationWarehouseTransferDto(string BatchId, string Status, long SourceVersion, IReadOnlyList<ReconciliationWarehouseTransferLineDto> Lines);
public sealed record ReconciliationWarehouseTransferLineDto(string BatchLineId, string IngredientId, string? IngredientCode, string? IngredientName, string CanonicalUnitId, string? CanonicalUnitName, decimal RequiredQuantity, long SourceVersion);
public sealed record ReconciliationWarehouseDailyDto(string BatchId, string BatchStatus, long SourceVersion, string WeeklyStatus, ReconciliationDailyCompatibilityDto Compatibility, IReadOnlyList<ReconciliationWarehouseDayDto> Dates);
public sealed record ReconciliationDailyCompatibilityDto(bool CanRead, bool CanIssueByDate, string? ReasonCode);
public sealed record ReconciliationWarehouseDayDto(DateOnly ServiceDate, string Status, bool IsApplicable, decimal RequiredQuantity, decimal IssuedQuantity, decimal ReturnedQuantity, decimal RemainingQuantity, IReadOnlyList<ReconciliationWarehouseDailyLineDto> Lines);
public sealed record ReconciliationWarehouseDailyLineDto(string DailyLineId, string BatchLineId, string IngredientId, string? IngredientCode, string? IngredientName, string CanonicalUnitId, string? CanonicalUnitName, decimal RequiredQuantity, decimal? IssuedQuantity, decimal ReturnedQuantity, decimal RemainingQuantity, string QuantityStatus, bool HasValidDisposition);
public sealed record ReconciliationKitchenCookingExportDto(string BatchId, long SourceVersion, IReadOnlyList<ReconciliationKitchenCookingRowDto> Rows);
public sealed record ReconciliationKitchenCookingRowDto(DateOnly ServiceDate, string Weekday, string ShiftName, string DishCode, string DishName, int Servings, string IngredientCode, string IngredientName, string UnitName, decimal BomQuantityPerServing, decimal? WasteRatePercent, decimal TotalRequiredQuantity);
public sealed record UpsertReconciliationActualRequest(decimal Quantity, long? ExpectedVersion, bool ConfirmZero, string? CorrectionReason);
public sealed record SetReconciliationDispositionRequest(string Category, string Reason, long? ExpectedVersion);
public sealed record CompleteReconciliationBatchRequest(long ExpectedVersion);
public sealed record ReconciliationBatchDishScopeDto(string ServiceDate, string ShiftName, int FrozenServings, int CurrentServings, int AdditionalServings);
public sealed record ReconciliationBatchDishSummaryDto(string DishId, string DishCode, string DishName, IReadOnlyList<ReconciliationBatchDishMaterialDto> Materials, IReadOnlyList<ReconciliationBatchDishScopeDto>? Scopes = null);
public sealed record ReconciliationBatchDishMaterialDto(string BatchLineId, string IngredientId, string? IngredientCode, string? IngredientName, string CanonicalUnitId, string? CanonicalUnitName, decimal GrossQtyPerServing, string? DailyLineId = null, string? ServiceDate = null);

public sealed record ReconciliationPreparationBatchAllocationDto(
    string BatchId,
    string BatchLineId,
    string DailyLineId,
    string CustomerId,
    string? CustomerCode,
    string? CustomerName,
    decimal RequiredQuantity,
    decimal? IssuedQuantity,
    decimal RemainingQuantity,
    string Status);

public sealed record ReconciliationPreparationAggregatedLineDto(
    string IngredientId,
    string? IngredientCode,
    string? IngredientName,
    string CanonicalUnitId,
    string? CanonicalUnitName,
    decimal TotalRequiredQuantity,
    decimal TotalIssuedQuantity,
    decimal TotalRemainingQuantity,
    IReadOnlyList<ReconciliationPreparationBatchAllocationDto> Allocations);

public sealed record ReconciliationPreparationBatchSummaryDto(
    string BatchId,
    string CustomerId,
    string? CustomerCode,
    string? CustomerName,
    string BatchStatus,
    long BatchVersion,
    bool IsApplicable,
    bool HasExistingIssue,
    decimal RequiredQuantity,
    decimal IssuedQuantity,
    decimal RemainingQuantity);

public sealed record ReconciliationPreparationDto(
    DateOnly ServiceDate,
    IReadOnlyList<ReconciliationPreparationBatchSummaryDto> Batches,
    IReadOnlyList<ReconciliationPreparationAggregatedLineDto> AggregatedLines);

public sealed class CoordinatedPreparationIssueBatchLineRequest
{
    public string ReconciliationBatchLineId { get; set; } = string.Empty;
    public string ReconciliationBatchDailyLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public decimal RequestedQty { get; set; }
    public decimal IssuedQty { get; set; }
    public string? VarianceReason { get; set; }
}

public sealed class CoordinatedPreparationIssueBatchRequest
{
    public string ReconciliationBatchId { get; set; } = string.Empty;
    public long ExpectedVersion { get; set; }
    public List<CoordinatedPreparationIssueBatchLineRequest> Lines { get; set; } = [];
}

public sealed class CoordinatedPreparationIssueRequest
{
    public string CommandId { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string? WarehouseId { get; set; }
    public List<CoordinatedPreparationIssueBatchRequest> Batches { get; set; } = [];
}

public sealed record CoordinatedPreparationBatchResultDto(
    string ReconciliationBatchId,
    string IssueId,
    string IssueCode,
    long BatchVersion);

public sealed record CoordinatedPreparationIssueResultDto(
    string PreparationGroupId,
    DateOnly ServiceDate,
    string CommandId,
    IReadOnlyList<CoordinatedPreparationBatchResultDto> Issues,
    bool IdempotentReplay);

public sealed class ReconciliationPreparationWorkbookQuery
{
    public DateOnly? ServiceDate { get; set; }
    public DateOnly? WeekStartDate { get; set; }
    public List<string>? CustomerIds { get; set; }
    public List<string>? BatchIds { get; set; }
    public string? SupplierName { get; set; }
    public bool? IsSupplemental { get; set; }
}

public sealed record ReconciliationPreparationSummaryRowDto(
    string SupplierName,
    string IngredientId,
    string IngredientCode,
    string IngredientName,
    string CanonicalUnitId,
    string CanonicalUnitName,
    IReadOnlyDictionary<string, decimal> CustomerQuantities,
    decimal TotalQuantity);

public sealed record ReconciliationPreparationDetailRowDto(
    string CustomerId,
    string CustomerCode,
    string CustomerName,
    string BatchId,
    DateOnly ServiceDate,
    string ShiftName,
    string IngredientId,
    string IngredientCode,
    string IngredientName,
    string CanonicalUnitId,
    string CanonicalUnitName,
    decimal Quantity,
    string Classification,
    string IssueStatus,
    string SupplierName);

public sealed record ReconciliationPreparationWorkbookDto(
    IReadOnlyList<string> CustomerColumns,
    IReadOnlyList<ReconciliationPreparationSummaryRowDto> SummaryRows,
    IReadOnlyList<ReconciliationPreparationDetailRowDto> DetailRows,
    decimal SummaryTotalQuantity,
    decimal DetailTotalQuantity);

public sealed record MrxOperationalQueueItemDto(
    string QueueType,
    string WorkObjectId,
    string Title,
    string Subtitle,
    string TargetUrl,
    DateTime CreatedAt);

public sealed record MrxOperationalSummaryDto(
    int PendingSourceChangesCount,
    int AwaitingWarehouseBatchesCount,
    int PendingDeltasCount,
    int UnresolvedVariancesCount,
    int CompletionReadyBatchesCount,
    IReadOnlyList<MrxOperationalQueueItemDto> Items);

public sealed record MrxTransactionHistoryRowDto(
    string TransactionType,
    string DocumentCode,
    DateOnly Date,
    string BatchId,
    string CustomerName,
    string IngredientCode,
    string IngredientName,
    string UnitName,
    decimal Quantity,
    string ActorName,
    DateTime CreatedAt,
    string? Reason);

public sealed record MrxTransactionHistoryReportDto(
    IReadOnlyList<MrxTransactionHistoryRowDto> Rows,
    int TotalCount);

public sealed record MrxVarianceRegisterRowDto(
    string BatchId,
    string CustomerName,
    DateOnly ServiceDate,
    string ShiftName,
    string IngredientCode,
    string IngredientName,
    string CanonicalUnitName,
    decimal RequiredQuantity,
    decimal IssuedQuantity,
    decimal Difference,
    string VarianceType,
    string? DispositionCategory,
    string? DispositionReason,
    string? DisposedBy,
    DateTime? DisposedAt,
    IReadOnlyList<string> IssueNotes);

public sealed record MrxVarianceRegisterReportDto(
    IReadOnlyList<MrxVarianceRegisterRowDto> Rows,
    int TotalCount);

public sealed record MrxCompletedRegisterRowDto(
    string BatchId,
    string CustomerName,
    DateOnly WeekStartDate,
    DateOnly WeekEndDate,
    string CompletedBy,
    DateTime CompletedAt,
    long Version,
    int TotalIngredientsCount,
    decimal TotalRequired,
    decimal TotalIssued,
    decimal TotalVariance);

public sealed record MrxCompletedRegisterReportDto(
    IReadOnlyList<MrxCompletedRegisterRowDto> Rows,
    int TotalCount);

public sealed record MrxAuditTrailRowDto(
    string AuditId,
    DateTime ChangedAt,
    string ChangedBy,
    string BusinessArea,
    string EntityName,
    string EntityId,
    string? FieldName,
    string? OldValue,
    string? NewValue,
    string? Reason);

public sealed record MrxAuditTrailReportDto(
    IReadOnlyList<MrxAuditTrailRowDto> Rows,
    int TotalCount);
