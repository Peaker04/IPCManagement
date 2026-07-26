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

    public virtual ICollection<InventoryReceipt> Inventoryreceipts { get; set; } = new List<InventoryReceipt>();

    public virtual ICollection<PurchaseRequestLine> Purchaserequestlines { get; set; } = new List<PurchaseRequestLine>();

    public virtual ICollection<SupplierQuotation> Supplierquotations { get; set; } = new List<SupplierQuotation>();

    public virtual ICollection<PurchaseOrder> Purchaseorders { get; set; } = new List<PurchaseOrder>();
}
