namespace IPCManagement.Api.Models.Entities;

// Technical lease for a purchase-order source line while its receipt is still
// actionable. The receipt lifecycle remains the audit record; this row only
// supplies a database-level uniqueness fence for concurrent draft creation.
public sealed class PurchaseReceiptActiveLine
{
    public byte[] PurchaseOrderLineId { get; set; } = null!;

    public byte[] ReceiptId { get; set; } = null!;

    public DateTime CreatedAt { get; set; }
}
