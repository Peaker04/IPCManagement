using IPCManagement.Api.Features.Reconciliation.Services;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSourceDeltaProjectorTests
{
    [Fact]
    public void Project_returns_exact_positive_negative_and_new_ingredient_daily_deltas_as_source_changes()
    {
        var date = new DateOnly(2026, 10, 20);
        var existing = new[]
        {
            new ReconciliationRequiredFact("daily-beef", date, "beef", "kg", 10m),
            new ReconciliationRequiredFact("daily-rice", date, "rice", "kg", 5m),
        };
        var current = new[]
        {
            new ReconciliationCurrentRequirement(date, "beef", "kg", 12m),
            new ReconciliationCurrentRequirement(date, "carrot", "kg", 3m),
        };

        var deltas = ReconciliationSourceDeltaProjector.Project(existing, current);

        // BR-MRX-EDIT-8: MRX không có xuất thêm/trả hàng; chênh lệch nào cũng chỉ là thay đổi nguồn đã áp dụng.
        Assert.DoesNotContain(deltas, item => item.WorkKind is "SUPPLEMENTAL_ISSUE" or "RETURN_REQUIRED");

        Assert.Collection(deltas.OrderBy(item => item.IngredientId, StringComparer.Ordinal),
            item =>
            {
                Assert.Equal("beef", item.IngredientId);
                Assert.Equal("daily-beef", item.DailyLineId);
                Assert.Equal(10m, item.PreviousQuantity);
                Assert.Equal(12m, item.NewQuantity);
                Assert.Equal(2m, item.DeltaQuantity);
                Assert.Equal("SOURCE_CHANGE", item.WorkKind);
            },
            item =>
            {
                Assert.Equal("carrot", item.IngredientId);
                Assert.Null(item.DailyLineId);
                Assert.Equal(0m, item.PreviousQuantity);
                Assert.Equal(3m, item.NewQuantity);
                Assert.Equal(3m, item.DeltaQuantity);
                Assert.Equal("SOURCE_CHANGE", item.WorkKind);
            },
            item =>
            {
                Assert.Equal("rice", item.IngredientId);
                Assert.Equal("daily-rice", item.DailyLineId);
                Assert.Equal(5m, item.PreviousQuantity);
                Assert.Equal(0m, item.NewQuantity);
                Assert.Equal(-5m, item.DeltaQuantity);
                Assert.Equal("SOURCE_CHANGE", item.WorkKind);
            });
    }
}
