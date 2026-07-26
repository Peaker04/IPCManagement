using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Supplierquotation
{
    public byte[] QuotationId { get; set; } = null!;

    public byte[] SupplierId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public decimal UnitPrice { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public string? Note { get; set; }

    public bool? IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual Ingredient Ingredient { get; set; } = null!;
}
