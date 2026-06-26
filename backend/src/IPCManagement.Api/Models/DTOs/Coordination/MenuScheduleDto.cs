namespace IPCManagement.Api.Models.DTOs.Coordination;

// ── BE-3.2: GET /api/menu-schedules ─────────────────────────────────────────

public class MenuScheduleQueryDto
{
    /// <summary>Ngày phục vụ dạng yyyy-MM-dd. Nếu bỏ trống sẽ lấy tuần hiện tại.</summary>
    public string? ServiceDate { get; set; }

    /// <summary>Ngày trong tuần (t2…t7, cn). Ưu tiên sau ServiceDate.</summary>
    public string? DayOfWeek { get; set; }

    /// <summary>Bắt đầu tuần dạng yyyy-MM-dd (lọc theo weekStartDate).</summary>
    public string? WeekStartDate { get; set; }

    /// <summary>Ca phục vụ: MORNING hoặc AFTERNOON. Bỏ trống = lấy cả hai ca.</summary>
    public string? ShiftName { get; set; }
}

public class MenuScheduleDto
{
    public string MenuScheduleId { get; set; } = string.Empty;
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
