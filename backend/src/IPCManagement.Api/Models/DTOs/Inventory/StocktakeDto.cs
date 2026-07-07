using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using IPCManagement.Api.Models.DTOs.Common;

namespace IPCManagement.Api.Models.DTOs.Inventory;

public class StocktakeDto
{
    public string StocktakeId { get; set; } = string.Empty;
    public string StocktakeCode { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public List<StocktakeLineDto> Lines { get; set; } = new();
}

public class StocktakeLineDto
{
    public string LineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal SystemQty { get; set; }
    public decimal? ActualQty { get; set; }
    public decimal? DiscrepancyQty { get; set; }
    public string? Reason { get; set; }
}

public class CreateStocktakeDto
{
    [Required]
    public string WarehouseId { get; set; } = string.Empty;

    public string? Notes { get; set; }

    /// <summary>
    /// Bắt buộc chọn nguyên liệu để kiểm kê. (Theo yêu cầu: bắt buộc phải chọn danh sách trước)
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "Phải chọn ít nhất 1 nguyên liệu để kiểm kê.")]
    public List<string> IngredientIds { get; set; } = new();
}

public class UpdateStocktakeLinesDto
{
    [Required]
    public List<UpdateStocktakeLineItemDto> Lines { get; set; } = new();
}

public class UpdateStocktakeLineItemDto
{
    [Required]
    public string LineId { get; set; } = string.Empty;

    [Required]
    [Range(0, double.MaxValue, ErrorMessage = "Tồn thực tế không được âm.")]
    public decimal ActualQty { get; set; }

    [MaxLength(1000)]
    public string? Reason { get; set; }
}

public class StocktakeFilterRequestDto : PagedRequestDto
{
    public string? WarehouseId { get; set; }
    public string? Status { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}
