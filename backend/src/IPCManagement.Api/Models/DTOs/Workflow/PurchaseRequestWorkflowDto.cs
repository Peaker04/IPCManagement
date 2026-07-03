namespace IPCManagement.Api.Models.DTOs.Workflow;

public class GeneratePurchaseRequestFromDemandDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
}

public class PurchaseRequestWorkflowResultDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
    public string PurchaseRequestCode { get; set; } = string.Empty;
    public string MaterialRequestId { get; set; } = string.Empty;
    public string PurchaseForDate { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<PurchaseRequestWorkflowLineDto> Lines { get; set; } = [];
}

public class PurchaseRequestWorkflowLineDto
{
    public string PurchaseRequestLineId { get; set; } = string.Empty;
    public string MaterialRequestLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal PurchaseQty { get; set; }
    public decimal EstimatedUnitPrice { get; set; }
}
