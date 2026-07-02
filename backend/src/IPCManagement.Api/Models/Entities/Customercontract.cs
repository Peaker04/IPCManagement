using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Customercontract
{
    public byte[] ContractId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public string ActiveWeekDays { get; set; } = string.Empty;

    public string ShiftNames { get; set; } = string.Empty;

    public decimal DefaultMenuPrice { get; set; }

    public decimal DefaultBomRatePercent { get; set; }

    public string Status { get; set; } = "ACTIVE";

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
