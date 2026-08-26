using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class QuantityImportBatch
{
    public byte[] ImportBatchId { get; set; } = null!;

    public string BatchCode { get; set; } = null!;

    public string? SourceCompanyName { get; set; }

    public string SourceType { get; set; } = null!;

    public byte[]? ImportedBy { get; set; }

    public DateTime ImportedAt { get; set; }

    public string Status { get; set; } = null!;

    public byte[]? MenuVersionId { get; set; }

    public string? ContentFingerprint { get; set; }

    public int? FingerprintFormatVersion { get; set; }

    public string? SourceLabel { get; set; }

    public virtual MenuVersion? MenuVersion { get; set; }

    public virtual User? ImportedByNavigation { get; set; }

    public virtual ICollection<MealQuantityPlan> Mealquantityplans { get; set; } = new List<MealQuantityPlan>();
}
