namespace IPCManagement.Api.Models.DTOs.Coordination;

// ── BE-3.3: GET /api/meal-quantity-plans ────────────────────────────────────

public class MealQuantityPlanQueryDto
{
    /// <summary>Ngày phục vụ dạng yyyy-MM-dd.</summary>
    public string? ServiceDate { get; set; }

    /// <summary>Ngày trong tuần (t2…t7, cn).</summary>
    public string? DayOfWeek { get; set; }

    /// <summary>Lọc theo trạng thái kế hoạch: DRAFT, CONFIRMED, v.v.</summary>
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
