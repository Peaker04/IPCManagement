using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Immutable post-POST correction for a purchase receipt.  It never changes the
/// original receipt or its receipt movement; its own lines are the correction
/// document and its stock movements reference this aggregate.
/// </summary>
public partial class ReceiptCorrection
{
    public byte[] CorrectionId { get; set; } = null!;
    public byte[] ReceiptId { get; set; } = null!;
    public string CorrectionCode { get; set; } = null!;
    public string CommandId { get; set; } = null!;
    public string Status { get; set; } = "POSTED";
    public string Reason { get; set; } = null!;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public long ConcurrencyVersion { get; set; }
    public virtual ICollection<ReceiptCorrectionLine> Lines { get; set; } = new List<ReceiptCorrectionLine>();
}
