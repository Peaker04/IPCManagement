namespace IPCManagement.Api.Models.DTOs.Coordination;

public class CoordinationOrderDto
{
    public string Id { get; set; } = string.Empty;
    public string QuantityPlanLineId { get; set; } = string.Empty;
    public string QuantityPlanId { get; set; } = string.Empty;
    public string MenuScheduleId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string MealType { get; set; } = string.Empty;
    public int ForecastQuantity { get; set; }
    public int ActualQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal AppliedRate { get; set; }
    public string SpecialNotes { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string DayOfWeek { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string Shift { get; set; } = string.Empty;
    public string MenuId { get; set; } = string.Empty;
    public string MenuCode { get; set; } = string.Empty;
    public string MenuName { get; set; } = string.Empty;
    public IReadOnlyList<CoordinationDishDto> Dishes { get; set; } = [];

    // Temporary compatibility for older frontend state. This must contain a real dish id,
    // never a menu id. New clients should use Dishes.
    public string DishId { get; set; } = string.Empty;
}

public class CoordinationDishDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
}

public class CoordinationOrdersQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DayOfWeek { get; set; }
    public string? ShiftName { get; set; }
    public string? Shift { get; set; }
}

public class LockOrderPlanRequestDto
{
    public string? ServiceDate { get; set; }
    public string? DayOfWeek { get; set; }
    public string? ShiftName { get; set; }
    public string? Shift { get; set; }
    public string Scope { get; set; } = "FULLDAY";
    public List<LockOrderPlanLineDto> Lines { get; set; } = [];
}

public class LockOrderPlanLineDto
{
    public string QuantityPlanLineId { get; set; } = string.Empty;
    public string OrderId { get; set; } = string.Empty;
    public int? ActualQuantity { get; set; }
    public int? FinalServings { get; set; }
}

public class LockOrderPlanResultDto
{
    public bool Success { get; set; }
    public DateTime LockedAt { get; set; }
    public string ServiceDate { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public IReadOnlyList<string> LockedShiftNames { get; set; } = [];
    public int LockedLineCount { get; set; }
}

public class AdjustOrderAfterLockRequestDto
{
    public string OrderId { get; set; } = string.Empty;
    public string QuantityPlanLineId { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public int NewValue { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class AdjustOrderAfterLockResultDto
{
    public bool Success { get; set; }
    public DateTime Timestamp { get; set; }
}

public class ExportOrderReportRequestDto
{
    public string? ServiceDate { get; set; }
    public string? DayOfWeek { get; set; }
    public string? ShiftName { get; set; }
    public string? Shift { get; set; }
    public string Format { get; set; } = "excel";
}

public class ExportOrderReportResultDto
{
    public bool Success { get; set; }
    public string DownloadUrl { get; set; } = string.Empty;
}
