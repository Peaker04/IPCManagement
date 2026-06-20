namespace IPCManagement.Api.Models.DTOs.Workflow;

public class WorkflowReportQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public string? WarehouseId { get; set; }
    public string? IngredientId { get; set; }
    public string? SupplierId { get; set; }
    public string? ShiftName { get; set; }
    public string? Format { get; set; }
    public int Limit { get; set; } = 100;
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
    public string? RefTable { get; set; }
    public string? RefId { get; set; }
    public string? Reason { get; set; }
    public string? Note { get; set; }
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
    public decimal TotalRequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
}

public class PurchaseDemandReportDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
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
    public decimal UsedQty { get; set; }
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
