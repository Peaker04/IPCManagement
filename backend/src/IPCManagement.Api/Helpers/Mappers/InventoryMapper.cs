using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Helpers.Mappers;

public static class InventoryMapper
{
    public static InventoryReceiptDto MapReceipt(Inventoryreceipt receipt, bool includeLines = false) => new()
    {
        ReceiptId = GuidHelper.ToGuidString(receipt.ReceiptId),
        ReceiptCode = receipt.ReceiptCode,
        ReceiptDate = receipt.ReceiptDate,
        SupplierId = GuidHelper.ToGuidString(receipt.SupplierId),
        SupplierName = receipt.Supplier?.SupplierName,
        WarehouseId = GuidHelper.ToGuidString(receipt.WarehouseId),
        WarehouseName = receipt.Warehouse?.WarehouseName,
        PurchaseRequestId = receipt.PurchaseRequestId is not null
            ? GuidHelper.ToGuidString(receipt.PurchaseRequestId)
            : null,
        CreatedBy = GuidHelper.ToGuidString(receipt.CreatedBy),
        CreatedByName = receipt.CreatedByNavigation?.FullName,
        CreatedAt = receipt.CreatedAt,
        Lines = includeLines
            ? receipt.Inventoryreceiptlines.Select(MapReceiptLine).ToList()
            : new List<InventoryReceiptLineDto>()
    };

    public static InventoryReceiptLineDto MapReceiptLine(Inventoryreceiptline line) => new()
    {
        ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        Quantity = line.Quantity,
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName,
        UnitPrice = line.UnitPrice,
        Amount = line.Amount ?? 0,
        LotNumber = line.LotNumber,
        ManufactureDate = line.ManufactureDate,
        ExpiredDate = line.ExpiredDate
    };

    public static InventoryIssueDto MapIssue(Inventoryissue issue, bool includeLines = false) => new()
    {
        IssueId = GuidHelper.ToGuidString(issue.IssueId),
        IssueCode = issue.IssueCode,
        IssueDate = issue.IssueDate,
        ShiftName = issue.ShiftName,
        WarehouseId = GuidHelper.ToGuidString(issue.WarehouseId),
        WarehouseName = issue.Warehouse?.WarehouseName,
        MaterialRequestId = GuidHelper.ToGuidString(issue.MaterialRequestId),
        IssuedBy = GuidHelper.ToGuidString(issue.IssuedBy),
        IssuedByName = issue.IssuedByNavigation?.FullName,
        ReceivedBy = issue.ReceivedBy is not null ? GuidHelper.ToGuidString(issue.ReceivedBy) : null,
        ReceivedByName = issue.ReceivedByNavigation?.FullName,
        CreatedAt = issue.CreatedAt,
        Lines = includeLines
            ? issue.Inventoryissuelines.Select(MapIssueLine).ToList()
            : new List<InventoryIssueLineDto>()
    };

    public static InventoryIssueLineDto MapIssueLine(Inventoryissueline line) => new()
    {
        IssueLineId = GuidHelper.ToGuidString(line.IssueLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        RequestedQty = line.RequestedQty,
        IssuedQty = line.IssuedQty,
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };
}
