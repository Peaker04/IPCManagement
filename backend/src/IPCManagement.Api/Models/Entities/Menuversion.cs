using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Menuversion
{
    public byte[] MenuVersionId { get; set; } = null!;

    public byte[] CustomerId { get; set; } = null!;

    public DateOnly WeekStartDate { get; set; }

    public int VersionNo { get; set; }

    public string Status { get; set; } = "DRAFT";

    public string? SourceFileName { get; set; }

    public string? SourceChecksum { get; set; }

    public string? SourceImportBatch { get; set; }

    public byte[]? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public byte[]? PublishedBy { get; set; }

    public DateTime? PublishedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public int SuccessRowCount { get; set; }

    public int ErrorRowCount { get; set; }

    public int WarningRowCount { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual ICollection<Menuschedule> Menuschedules { get; set; } = new List<Menuschedule>();
}
