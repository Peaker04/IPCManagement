namespace IPCManagement.Api.Models.DTOs.Supplier;

public class SupplierQuotationDto
{
    public string QuotationId { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string EffectiveFrom { get; set; } = string.Empty;
    public string? EffectiveTo { get; set; }
    public string? Note { get; set; }
    public bool IsActive { get; set; }
    public bool IsBestPrice { get; set; }
}

public class CreateSupplierQuotationDto
{
    public string SupplierId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string EffectiveFrom { get; set; } = string.Empty;
    public string? EffectiveTo { get; set; }
    public string? Note { get; set; }
}

public class UpdateSupplierQuotationDto
{
    public decimal UnitPrice { get; set; }
    public string EffectiveFrom { get; set; } = string.Empty;
    public string? EffectiveTo { get; set; }
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
}
