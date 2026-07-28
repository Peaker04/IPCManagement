
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Contracts;

public sealed class PurchasePlanPageQueryDto : WorkflowReportPageQueryDto
{
}

public class PurchasePlanReportDto
{
    public string PeriodKey { get; set; } = string.Empty;
    public string GroupBy { get; set; } = "day";
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public string IngredientId { get; set; } = string.Empty;
    public string? IngredientName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string? UnitName { get; set; }
    public decimal RequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal PendingReceiptQty { get; set; }
    public decimal ShortageQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
    public decimal EstimatedUnitPrice { get; set; }
    public decimal EstimatedAmount { get; set; }
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public DateOnly? ExpectedDeliveryDate { get; set; }
    public IReadOnlyList<string> Warnings { get; set; } = [];
}

public sealed class PurchasePlanPageDto
{
    public IReadOnlyList<PurchasePlanReportDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    public bool HasPrev => PageNumber > 1;
    public bool HasNext => PageNumber < TotalPages;
    public decimal TotalShortageQty { get; set; }
    public decimal TotalEstimatedAmount { get; set; }
}
