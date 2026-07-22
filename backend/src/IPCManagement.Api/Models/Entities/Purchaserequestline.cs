using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchaserequestline
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

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual ICollection<Inventoryreceiptline> Inventoryreceiptlines { get; set; } = new List<Inventoryreceiptline>();

    public virtual Materialrequestline MaterialRequestLine { get; set; } = null!;

    public virtual Purchaserequest PurchaseRequest { get; set; } = null!;

    public virtual Supplier? Supplier { get; set; }

    public virtual Unit Unit { get; set; } = null!;

    public virtual Purchaseorderline? Purchaseorderline { get; set; }
}
