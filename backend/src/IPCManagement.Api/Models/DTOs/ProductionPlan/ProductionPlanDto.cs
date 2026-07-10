namespace IPCManagement.Api.Models.DTOs.ProductionPlan;

public class ProductionPlanDto
{
    public string PlanId { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public DateOnly PlanDate { get; set; }
    public string? CustomerId { get; set; }
    public string? CustomerCode { get; set; }
    public string? CustomerName { get; set; }
    public DateOnly? WeekStartDate { get; set; }
    public string? MenuVersionId { get; set; }
    public int? MenuVersionNo { get; set; }
    public string? MenuVersionStatus { get; set; }
    public string? Status { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentToKitchenAt { get; set; }
    public string? SentToKitchenBy { get; set; }
    public string? SentToKitchenByName { get; set; }
    public List<ProductionPlanLineDto> Lines { get; set; } = new();
}
