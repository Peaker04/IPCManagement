namespace IPCManagement.Api.Models.DTOs.Coordination;

public class MenuScheduleQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DayOfWeek { get; set; }
    public string? WeekStartDate { get; set; }
    public string? ShiftName { get; set; }
    public string? CustomerId { get; set; }
}

public class MenuScheduleDto
{
    public string MenuScheduleId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string MenuId { get; set; } = string.Empty;
    public string MenuCode { get; set; } = string.Empty;
    public string MenuName { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string WeekStartDate { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string Shift { get; set; } = string.Empty;
    public string DayOfWeek { get; set; } = string.Empty;
    public decimal MenuPrice { get; set; }
    public decimal BomRatePercent { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<MenuScheduleDishDto> Dishes { get; set; } = [];
}

public class MenuScheduleDishDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string? DishGroup { get; set; }
    public string? DishType { get; set; }
    public int DisplayOrder { get; set; }
}
