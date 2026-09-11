namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationBatchContributor
{
    public byte[] ContributorId { get; set; } = null!;
    public byte[] BatchLineId { get; set; } = null!;
    public byte[] MenuScheduleId { get; set; } = null!;
    public byte[] MealQuantityPlanLineId { get; set; } = null!;
    public byte[] DishBomId { get; set; } = null!;
    public decimal SourceQuantity { get; set; }
    public ReconciliationBatchLine BatchLine { get; set; } = null!;
}
