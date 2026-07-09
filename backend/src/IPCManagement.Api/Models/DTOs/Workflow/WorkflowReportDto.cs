namespace IPCManagement.Api.Models.DTOs.Workflow;

public class WorkflowReportQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public string? CustomerId { get; set; }
    public string? WarehouseId { get; set; }
    public string? IngredientId { get; set; }
    public string? SupplierId { get; set; }
    public string? ShiftName { get; set; }
    public string? Format { get; set; }
    public string? CursorDate { get; set; }
    public string? CursorId { get; set; }
    public int Limit { get; set; } = 100;
    public string? Actor { get; set; }
    public string? BusinessArea { get; set; }
    public string? EntityName { get; set; }
    public string? FieldName { get; set; }
}

public class OperationalKpiSummaryDto
{
    public int ShortageCount { get; set; }
    public int LowStockCount { get; set; }
    public int OverduePurchaseRequestCount { get; set; }
    public int LateReceiptCount { get; set; }
    public int PendingKitchenConfirmationCount { get; set; }
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
    public string SupplierId { get; set; } = string.Empty;
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
    public int ReceiptCount { get; set; }
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
    public string PeriodLabel { get; set; } = string.Empty;
    public DateOnly PeriodStart { get; set; }
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
    public string IssueCode { get; set; } = string.Empty;
    public DateOnly IssueDate { get; set; }
    public string? ShiftName { get; set; }
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
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
}

public class DataQualityReportDto
{
    public DateTime GeneratedAt { get; set; }
    public int TotalIssues { get; set; }
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

public class DataQualityIssueRemediationRequestDto
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
