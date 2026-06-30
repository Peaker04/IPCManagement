namespace IPCManagement.Api.Models.DTOs.Coordination;

public class PortionRuleQueryDto
{
    public string? CustomerId { get; set; }
    public string? EffectiveDate { get; set; }
    public string? ShiftName { get; set; }
    public string? DishId { get; set; }
    public string? MenuVariant { get; set; }
    public string? SlotName { get; set; }
    public string? Status { get; set; }
}

public class PortionRuleDto
{
    public string PortionRuleId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string? DishId { get; set; }
    public string? DishCode { get; set; }
    public string? DishName { get; set; }
    public string EffectiveFrom { get; set; } = string.Empty;
    public string? EffectiveTo { get; set; }
    public IReadOnlyList<string> ActiveWeekDays { get; set; } = [];
    public IReadOnlyList<string> ShiftNames { get; set; } = [];
    public string? MenuVariant { get; set; }
    public string? MenuSectionName { get; set; }
    public string? SlotName { get; set; }
    public string? DishCategory { get; set; }
    public decimal PortionRatePercent { get; set; }
    public decimal? BomRatePercent { get; set; }
    public decimal? YieldLossPercent { get; set; }
    public int Priority { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string RuleSource { get; set; } = string.Empty;
}

public class CreatePortionRuleDto
{
    public string CustomerId { get; set; } = string.Empty;
    public string? DishId { get; set; }
    public string EffectiveFrom { get; set; } = string.Empty;
    public string? EffectiveTo { get; set; }
    public IReadOnlyList<string>? ActiveWeekDays { get; set; }
    public IReadOnlyList<string>? ShiftNames { get; set; }
    public string? MenuVariant { get; set; }
    public string? MenuSectionName { get; set; }
    public string? SlotName { get; set; }
    public string? DishCategory { get; set; }
    public decimal PortionRatePercent { get; set; }
    public decimal? BomRatePercent { get; set; }
    public decimal? YieldLossPercent { get; set; }
    public int? Priority { get; set; }
    public string? Status { get; set; }
    public string? Reason { get; set; }
}

public class UpdatePortionRuleDto
{
    public string? DishId { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? EffectiveTo { get; set; }
    public IReadOnlyList<string>? ActiveWeekDays { get; set; }
    public IReadOnlyList<string>? ShiftNames { get; set; }
    public string? MenuVariant { get; set; }
    public string? MenuSectionName { get; set; }
    public string? SlotName { get; set; }
    public string? DishCategory { get; set; }
    public decimal? PortionRatePercent { get; set; }
    public decimal? BomRatePercent { get; set; }
    public decimal? YieldLossPercent { get; set; }
    public int? Priority { get; set; }
    public string? Status { get; set; }
    public string? Reason { get; set; }
}

public class ResolvePortionRuleDto
{
    public string CustomerId { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string? MenuVariant { get; set; }
    public string? MenuSectionName { get; set; }
    public string? SlotName { get; set; }
    public string? DishId { get; set; }
    public string? DishCategory { get; set; }
}

public class ResolvedPortionRuleDto
{
    public string? PortionRuleId { get; set; }
    public string Source { get; set; } = string.Empty;
    public decimal PortionRatePercent { get; set; }
    public decimal? BomRatePercent { get; set; }
    public decimal? YieldLossPercent { get; set; }
    public IReadOnlyList<string> Warnings { get; set; } = [];
}
