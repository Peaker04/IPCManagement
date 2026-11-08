namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed record ReconciliationRequiredFact(
    string DailyLineId,
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity);

public sealed record ReconciliationCurrentRequirement(
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity);

public sealed record ReconciliationProjectedDelta(
    string? DailyLineId,
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal PreviousQuantity,
    decimal NewQuantity,
    decimal DeltaQuantity,
    string WorkKind);

/// <summary>
/// Chênh lệch định lượng theo ngày × nguyên liệu giữa số đóng băng và nguồn mới.
/// BR-MRX-EDIT-8: MRX không có xuất thêm/trả hàng; mọi chênh lệch là <see cref="SourceChangeWorkKind"/>.
/// </summary>
public static class ReconciliationSourceDeltaProjector
{
    public const string SourceChangeWorkKind = "SOURCE_CHANGE";

    public static IReadOnlyList<ReconciliationProjectedDelta> Project(
        IEnumerable<ReconciliationRequiredFact> frozenFacts,
        IEnumerable<ReconciliationCurrentRequirement> currentRequirements)
    {
        var frozen = frozenFacts.ToDictionary(Key, item => item);
        var current = currentRequirements
            .GroupBy(Key)
            .ToDictionary(group => group.Key, group => decimal.Round(group.Sum(item => item.RequiredQuantity), 6, MidpointRounding.AwayFromZero));

        return frozen.Keys.Union(current.Keys)
            .OrderBy(key => key.ServiceDate)
            .ThenBy(key => key.IngredientId, StringComparer.Ordinal)
            .ThenBy(key => key.CanonicalUnitId, StringComparer.Ordinal)
            .Select(key =>
            {
                frozen.TryGetValue(key, out var oldFact);
                current.TryGetValue(key, out var newQuantity);
                var previousQuantity = oldFact?.RequiredQuantity ?? 0m;
                var delta = decimal.Round(newQuantity - previousQuantity, 6, MidpointRounding.AwayFromZero);
                return new ReconciliationProjectedDelta(
                    oldFact?.DailyLineId,
                    key.ServiceDate,
                    key.IngredientId,
                    key.CanonicalUnitId,
                    previousQuantity,
                    newQuantity,
                    delta,
                    SourceChangeWorkKind);
            })
            .Where(item => item.DeltaQuantity != 0)
            .ToList();
    }

    private static (DateOnly ServiceDate, string IngredientId, string CanonicalUnitId) Key(ReconciliationRequiredFact item)
        => (item.ServiceDate, item.IngredientId, item.CanonicalUnitId);

    private static (DateOnly ServiceDate, string IngredientId, string CanonicalUnitId) Key(ReconciliationCurrentRequirement item)
        => (item.ServiceDate, item.IngredientId, item.CanonicalUnitId);
}
