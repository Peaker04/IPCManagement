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
    public string? MenuVersionId { get; set; }
    public int? MenuVersionNo { get; set; }
    public string? MenuVersionStatus { get; set; }
    public string? PublishedBy { get; set; }
    public string? PublishedAt { get; set; }
    public string? SourceImportBatch { get; set; }
    public IReadOnlyList<MenuScheduleDishDto> Dishes { get; set; } = [];
}

public class CustomerContractDto
{
    public string? ContractId { get; set; }
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? Note { get; set; }
    public bool IsActive { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? EffectiveTo { get; set; }
    public string ContractStatus { get; set; } = string.Empty;
    public int MenuScheduleCount { get; set; }
    public IReadOnlyList<string> ActiveWeekDays { get; set; } = [];
    public IReadOnlyList<string> ShiftNames { get; set; } = [];
    public decimal? DefaultMenuPrice { get; set; }
    public decimal? DefaultBomRatePercent { get; set; }
    public string? LatestServiceDate { get; set; }
}

public class UpdateCustomerContractDto
{
    public string? CustomerName { get; set; }
    public string? Note { get; set; }
    public bool? IsActive { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? EffectiveTo { get; set; }
    public IReadOnlyList<string>? ActiveWeekDays { get; set; }
    public IReadOnlyList<string>? ShiftNames { get; set; }
    public decimal? DefaultMenuPrice { get; set; }
    public decimal? DefaultBomRatePercent { get; set; }
}

public class CreateCustomerContractDto
{
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? Note { get; set; }
    public bool? IsActive { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? EffectiveTo { get; set; }
    public IReadOnlyList<string>? ActiveWeekDays { get; set; }
    public IReadOnlyList<string>? ShiftNames { get; set; }
    public decimal? DefaultMenuPrice { get; set; }
    public decimal? DefaultBomRatePercent { get; set; }
}

public class UpdateMenuScheduleRulesDto
{
    public decimal? MenuPrice { get; set; }
    public decimal? BomRatePercent { get; set; }
    public string? Status { get; set; }
    public string? Reason { get; set; }
}

public class UpdateMenuScheduleVersionDto
{
    public string Status { get; set; } = string.Empty;
    public string? Reason { get; set; }
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
