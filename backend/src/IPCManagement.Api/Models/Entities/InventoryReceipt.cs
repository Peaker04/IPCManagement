using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class InventoryReceipt
{
    public byte[] ReceiptId { get; set; } = null!;

    public string ReceiptCode { get; set; } = null!;

    public DateOnly ReceiptDate { get; set; }

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] SupplierId { get; set; } = null!;

    public byte[]? PurchaseRequestId { get; set; }

    // Immutable source for Receipt lifecycle commands. ReceiptLine only stores the
    // purchase-request source line, which is not enough to identify an order after
    // one request has been split across multiple purchase orders.
    public byte[]? PurchaseOrderId { get; set; }

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public string Status { get; set; } = "DRAFT";

    public string QualityStatus { get; set; } = "PENDING_INSPECTION";

    public byte[]? QualityCheckedBy { get; set; }

    public DateTime? QualityCheckedAt { get; set; }

    public long ConcurrencyVersion { get; set; }

    public byte[]? ManagerApprovedBy { get; set; }

    public DateTime? ManagerApprovedAt { get; set; }

    public string? ManagerApprovalReason { get; set; }

    public byte[]? PostedBy { get; set; }

    public DateTime? PostedAt { get; set; }

    public byte[]? RejectedBy { get; set; }

    public DateTime? RejectedAt { get; set; }

    public string? RejectionReason { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<InventoryReceiptLine> Inventoryreceiptlines { get; set; } = new List<InventoryReceiptLine>();

    public virtual PurchaseRequest? PurchaseRequest { get; set; }

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
