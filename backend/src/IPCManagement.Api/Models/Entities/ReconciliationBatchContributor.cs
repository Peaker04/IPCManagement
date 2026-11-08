namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationBatchContributor
{
    public byte[] ContributorId { get; set; } = null!;
    public byte[] BatchLineId { get; set; } = null!;
    public byte[] MenuScheduleId { get; set; } = null!;
    public byte[] MealQuantityPlanLineId { get; set; } = null!;
    public byte[] DishBomId { get; set; } = null!;
    public byte[]? DailyLineId { get; set; }
    public byte[]? DishId { get; set; }
    public string? FrozenShiftName { get; set; }
    public string? FrozenDishCode { get; set; }
    public string? FrozenDishName { get; set; }
    public int? FrozenServings { get; set; }
    public decimal? FrozenBomQuantityPerServing { get; set; }
    public decimal? FrozenWasteRatePercent { get; set; }
    public decimal SourceQuantity { get; set; }
    public ReconciliationBatchLine BatchLine { get; set; } = null!;
    public ReconciliationBatchDailyLine? DailyLine { get; set; }
}
