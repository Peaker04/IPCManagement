using System.ComponentModel.DataAnnotations;
using IPCManagement.Api.Models.DTOs.Common;

namespace IPCManagement.Api.Models.DTOs.Inventory;

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
    public string   CreatedBy        { get; set; } = string.Empty;
    public string?  CreatedByName    { get; set; }
    public DateTime CreatedAt        { get; set; }

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
}

// ─── Create Inventory Receipt ────────────────────────────────────────────

public class CreateInventoryReceiptDto
{
    [Required]
    public DateOnly ReceiptDate       { get; set; }

    [Required]
    public string   SupplierId        { get; set; } = string.Empty;

    [Required]
    public string   WarehouseId       { get; set; } = string.Empty;

    public string?  PurchaseRequestId { get; set; }

    [Required, MinLength(1)]
    public List<CreateInventoryReceiptLineDto> Lines { get; set; } = new();
}

public class CreateInventoryReceiptLineDto
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

public class CreateInventoryReceiptFromPurchaseDto
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
    public List<CreateInventoryReceiptFromPurchaseLineDto> Lines { get; set; } = new();
}

public class CreateInventoryReceiptFromPurchaseLineDto
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
    public string   IngredientId   { get; set; } = string.Empty;
    public string?  IngredientName { get; set; }
    public decimal  RequestedQty   { get; set; }
    public decimal  IssuedQty      { get; set; }
    public string   UnitId         { get; set; } = string.Empty;
    public string?  UnitName       { get; set; }
}

// ─── Create Inventory Issue ──────────────────────────────────────────────

public class CreateInventoryIssueDto
{
    [Required]
    public DateOnly IssueDate { get; set; }

    public string? ShiftName { get; set; }

    [Required]
    public string WarehouseId { get; set; } = string.Empty;

    [Required]
    public string MaterialRequestId { get; set; } = string.Empty;

    public string? ReceivedBy { get; set; }

    public List<CreateInventoryIssueLineDto> Lines { get; set; } = new();
}

public class CreateInventoryIssueLineDto
{
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

public class ConfirmInventoryIssueReceiptDto
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

    public List<InventoryReturnLineDto> Lines { get; set; } = new();
}

public class InventoryReturnLineDto
{
    public string ReturnLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public decimal Quantity { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
}

// ─── Create Inventory Return ─────────────────────────────────────────────

public class CreateInventoryReturnDto
{
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
    public List<CreateInventoryReturnLineDto> Lines { get; set; } = new();
}

public class CreateInventoryReturnLineDto
{
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
