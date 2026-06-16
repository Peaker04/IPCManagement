namespace IPCManagement.Api.Models.DTOs.ProductionPlan;

public class ProductionPlanDto
{
    public string PlanId { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public DateOnly PlanDate { get; set; }
    public string? Status { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ProductionPlanLineDto> Lines { get; set; } = new();
}
