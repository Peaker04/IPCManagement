namespace IPCManagement.Application.DTOs.ProductionPlan;

public class ProductionPlanLineDto
{
    public string PlanLineId { get; set; } = string.Empty;
    public string DishId { get; set; } = string.Empty;
    public string? DishName { get; set; }
    public string? ShiftName { get; set; }
    public int TotalServings { get; set; }
}
