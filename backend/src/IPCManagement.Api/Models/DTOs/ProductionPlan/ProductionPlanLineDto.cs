namespace IPCManagement.Api.Models.DTOs.ProductionPlan;

public class ProductionPlanLineDto
{
    public string PlanLineId { get; set; } = string.Empty;
    public string DishId { get; set; } = string.Empty;
    public string? DishName { get; set; }
    public string? ShiftName { get; set; }
    public int TotalServings { get; set; }
    public decimal? PriceTierAmount { get; set; }
    public string? BomScope { get; set; }
    public decimal TotalRequiredQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
    public bool HasKitchenIssue { get; set; }
    public bool IsReceivedByKitchen { get; set; }
}

public class DailyProductionPlanDto
{
    public DateOnly ServiceDate { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public string? ShiftName { get; set; }
    public int TotalPlans { get; set; }
    public int SentPlans { get; set; }
    public int TotalDishes { get; set; }
    public int TotalServings { get; set; }
    public decimal TotalRequiredQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
    public IReadOnlyList<string> Warnings { get; set; } = [];
    public IReadOnlyList<ProductionPlanDto> Plans { get; set; } = [];
}

public class SendDailyProductionPlanRequestDto
{
    public string ServiceDate { get; set; } = string.Empty;
    public string? CustomerId { get; set; }
    public string? ShiftName { get; set; }
    public string? Reason { get; set; }
}
