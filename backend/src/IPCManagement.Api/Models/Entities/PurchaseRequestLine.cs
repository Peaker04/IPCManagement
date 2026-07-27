using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class PurchaseRequestLine
{
    public byte[] PurchaseRequestLineId { get; set; } = null!;

    public byte[] PurchaseRequestId { get; set; } = null!;

    public byte[] MaterialRequestLineId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[]? SupplierId { get; set; }

    public byte[] UnitId { get; set; } = null!;

    public decimal RequiredQty { get; set; }

    public decimal CurrentStockQty { get; set; }

    public decimal PurchaseQty { get; set; }

    public decimal EstimatedUnitPrice { get; set; }

    public DateOnly? ExpectedDeliveryDate { get; set; }

    public string? Note { get; set; }

    public bool IsLegacySupplierSnapshot { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual ICollection<InventoryReceiptLine> Inventoryreceiptlines { get; set; } = new List<InventoryReceiptLine>();

    public virtual MaterialRequestLine MaterialRequestLine { get; set; } = null!;

    public virtual PurchaseRequest PurchaseRequest { get; set; } = null!;

    public virtual Supplier? Supplier { get; set; }

    public virtual Unit Unit { get; set; } = null!;

    public virtual PurchaseOrderLine? PurchaseOrderLine { get; set; }

    public virtual ICollection<PurchaseLineSupplierDecision> SupplierDecisions { get; set; } = new List<PurchaseLineSupplierDecision>();
}
