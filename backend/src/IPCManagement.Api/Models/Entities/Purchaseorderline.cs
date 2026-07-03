using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchaseorderline
{
    public byte[] PurchaseOrderLineId { get; set; } = null!;

    public byte[] PurchaseOrderId { get; set; } = null!;

    public byte[] PurchaseRequestLineId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal OrderedQty { get; set; }

    public decimal ReceivedQty { get; set; }

    public decimal UnitPrice { get; set; }

    public virtual Purchaseorder PurchaseOrder { get; set; } = null!;

    public virtual Purchaserequestline PurchaseRequestLine { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
