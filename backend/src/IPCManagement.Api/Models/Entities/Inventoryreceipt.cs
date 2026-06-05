using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Inventoryreceipt
{
    public byte[] ReceiptId { get; set; } = null!;

    public string ReceiptCode { get; set; } = null!;

    public DateOnly ReceiptDate { get; set; }

    public byte[] WarehouseId { get; set; } = null!;

    public byte[] SupplierId { get; set; } = null!;

    public byte[]? PurchaseRequestId { get; set; }

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Inventoryreceiptline> Inventoryreceiptlines { get; set; } = new List<Inventoryreceiptline>();

    public virtual Purchaserequest? PurchaseRequest { get; set; }

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual Warehouse Warehouse { get; set; } = null!;
}
