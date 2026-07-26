using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Portionrule
{
    public byte[] PortionRuleId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public byte[]? DishId { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public string? ActiveWeekDays { get; set; }

    public string? ShiftNames { get; set; }

    public string? MenuVariant { get; set; }

    public string? MenuSectionName { get; set; }

    public string? SlotName { get; set; }

    public string? DishCategory { get; set; }

    public decimal PortionRatePercent { get; set; }

    public decimal? BomRatePercent { get; set; }

    public decimal? YieldLossPercent { get; set; }

    public int Priority { get; set; }

    public string Status { get; set; } = "ACTIVE";

    public string Reason { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual Dish? Dish { get; set; }
}
