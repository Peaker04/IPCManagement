using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Application.DTOs.Ingredient;

/// <summary>Response DTO — trả ra ngoài client.</summary>
public class IngredientDto
{
    public string  IngredientId   { get; set; } = string.Empty;
    public string  IngredientCode { get; set; } = string.Empty;
    public string  IngredientName { get; set; } = string.Empty;
    public bool    IsActive       { get; set; }
    public bool?   IsFreshDaily   { get; set; }
    public decimal ReferencePrice { get; set; }
    public string  UnitId         { get; set; } = string.Empty;
    public string? UnitName       { get; set; }
    public string  WarehouseId    { get; set; } = string.Empty;
    public string? WarehouseName  { get; set; }
}

/// <summary>Request DTO — tạo mới nguyên liệu.</summary>
public class CreateIngredientDto
{
    [Required]
    [MaxLength(50)]
    public string  IngredientCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string  IngredientName { get; set; } = string.Empty;

    public bool    IsFreshDaily   { get; set; } = false;

    [Range(0, double.MaxValue)]
    public decimal ReferencePrice { get; set; } = 0;

    [Required]
    public string  UnitId         { get; set; } = string.Empty;

    [Required]
    public string  WarehouseId    { get; set; } = string.Empty;
}

/// <summary>Request DTO — cập nhật nguyên liệu.</summary>
public class UpdateIngredientDto
{
    [MaxLength(200)]
    public string? IngredientName { get; set; }

    public bool?   IsFreshDaily   { get; set; }

    [Range(0, double.MaxValue)]
    public decimal? ReferencePrice { get; set; }

    public string?  UnitId        { get; set; }
    public string?  WarehouseId   { get; set; }
    public bool?    IsActive      { get; set; }
}
