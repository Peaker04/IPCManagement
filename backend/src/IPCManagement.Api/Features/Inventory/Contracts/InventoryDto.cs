using System.ComponentModel.DataAnnotations;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Contracts;

// ─── Inventory Receipt (Nhập kho) ─────────────────────────────────────────

public class InventoryReceiptDto
{
    public string   ReceiptId        { get; set; } = string.Empty;
    public string   ReceiptCode      { get; set; } = string.Empty;
    public DateOnly ReceiptDate      { get; set; }
    public string   SupplierId       { get; set; } = string.Empty;
    public string?  SupplierName     { get; set; }
    public string   WarehouseId      { get; set; } = string.Empty;
    public string?  WarehouseName    { get; set; }
    public string?  PurchaseRequestId { get; set; }
    public string?  PurchaseOrderId   { get; set; }
    public string   CreatedBy        { get; set; } = string.Empty;
    public string?  CreatedByName    { get; set; }
    public DateTime CreatedAt        { get; set; }
    public string Status { get; set; } = "DRAFT";
    public string QualityStatus { get; set; } = "PENDING_INSPECTION";
    public DateTime? QualityCheckedAt { get; set; }
    public long ConcurrencyVersion { get; set; }
    public DateTime? ManagerApprovedAt { get; set; }
    public DateTime? PostedAt { get; set; }

    public List<InventoryReceiptLineDto> Lines { get; set; } = new();
}

public class InventoryReceiptLineDto
{
    public string   ReceiptLineId  { get; set; } = string.Empty;
    public string   IngredientId   { get; set; } = string.Empty;
    public string?  IngredientName { get; set; }
    public decimal  Quantity       { get; set; }
    public string   UnitId         { get; set; } = string.Empty;
    public string?  UnitName       { get; set; }
    public decimal  UnitPrice      { get; set; }
    public decimal  Amount         { get; set; }
    public string?  LotNumber      { get; set; }
    public DateOnly? ManufactureDate { get; set; }
    public DateOnly? ExpiredDate   { get; set; }
    public decimal? AcceptedQuantity { get; set; }
    public decimal? RejectedQuantity { get; set; }
    public string? QualityReason { get; set; }
}

// ─── Create Inventory Receipt ────────────────────────────────────────────

public class CreateInventoryReceiptRequest
{
    [Required]
    public DateOnly ReceiptDate       { get; set; }

    [Required]
    public string   SupplierId        { get; set; } = string.Empty;

    [Required]
    public string   WarehouseId       { get; set; } = string.Empty;

    public string?  PurchaseRequestId { get; set; }

    [Required, MinLength(1)]
    public List<CreateInventoryReceiptLineRequest> Lines { get; set; } = new();
}

public class CreateInventoryReceiptLineRequest
{
    [Required]
    public string   IngredientId    { get; set; } = string.Empty;

    [Required, Range(0.000001, double.MaxValue)]
    public decimal  Quantity        { get; set; }

    [Required]
    public string   UnitId          { get; set; } = string.Empty;

    [Required, Range(0, double.MaxValue)]
    public decimal  UnitPrice       { get; set; }

    public string?  LotNumber       { get; set; }
    public DateOnly? ManufactureDate { get; set; }
    public DateOnly? ExpiredDate    { get; set; }
}

public class InventoryReceiptCreatedDto
{
    public string ReceiptId { get; set; } = string.Empty;
    public string ReceiptCode { get; set; } = string.Empty;
}

public class CreateInventoryReceiptFromPurchaseRequest
{
    [Required]
    public string PurchaseRequestId { get; set; } = string.Empty;

    [Required]
    public DateOnly ReceiptDate { get; set; }

    [Required]
    public string SupplierId { get; set; } = string.Empty;

    [Required]
    public string WarehouseId { get; set; } = string.Empty;

    [Required, MinLength(1)]
    public List<CreateInventoryReceiptFromPurchaseLineRequest> Lines { get; set; } = new();
}

public class CreateInventoryReceiptFromPurchaseLineRequest
{
    [Required]
    public string PurchaseRequestLineId { get; set; } = string.Empty;

    [Required]
    public string UnitId { get; set; } = string.Empty;

    [Required, Range(0.000001, double.MaxValue)]
    public decimal ReceivedQty { get; set; }

    public decimal? UnitPrice { get; set; }
    public string? LotNumber { get; set; }
    public DateOnly? ManufactureDate { get; set; }
    public DateOnly? ExpiredDate { get; set; }
}

// ─── Inventory Issue (Xuất kho) ─────────────────────────────────────────

public class InventoryIssueDto
{
    public string   IssueId           { get; set; } = string.Empty;
    public string   IssueCode         { get; set; } = string.Empty;
    public DateOnly IssueDate         { get; set; }
    public string?  ShiftName         { get; set; }
    public string   WarehouseId       { get; set; } = string.Empty;
    public string?  WarehouseName     { get; set; }
    public string   MaterialRequestId { get; set; } = string.Empty;
    public string   IssuedBy          { get; set; } = string.Empty;
    public string?  IssuedByName      { get; set; }
    public string?  ReceivedBy        { get; set; }
    public string?  ReceivedByName    { get; set; }
    public DateTime? ReceivedAt        { get; set; }
    public DateTime CreatedAt         { get; set; }

    public List<InventoryIssueLineDto> Lines { get; set; } = new();
}

public class InventoryIssueFilterRequestDto : PagedRequestDto
{
    public string? WarehouseId { get; set; }
    public DateOnly? IssueDate { get; set; }
    public string? ShiftName { get; set; }
    public bool? IsReceived { get; set; }
}

public class InventoryIssueLineDto
{
    public string   IssueLineId    { get; set; } = string.Empty;
    public string?  MaterialRequestLineId { get; set; }
    public string   IngredientId   { get; set; } = string.Empty;
    public string?  IngredientName { get; set; }
    public decimal  RequestedQty   { get; set; }
    public decimal  IssuedQty      { get; set; }
    public string   UnitId         { get; set; } = string.Empty;
    public string?  UnitName       { get; set; }
}

// ─── Create Inventory Issue ──────────────────────────────────────────────

public class CreateInventoryIssueRequest
{
    [Required]
    public DateOnly IssueDate { get; set; }

    public string? ShiftName { get; set; }

    [Required]
    public string WarehouseId { get; set; } = string.Empty;

    [Required]
    public string MaterialRequestId { get; set; } = string.Empty;

    public string? ReceivedBy { get; set; }

    public List<CreateInventoryIssueLineRequest> Lines { get; set; } = new();
}

public class CreateInventoryIssueLineRequest
{
    public string? MaterialRequestLineId { get; set; }

    [Required]
    public string IngredientId { get; set; } = string.Empty;

    [Required, Range(0.000001, double.MaxValue)]
    public decimal RequestedQty { get; set; }

    [Required, Range(0.000001, double.MaxValue)]
    public decimal IssuedQty { get; set; }

    [Required]
    public string UnitId { get; set; } = string.Empty;
}

public class InventoryIssueCreatedDto
{
    public string IssueId { get; set; } = string.Empty;
    public string IssueCode { get; set; } = string.Empty;
}

public class ConfirmInventoryIssueReceiptRequest
{
    public bool HasDiscrepancy { get; set; }

    [MaxLength(1000)]
    public string? DiscrepancyNote { get; set; }
}

public class StockShortageIssueDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    public string MaterialRequestCode { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public DateOnly IssueDate { get; set; }
    public IReadOnlyList<StockShortageLineDto> Lines { get; set; } = [];
    public string SuggestedAction { get; set; } = "Vui lòng tạo yêu cầu mua hàng (Purchase Request) bổ sung cho các nguyên liệu bị thiếu.";
}

public class StockShortageLineDto
{
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal AvailableQty { get; set; }
    public decimal MissingQty { get; set; }
}

// ─── Inventory Return (Trả nguyên liệu dư) ───────────────────────────────

public class InventoryReturnDto
{
    public string ReturnId { get; set; } = string.Empty;
    public string ReturnCode { get; set; } = string.Empty;
    public DateOnly ReturnDate { get; set; }
    public string? ShiftName { get; set; }
    public string ReturnType { get; set; } = "RETURN";
    public string WarehouseId { get; set; } = string.Empty;
    public string? WarehouseName { get; set; }
    public string IssueId { get; set; } = string.Empty;
    public string? IssueCode { get; set; }
    public string? Reason { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Status { get; set; } = "PENDING_RECEIPT";
    public string? ReceivedBy { get; set; }
    public string? ReceivedByName { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public long ConcurrencyVersion { get; set; }

    public List<InventoryReturnLineDto> Lines { get; set; } = new();
}

public class InventoryReturnLineDto
{
    public string ReturnLineId { get; set; } = string.Empty;
    public string? SourceIssueLineId { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public decimal Quantity { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
}

// ─── Create Inventory Return ─────────────────────────────────────────────

public class CreateInventoryReturnRequest
{
    [Required, MaxLength(128)]
    public string CommandId { get; set; } = string.Empty;

    [MaxLength(128)]
    public string? CorrelationId { get; set; }

    [MaxLength(128)]
    public string? CausationId { get; set; }

    [Required]
    public DateOnly ReturnDate { get; set; }

    public string? ShiftName { get; set; }

    public string ReturnType { get; set; } = "RETURN";

    [Required]
    public string WarehouseId { get; set; } = string.Empty;

    [Required]
    public string IssueId { get; set; } = string.Empty;

    public string? Reason { get; set; }

    [Required, MinLength(1)]
    public List<CreateInventoryReturnLineRequest> Lines { get; set; } = new();
}

public class CreateInventoryReturnLineRequest
{
    public string? SourceIssueLineId { get; set; }

    [Required]
    public string IngredientId { get; set; } = string.Empty;

    [Required, Range(0.000001, double.MaxValue)]
    public decimal Quantity { get; set; }

    [Required]
    public string UnitId { get; set; } = string.Empty;
}

public class InventoryReturnCreatedDto
{
    public string ReturnId { get; set; } = string.Empty;
    public string ReturnCode { get; set; } = string.Empty;
}

public class ConfirmInventoryReturnReceiptRequest
{
    [Required, MaxLength(128)]
    public string CommandId { get; set; } = string.Empty;

    [Range(0, 1)]
    public long ExpectedVersion { get; set; }

    [MaxLength(128)]
    public string? CorrelationId { get; set; }

    [MaxLength(128)]
    public string? CausationId { get; set; }

    public bool HasDiscrepancy { get; set; }

    [MaxLength(1000)]
    public string? DiscrepancyNote { get; set; }

    public List<ConfirmInventoryReturnLineRequest> AdjustedLines { get; set; } = new();
}

public class ConfirmInventoryReturnLineRequest
{
    [Required]
    public string ReturnLineId { get; set; } = string.Empty;

    [Required, Range(0, double.MaxValue)]
    public decimal NewQuantity { get; set; }
}

public class InventoryReturnFilterRequestDto : PagedRequestDto
{
    public string? WarehouseId { get; set; }
    public string? ShiftName { get; set; }
    public DateOnly? ReturnDate { get; set; }
    public bool? IsReceived { get; set; }
}

public sealed class InventoryReturnAllocationBalanceDto
{
    public string SourceIssueLineId { get; set; } = string.Empty;
    public string MaterialRequestLineId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string ShiftName { get; set; } = string.Empty;
    public decimal PriceTierAmount { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal IssuedQuantity { get; set; }
    public decimal KitchenAcknowledgedQuantity { get; set; }
    public decimal ReturnedQuantity { get; set; }
    public decimal WastedQuantity { get; set; }
    public decimal DisposedQuantity { get; set; }
    public decimal IncomingDispositionQuantity { get; set; }
    public decimal ExcessQuantity { get; set; }
    public long Version { get; set; }
    public string? DecisionId { get; set; }
    public string? DecisionReason { get; set; }
    public IReadOnlyList<string> AllowedActions { get; set; } = [];
}

public sealed class InventoryReturnAllocationBalanceQuery
{
    public string? CustomerId { get; set; }
    public DateOnly? ServiceDate { get; set; }
    public string? ShiftName { get; set; }
    public decimal? PriceTierAmount { get; set; }
}

public sealed class CreateInventoryAllocationDispositionRequest
{
    [Required]
    public string DecisionId { get; set; } = string.Empty;
    [Required]
    public string SourceIssueLineId { get; set; } = string.Empty;
    [Required]
    public string DestinationSourceLineId { get; set; } = string.Empty;
    [Range(0.000001, double.MaxValue)]
    public decimal Quantity { get; set; }
    [Required, MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;
    [Required, MaxLength(128)]
    public string CommandId { get; set; } = string.Empty;
    [Range(0, long.MaxValue)]
    public long ExpectedVersion { get; set; }
    [MaxLength(128)]
    public string? CorrelationId { get; set; }
    [MaxLength(128)]
    public string? CausationId { get; set; }
}

public sealed class InventoryAllocationDispositionDto
{
    public string AllocationDispositionId { get; set; } = string.Empty;
    public string SourceIssueLineId { get; set; } = string.Empty;
    public string DestinationSourceLineId { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public long Version { get; set; }
    public string? CorrelationId { get; set; }
    public string? CausationId { get; set; }
}
