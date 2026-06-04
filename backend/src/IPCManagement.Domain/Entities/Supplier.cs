using System;
using System.Collections.Generic;

namespace IPCManagement.Domain.Entities;

public partial class Supplier
{
    public byte[] SupplierId { get; set; } = null!;

    public string SupplierCode { get; set; } = null!;

    public string SupplierName { get; set; } = null!;

    public string? DebtPolicy { get; set; }

    public string? InvoicePolicy { get; set; }

    public string? ContactName { get; set; }

    public string? Phone { get; set; }

    public string? Address { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<Inventoryreceipt> Inventoryreceipts { get; set; } = new List<Inventoryreceipt>();

    public virtual ICollection<Purchaserequestline> Purchaserequestlines { get; set; } = new List<Purchaserequestline>();
}
