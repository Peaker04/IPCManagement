using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class InventoryReceiptLine
{
    public byte[] ReceiptLineId { get; set; } = null!;

    public byte[] ReceiptId { get; set; } = null!;

    public byte[]? PurchaseRequestLineId { get; set; }

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal? Amount { get; set; }

    public decimal? AcceptedQuantity { get; set; }

    public decimal? RejectedQuantity { get; set; }

    public string? QualityReason { get; set; }

    public decimal? PackageQuantitySnapshot { get; set; }

    public byte[]? PackageBaseUnitIdSnapshot { get; set; }

    public string? PackagePolicyVersionSnapshot { get; set; }

    public string? LotNumber { get; set; }

    public DateOnly? ManufactureDate { get; set; }

    public DateOnly? ExpiredDate { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual InventoryReceipt Receipt { get; set; } = null!;

    public virtual PurchaseRequestLine? PurchaseRequestLine { get; set; }

    public virtual Unit Unit { get; set; } = null!;

    public virtual Unit? PackageBaseUnitSnapshot { get; set; }
}
