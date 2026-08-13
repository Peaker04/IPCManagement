namespace IPCManagement.Api.Features.Reports.Contracts;

public class CursorPageDto<T>
{
    public IReadOnlyList<T> Items { get; set; } = [];
    public int Limit { get; set; }
    public bool HasNext { get; set; }
    public string? NextCursorDate { get; set; }
    public string? NextCursorId { get; set; }
    /// <summary>Số dòng đã trả ở mốc <see cref="NextCursorDate"/>; client gửi lại nguyên vẹn ở lần sau.</summary>
    public int NextCursorOffset { get; set; }
}

public class OperationalKpiSummaryDto
{
    public int ShortageCount { get; set; }
    public int LowStockCount { get; set; }
    public int OverduePurchaseRequestCount { get; set; }
    public int LateReceiptCount { get; set; }
    public int PendingKitchenConfirmationCount { get; set; }
    public int FailedWorkflowCount { get; set; }
    public int CriticalDataQualityCount { get; set; }
    public int OverdueApprovalCount { get; set; }
    public decimal TotalKitchenIssuedQty { get; set; }
    public decimal TotalKitchenUsedQty { get; set; }
    public decimal TotalKitchenReturnedQty { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class CurrentStockSummaryDto
{
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal CurrentQty { get; set; }
    public DateTime LastUpdated { get; set; }
}

public class StockMovementViewDto
{
    public string MovementId { get; set; } = string.Empty;
    public DateTime MovementDate { get; set; }
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public string MovementType { get; set; } = string.Empty;
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal BeforeQty { get; set; }
    public decimal AfterQty { get; set; }
    public string? RefTable { get; set; }
    public string? RefId { get; set; }
    /// <summary>Trạng thái bếp xác nhận đối với phiếu xuất kho; null với biến động không cần bếp ký nhận.</summary>
    public string? KitchenReceiptStatus { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
}

public class StockLedgerReconciliationDto
{
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal CurrentQty { get; set; }
    public decimal LedgerQty { get; set; }
    public decimal DifferenceQty { get; set; }
    public bool IsMatched { get; set; }
    public DateTime? LastMovementAt { get; set; }
}

public class StockSnapshotDto
{
    public string SnapshotId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public DateOnly PeriodMonth { get; set; }
    public decimal OpeningQty { get; set; }
    public decimal QuantityIn { get; set; }
    public decimal QuantityOut { get; set; }
    public decimal ClosingQty { get; set; }
    public DateTime GeneratedAt { get; set; }
}

public class IngredientDemandReportDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    /// <summary>
    /// Khóa ở đúng độ hạt (grain) của báo cáo: một chứng từ có thể có nhiều dòng cùng nguyên liệu.
    /// Thiếu trường này, client phải ghép <c>MaterialRequestId + IngredientId</c> và bị trùng khóa.
    /// </summary>
    public string RequestLineId { get; set; } = string.Empty;
    public string MaterialRequestCode { get; set; } = string.Empty;
    public DateOnly RequestDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string? CustomerName { get; set; }
    public string? DishName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public string? BomId { get; set; }
    public decimal PriceTierAmount { get; set; }
    public string BomScope { get; set; } = "global";
    public int TotalServings { get; set; }
    public decimal BomRatePercent { get; set; }
    public string? AppliedPortionRuleId { get; set; }
    public string AppliedPortionRuleSource { get; set; } = string.Empty;
    public decimal AppliedPortionRatePercent { get; set; }
    public decimal? YieldLossPercent { get; set; }
    public decimal TotalRequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
}

public class PurchaseDemandReportDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
    public string PurchaseRequestLineId { get; set; } = string.Empty;
    public string PurchaseRequestCode { get; set; } = string.Empty;
    public DateOnly PurchaseForDate { get; set; }
    public string? ShiftName { get; set; }
    public string Status { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal RequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal PurchaseQty { get; set; }
    public decimal EstimatedUnitPrice { get; set; }
    public decimal EstimatedAmount { get; set; }
    public decimal ReferenceUnitPrice { get; set; }
    public decimal PriceVariancePercent { get; set; }
    public bool IsPriceWarning { get; set; }
    public DateOnly? ExpectedDeliveryDate { get; set; }
    public string? Note { get; set; }
}

public class ReceiptPriceVarianceReportDto
{
    public string ReceiptId { get; set; } = string.Empty;
    public string ReceiptCode { get; set; } = string.Empty;
    public DateOnly ReceiptDate { get; set; }
    public string SupplierId { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal ReferencePrice { get; set; }
    public decimal VariancePercent { get; set; }
    public bool IsWarning { get; set; }
}

public class PriceVarianceBySupplierDto
{
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string SupplierId { get; set; } = string.Empty;
    public string? SupplierName { get; set; }
    /// <summary>Đơn vị của nhóm. Không có nó thì kg và thùng của cùng nguyên liệu bị gộp làm một dòng giá.</summary>
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public int ReceiptCount { get; set; }
    /// <summary>Giá bình quân **có trọng số theo sản lượng**, không phải trung bình cộng các dòng nhập.</summary>
    public decimal AvgUnitPrice { get; set; }
    public decimal MinUnitPrice { get; set; }
    public decimal MaxUnitPrice { get; set; }
    public decimal ReferencePrice { get; set; }
    public decimal VariancePercent { get; set; }
    public bool IsWarning { get; set; }
}

public class PriceVarianceByPeriodDto
{
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    /// <summary>Đơn vị của nhóm. Không có nó thì kg và thùng của cùng nguyên liệu bị gộp làm một dòng giá.</summary>
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public string PeriodLabel { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
    /// <summary>Giá bình quân **có trọng số theo sản lượng**, không phải trung bình cộng các dòng nhập.</summary>
    public decimal AvgUnitPrice { get; set; }
    public decimal ReferencePrice { get; set; }
    public decimal VariancePercentVsReference { get; set; }
    public decimal? VariancePercentVsPreviousPeriod { get; set; }
    public bool IsWarning { get; set; }
}

public class PriceVarianceDishGroupIngredientDto
{
    public string IngredientName { get; set; } = string.Empty;
    public decimal VariancePercent { get; set; }
    public decimal Weight { get; set; }
}

public class PriceVarianceByDishGroupDto
{
    public string DishGroup { get; set; } = string.Empty;
    public int IngredientCount { get; set; }
    public int WarningIngredientCount { get; set; }
    public decimal WeightedAvgVariancePercent { get; set; }
    public List<PriceVarianceDishGroupIngredientDto> TopIngredients { get; set; } = [];
}

public class KitchenIssueReportDto
{
    public string IssueId { get; set; } = string.Empty;
    public string IssueLineId { get; set; } = string.Empty;
    public string IssueCode { get; set; } = string.Empty;
    public DateOnly IssueDate { get; set; }
    public string? ShiftName { get; set; }
    public string? SourceCustomerName { get; set; }
    public string? SourceShiftName { get; set; }
    public decimal? SourcePriceTierAmount { get; set; }
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string MaterialRequestId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal RequestedQty { get; set; }
    public decimal IssuedQty { get; set; }
    public string? ReceivedBy { get; set; }
    public string? ReceivedByName { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public bool IsReceivedByKitchen { get; set; }
    public string ReceiptStatus { get; set; } = string.Empty;
}

public class IssueVsReturnUsageReportDto
{
    public string IssueId { get; set; } = string.Empty;
    /// <summary>
    /// Canonical grain of this projection. Two lines in one issue may use the same
    /// ingredient and unit, so IssueId + IngredientId is not a safe allocation key.
    /// </summary>
    public string IssueLineId { get; set; } = string.Empty;
    public string IssueCode { get; set; } = string.Empty;
    public DateOnly IssueDate { get; set; }
    public string? ShiftName { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal IssuedQty { get; set; }
    public decimal ReturnedQty { get; set; }
    public decimal WastedQty { get; set; }
    public decimal UsedQty { get; set; }
    public decimal VarianceQty { get; set; }
    /// <summary>
    /// Count only, never an inferred quantity: these old return rows have no
    /// SourceIssueLineId and therefore cannot be assigned to this report line.
    /// </summary>
    public int LegacyUnattributedReturnLineCount { get; set; }
}

/// <summary>
/// Shadow reconciliation at the immutable demand source-line grain. Quantities
/// are deliberately not collapsed by ingredient name or document header.
/// </summary>
public class SupplyLineReconciliationDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    public string MaterialRequestLineId { get; set; } = string.Empty;
    public string MaterialRequestCode { get; set; } = string.Empty;
    public DateOnly RequestDate { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal DemandQty { get; set; }
    public decimal PurchaseRequestAllocatedQty { get; set; }
    public decimal PurchaseOrderAllocatedQty { get; set; }
    public decimal PostedAcceptedReceiptQty { get; set; }
    public decimal IssuedQty { get; set; }
    public decimal KitchenAcknowledgedQty { get; set; }
    public decimal ReturnedQty { get; set; }
    public decimal WastedQty { get; set; }
    public decimal SupplementalRequestedQty { get; set; }
    public decimal SupplementalFulfilledQty { get; set; }
    public decimal SupplementalPurchaseAllocatedQty { get; set; }
    /// <summary>Demand not currently held by kitchen after acknowledged returns.</summary>
    public decimal DeltaQty { get; set; }
    public string Disposition { get; set; } = string.Empty;
    /// <summary>Legacy records are surfaced as exceptions and never allocated here.</summary>
    public int LegacyLineageExceptionCount { get; set; }
    /// <summary>Per-source disposition state; no ingredient-name inference is used.</summary>
    public IReadOnlyList<LegacyLineageDispositionReportDto> LegacyLineageDispositions { get; set; } = [];
}

public class LegacyLineageDispositionReportDto
{
    public string LegacyLineType { get; set; } = string.Empty;
    public string LegacyLineId { get; set; } = string.Empty;
    public string? DispositionId { get; set; }
    public string Status { get; set; } = "UNDISPOSITIONED";
    public string? TargetLineId { get; set; }
    public string? Reason { get; set; }
    public string? ReviewReason { get; set; }
    public long? Version { get; set; }
}

public class AuditChangeReportDto
{
    public string AuditId { get; set; } = string.Empty;
    public DateTime ChangedAt { get; set; }
    public string ChangedBy { get; set; } = string.Empty;
    public string? ChangedByName { get; set; }
    public string BusinessArea { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? FieldName { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? Reason { get; set; }
    public string? CorrelationId { get; set; }
}

public class DataQualityReportDto
{
    public DateTime GeneratedAt { get; set; }
    public int TotalIssues { get; set; }
    public bool IsTruncated { get; set; }
    public int ErrorCount { get; set; }
    public int WarningCount { get; set; }
    public int ResolvedIssueCount { get; set; }
    public int ReopenedIssueCount { get; set; }
    public int UrgentIssueCount { get; set; }
    public int MissingBomCount { get; set; }
    public int InvalidUnitCount { get; set; }
    public int MissingConversionCount { get; set; }
    public int NegativeStockCount { get; set; }
    public int OrphanDocumentCount { get; set; }
    public IReadOnlyList<DataQualityIssueDto> Issues { get; set; } = [];
}

public class DataQualityIssueDto
{
    public string IssueId { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public int PriorityRank { get; set; }
    public int SlaHours { get; set; }
    public DateTime SlaDueAt { get; set; }
    public string SlaLabel { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string EntityCode { get; set; } = string.Empty;
    public string EntityLabel { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string SuggestedAction { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string RemediationStatus { get; set; } = "open";
    public DateTime? RemediationAt { get; set; }
    public string? RemediationByName { get; set; }
    public string? RemediationNote { get; set; }
}

public class DataQualityIssueRemediationRequest
{
    public string IssueId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public class DataQualityIssueRemediationDto
{
    public string IssueId { get; set; } = string.Empty;
    public string RemediationStatus { get; set; } = string.Empty;
    public DateTime RemediationAt { get; set; }
    public string? Note { get; set; }
}

public class DataQualityCleanupRequest
{
    public bool DryRun { get; set; } = true;
    public int Limit { get; set; } = 100;
    public IReadOnlyList<string>? Categories { get; set; }
    public string? Note { get; set; }
}

public class DataQualityCleanupResultDto
{
    public bool DryRun { get; set; }
    public DateTime ExecutedAt { get; set; }
    public int TotalActions { get; set; }
    public int RemovedMaterialRequests { get; set; }
    public int RemovedMaterialRequestLines { get; set; }
    public int RemovedPurchaseRequests { get; set; }
    public int RemovedPurchaseRequestLines { get; set; }
    public int RemovedInventoryIssues { get; set; }
    public int RemovedInventoryIssueLines { get; set; }
    public int AuditLogCount { get; set; }
    public IReadOnlyList<DataQualityCleanupActionDto> Actions { get; set; } = [];
}

public class DataQualityCleanupActionDto
{
    public string Category { get; set; } = string.Empty;
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string EntityCode { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class WorkflowDocumentDto
{
    public string DocumentId { get; set; } = string.Empty;
    public string DocumentCode { get; set; } = string.Empty;
    public string DocumentType { get; set; } = string.Empty;
    public DateOnly DocumentDate { get; set; }
    public string? ShiftName { get; set; }
    public string Status { get; set; } = string.Empty;
    public string OwnerLane { get; set; } = string.Empty;
    public string Route { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
}

public class OrderExportReportRowDto
{
    public string QuantityPlanLineId { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string MenuName { get; set; } = string.Empty;
    public int ForecastServings { get; set; }
    public int ConfirmedServings { get; set; }
    public int FinalServings { get; set; }
    public decimal MenuPrice { get; set; }
    public decimal BomRatePercent { get; set; }
}
