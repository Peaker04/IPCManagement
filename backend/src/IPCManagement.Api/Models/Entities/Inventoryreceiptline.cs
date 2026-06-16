using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Inventoryreceiptline
{
    public byte[] ReceiptLineId { get; set; } = null!;

    public byte[] ReceiptId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] UnitId { get; set; } = null!;

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal? Amount { get; set; }

    public string? LotNumber { get; set; }

    public DateOnly? ManufactureDate { get; set; }

    public DateOnly? ExpiredDate { get; set; }

    public virtual Ingredient Ingredient { get; set; } = null!;

    public virtual Inventoryreceipt Receipt { get; set; } = null!;

    public virtual Unit Unit { get; set; } = null!;
}
