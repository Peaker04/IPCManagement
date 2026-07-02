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
        Quantity = DecimalPolicy.RoundQuantity(line.Quantity),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName,
        UnitPrice = DecimalPolicy.RoundMoney(line.UnitPrice),
        Amount = DecimalPolicy.RoundMoney(line.Amount ?? 0),
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
        ReceivedAt = issue.ReceivedAt,
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
        RequestedQty = DecimalPolicy.RoundQuantity(line.RequestedQty),
        IssuedQty = DecimalPolicy.RoundQuantity(line.IssuedQty),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };

    public static InventoryReturnDto MapReturn(Inventoryreturn inventoryReturn, bool includeLines = false) => new()
    {
        ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
        ReturnCode = inventoryReturn.ReturnCode,
        ReturnDate = inventoryReturn.ReturnDate,
        ShiftName = inventoryReturn.ShiftName,
        WarehouseId = GuidHelper.ToGuidString(inventoryReturn.WarehouseId),
        WarehouseName = inventoryReturn.Warehouse?.WarehouseName,
        IssueId = GuidHelper.ToGuidString(inventoryReturn.IssueId),
        IssueCode = inventoryReturn.Issue?.IssueCode,
        Reason = inventoryReturn.Reason,
        CreatedBy = GuidHelper.ToGuidString(inventoryReturn.CreatedBy),
        CreatedByName = inventoryReturn.CreatedByNavigation?.FullName,
        CreatedAt = inventoryReturn.CreatedAt,
        Lines = includeLines
            ? inventoryReturn.Inventoryreturnlines.Select(MapReturnLine).ToList()
            : new List<InventoryReturnLineDto>()
    };

    public static InventoryReturnLineDto MapReturnLine(Inventoryreturnline line) => new()
    {
        ReturnLineId = GuidHelper.ToGuidString(line.ReturnLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        Quantity = DecimalPolicy.RoundQuantity(line.Quantity),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };
}
