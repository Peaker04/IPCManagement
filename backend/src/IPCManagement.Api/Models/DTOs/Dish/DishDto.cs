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

/// <summary>Catalog món ăn dùng cho frontend menu/BOM integration.</summary>
public class DishCatalogDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string? DishType { get; set; }
    public string? DishGroup { get; set; }
    public bool IsActive { get; set; }
    public IReadOnlyList<string> MenuSlots { get; set; } = [];
    public IReadOnlyList<DishCatalogBomLineDto> BomLines { get; set; } = [];
}

/// <summary>Dòng BOM của catalog món ăn.</summary>
public class DishCatalogBomLineDto
{
    public string BomId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientCode { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitCode { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal GrossQtyPerServing { get; set; }
    public decimal WasteRatePercent { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public decimal ReferencePrice { get; set; }
}

/// <summary>Báo cáo độ phủ BOM của toàn bộ catalog món ăn.</summary>
public class BomCoverageReportDto
{
    public DateTime GeneratedAt { get; set; }
    public int TotalDishes { get; set; }
    public int CompleteDishes { get; set; }
    public int MissingBomDishes { get; set; }
    public int TotalBomLines { get; set; }
    public IReadOnlyList<BomCoverageDishDto> Dishes { get; set; } = [];
}

/// <summary>Trạng thái BOM của một món ăn.</summary>
public class BomCoverageDishDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string? DishType { get; set; }
    public string? DishGroup { get; set; }
    public int BomLineCount { get; set; }
    public bool HasBom { get; set; }
    public string Status { get; set; } = string.Empty;
    public string StatusLabel { get; set; } = string.Empty;
}

/// <summary>Báo cáo lỗi/thiếu sót BOM sau import hoặc chỉnh sửa catalog.</summary>
public class BomValidationReportDto
{
    public DateTime GeneratedAt { get; set; }
    public int TotalIssues { get; set; }
    public int MissingBomDishes { get; set; }
    public int MissingIngredientLines { get; set; }
    public int ZeroQuantityLines { get; set; }
    public int UnknownUnitLines { get; set; }
    public int MissingReferencePriceLines { get; set; }
    public IReadOnlyList<BomValidationIssueDto> Issues { get; set; } = [];
}

/// <summary>Một vấn đề phát hiện được trong BOM.</summary>
public class BomValidationIssueDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string? BomId { get; set; }
    public string? IngredientId { get; set; }
    public string? IngredientName { get; set; }
    public string IssueCode { get; set; } = string.Empty;
    public string Severity { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

/// <summary>Tín hiệu lịch sử import thực đơn/BOM gần nhất từ dữ liệu hiện có.</summary>
public class MenuImportHistoryDto
{
    public DateTime GeneratedAt { get; set; }
    public string? LastImportSource { get; set; }
    public string? LastImportFileOrBatch { get; set; }
    public DateTime? LastImportedAt { get; set; }
    public DateOnly? LatestMenuWeekStartDate { get; set; }
    public DateOnly? LatestMenuServiceDate { get; set; }
    public int DishCount { get; set; }
    public int MenuCount { get; set; }
    public int MenuScheduleCount { get; set; }
    public int BomLineCount { get; set; }
    public int BomAdjustedCount { get; set; }
    public DateTime? LastBomAdjustedAt { get; set; }
    public int MealQuantityImportBatchCount { get; set; }
    public int BomCreatedOrUpdatedCount { get; set; }
    public IReadOnlyList<string> Warnings { get; set; } = [];
}

/// <summary>Trạng thái các domain dữ liệu mẫu/import chính.</summary>
public class SampleImportStatusDto
{
    public DateTime GeneratedAt { get; set; }
    public string OverallStatus { get; set; } = string.Empty;
    public IReadOnlyList<SampleImportDomainStatusDto> Domains { get; set; } = [];
}

/// <summary>Trạng thái dữ liệu mẫu của một domain.</summary>
public class SampleImportDomainStatusDto
{
    public string Domain { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int RowCount { get; set; }
    public bool IsReady { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

/// <summary>Request DTO — thêm một dòng BOM cho món ăn.</summary>
public class CreateDishBomLineDto
{
    [Required]
    public string IngredientId { get; set; } = string.Empty;

    public string? UnitId { get; set; }

    [Range(0.000001, double.MaxValue)]
    public decimal GrossQtyPerServing { get; set; }

    [Range(0, 100)]
    public decimal WasteRatePercent { get; set; }

    public DateOnly? EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }
}

/// <summary>Request DTO — cập nhật một dòng BOM của món ăn.</summary>
public class UpdateDishBomLineDto
{
    public string? IngredientId { get; set; }

    public string? UnitId { get; set; }

    [Range(0.000001, double.MaxValue)]
    public decimal? GrossQtyPerServing { get; set; }

    [Range(0, 100)]
    public decimal? WasteRatePercent { get; set; }

    public DateOnly? EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }
}
