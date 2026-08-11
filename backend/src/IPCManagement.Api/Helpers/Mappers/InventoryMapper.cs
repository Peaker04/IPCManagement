using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Helpers.Mappers;

public static class InventoryMapper
{
    public static InventoryReceiptDto MapReceipt(InventoryReceipt receipt, bool includeLines = false) => new()
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
        PurchaseOrderId = receipt.PurchaseOrderId is not null
            ? GuidHelper.ToGuidString(receipt.PurchaseOrderId)
            : null,
        CreatedBy = GuidHelper.ToGuidString(receipt.CreatedBy),
        CreatedByName = receipt.CreatedByNavigation?.FullName,
        CreatedAt = receipt.CreatedAt,
        Status = receipt.Status,
        QualityStatus = receipt.QualityStatus,
        QualityCheckedAt = receipt.QualityCheckedAt,
        ConcurrencyVersion = receipt.ConcurrencyVersion,
        ManagerApprovedAt = receipt.ManagerApprovedAt,
        PostedAt = receipt.PostedAt,
        Lines = includeLines
            ? receipt.Inventoryreceiptlines.Select(MapReceiptLine).ToList()
            : new List<InventoryReceiptLineDto>()
    };

    public static InventoryReceiptLineDto MapReceiptLine(InventoryReceiptLine line) => new()
    {
        ReceiptLineId = GuidHelper.ToGuidString(line.ReceiptLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        Quantity = DecimalPolicy.RoundQuantity(line.Quantity),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName,
        UnitPrice = DecimalPolicy.RoundMoney(line.UnitPrice),
        Amount = DecimalPolicy.RoundMoney(line.Amount ?? 0),
        AcceptedQuantity = line.AcceptedQuantity is null ? null : DecimalPolicy.RoundQuantity(line.AcceptedQuantity.Value),
        RejectedQuantity = line.RejectedQuantity is null ? null : DecimalPolicy.RoundQuantity(line.RejectedQuantity.Value),
        QualityReason = line.QualityReason,
        LotNumber = line.LotNumber,
        ManufactureDate = line.ManufactureDate,
        ExpiredDate = line.ExpiredDate
    };

    public static InventoryIssueDto MapIssue(InventoryIssue issue, bool includeLines = false) => new()
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

    public static InventoryIssueLineDto MapIssueLine(InventoryIssueLine line) => new()
    {
        IssueLineId = GuidHelper.ToGuidString(line.IssueLineId),
        MaterialRequestLineId = line.MaterialRequestLineId is null ? null : GuidHelper.ToGuidString(line.MaterialRequestLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        RequestedQty = DecimalPolicy.RoundQuantity(line.RequestedQty),
        IssuedQty = DecimalPolicy.RoundQuantity(line.IssuedQty),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };

    public static InventoryReturnDto MapReturn(InventoryReturn inventoryReturn, bool includeLines = false) => new()
    {
        ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
        ReturnCode = inventoryReturn.ReturnCode,
        ReturnDate = inventoryReturn.ReturnDate,
        ShiftName = inventoryReturn.ShiftName,
        ReturnType = inventoryReturn.ReturnType,
        WarehouseId = GuidHelper.ToGuidString(inventoryReturn.WarehouseId),
        WarehouseName = inventoryReturn.Warehouse?.WarehouseName,
        IssueId = GuidHelper.ToGuidString(inventoryReturn.IssueId),
        IssueCode = inventoryReturn.Issue?.IssueCode,
        Reason = inventoryReturn.Reason,
        CreatedBy = GuidHelper.ToGuidString(inventoryReturn.CreatedBy),
        CreatedByName = inventoryReturn.CreatedByNavigation?.FullName,
        CreatedAt = inventoryReturn.CreatedAt,
        Status = inventoryReturn.ReceivedAt.HasValue
            ? inventoryReturn.ReturnType == "WASTE" ? "RECORDED" : "RECEIVED"
            : "PENDING_RECEIPT",
        ReceivedBy = inventoryReturn.ReceivedBy is null ? null : GuidHelper.ToGuidString(inventoryReturn.ReceivedBy),
        ReceivedByName = inventoryReturn.ReceivedByNavigation?.FullName,
        ReceivedAt = inventoryReturn.ReceivedAt,
        Lines = includeLines
            ? inventoryReturn.Inventoryreturnlines.Select(MapReturnLine).ToList()
            : new List<InventoryReturnLineDto>()
    };

    public static InventoryReturnLineDto MapReturnLine(InventoryReturnLine line) => new()
    {
        ReturnLineId = GuidHelper.ToGuidString(line.ReturnLineId),
        SourceIssueLineId = line.SourceIssueLineId is null ? null : GuidHelper.ToGuidString(line.SourceIssueLineId),
        IngredientId = GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line.Ingredient?.IngredientName,
        Quantity = DecimalPolicy.RoundQuantity(line.Quantity),
        UnitId = GuidHelper.ToGuidString(line.UnitId),
        UnitName = line.Unit?.UnitName
    };
}
