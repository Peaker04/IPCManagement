using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchaseorder
{
    public byte[] PurchaseOrderId { get; set; } = null!;

    public string PurchaseOrderCode { get; set; } = null!;

    public byte[] PurchaseRequestId { get; set; } = null!;

    public byte[] SupplierId { get; set; } = null!;

    public DateOnly OrderDate { get; set; }

    public string Status { get; set; } = "ORDERED";

    public byte[] CreatedBy { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Purchaserequest PurchaseRequest { get; set; } = null!;

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Purchaseorderline> Purchaseorderlines { get; set; } = new List<Purchaseorderline>();
}
