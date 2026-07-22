namespace IPCManagement.Api.Models.DTOs.Workflow;

public class PurchaseOrderLineDto
{
    public string PurchaseOrderLineId { get; set; } = string.Empty;
    public string PurchaseRequestLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal OrderedQty { get; set; }
    public decimal ReceivedQty { get; set; }
    public decimal UnitPrice { get; set; }
    public bool LotNumberRequired { get; set; }
    public bool ManufactureDateRequired { get; set; }
    public bool ExpiryDateRequired { get; set; }
    public string? BlockerReason { get; set; }
}

public class PurchaseOrderDto
{
    public string PurchaseOrderId { get; set; } = string.Empty;
    public string PurchaseOrderCode { get; set; } = string.Empty;
    public string PurchaseRequestId { get; set; } = string.Empty;
    public string PurchaseRequestCode { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string OrderDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<PurchaseOrderLineDto> Lines { get; set; } = [];
}

public class CreatePurchaseOrdersFromRequestDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
}

public class RecordPurchaseOrderReceiptLineDto
{
    public string PurchaseOrderLineId { get; set; } = string.Empty;
    public decimal ReceivedQty { get; set; }
}

public class RecordPurchaseOrderReceiptDto
{
    public string WarehouseId { get; set; } = string.Empty;
    public IReadOnlyList<RecordPurchaseOrderReceiptLineDto> Lines { get; set; } = [];
}
