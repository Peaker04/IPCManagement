using System;

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

    public virtual Customer Customer { get; set; } = null!;
}
