namespace IPCManagement.Api.Models.DTOs.Coordination;

public class MealQuantityPlanQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DayOfWeek { get; set; }
    public string? WeekStartDate { get; set; }
    public string? ShiftName { get; set; }
    public string? Status { get; set; }
}

public class MealQuantityPlanDto
{
    public string QuantityPlanId { get; set; } = string.Empty;
    public string PlanCode { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string DayOfWeek { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ForecastReceivedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public IReadOnlyList<MealQuantityPlanLineDto> Lines { get; set; } = [];
}

public class MealQuantityPlanLineDto
{
    public string QuantityPlanLineId { get; set; } = string.Empty;
    public string MenuScheduleId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string MenuId { get; set; } = string.Empty;
    public string MenuCode { get; set; } = string.Empty;
    public string MenuName { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string Shift { get; set; } = string.Empty;
    public int ForecastServings { get; set; }
    public int ConfirmedServings { get; set; }
    public int AdjustedServings { get; set; }
    public int FinalServings { get; set; }
}
