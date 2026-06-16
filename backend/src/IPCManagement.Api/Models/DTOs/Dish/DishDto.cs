using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Models.DTOs.Dish;

/// <summary>Response DTO — trả ra ngoài client.</summary>
public class DishDto
{
    public string  DishId    { get; set; } = string.Empty;
    public string  DishCode  { get; set; } = string.Empty;
    public string  DishName  { get; set; } = string.Empty;
    public string? DishType  { get; set; }
    public string? DishGroup { get; set; }
    public bool    IsActive  { get; set; }
}

/// <summary>Request DTO — tạo mới món ăn.</summary>
public class CreateDishDto
{
    [Required]
    [MaxLength(50)]
    public string  DishCode  { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string  DishName  { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? DishType  { get; set; }

    [MaxLength(100)]
    public string? DishGroup { get; set; }
}

/// <summary>Request DTO — cập nhật món ăn.</summary>
public class UpdateDishDto
{
    [MaxLength(200)]
    public string? DishName  { get; set; }

    [MaxLength(100)]
    public string? DishType  { get; set; }

    [MaxLength(100)]
    public string? DishGroup { get; set; }

    public bool?   IsActive  { get; set; }
}
