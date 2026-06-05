using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Quantityimportbatch
{
    public byte[] ImportBatchId { get; set; } = null!;

    public string BatchCode { get; set; } = null!;

    public string? SourceCompanyName { get; set; }

    public string SourceType { get; set; } = null!;

    public byte[]? ImportedBy { get; set; }

    public DateTime ImportedAt { get; set; }

    public string Status { get; set; } = null!;

    public virtual User? ImportedByNavigation { get; set; }

    public virtual ICollection<Mealquantityplan> Mealquantityplans { get; set; } = new List<Mealquantityplan>();
}
