using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Purchaserequest
{
    public byte[] PurchaseRequestId { get; set; } = null!;

    public string PurchaseRequestCode { get; set; } = null!;

    public DateOnly RequestDate { get; set; }

    public DateOnly PurchaseForDate { get; set; }

    public string? ShiftName { get; set; }

    public string Status { get; set; } = null!;

    public byte[] CreatedBy { get; set; } = null!;

    public byte[]? ApprovedBy { get; set; }

    public DateTime? ApprovedAt { get; set; }

    public virtual User? ApprovedByNavigation { get; set; }

    public virtual User CreatedByNavigation { get; set; } = null!;

    public virtual ICollection<Inventoryreceipt> Inventoryreceipts { get; set; } = new List<Inventoryreceipt>();

    public virtual ICollection<Purchaserequestline> Purchaserequestlines { get; set; } = new List<Purchaserequestline>();
}
