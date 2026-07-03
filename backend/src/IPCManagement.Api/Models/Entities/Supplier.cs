using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

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

    public virtual ICollection<Supplierquotation> Supplierquotations { get; set; } = new List<Supplierquotation>();

    public virtual ICollection<Purchaseorder> Purchaseorders { get; set; } = new List<Purchaseorder>();
}
