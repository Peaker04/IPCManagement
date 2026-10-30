using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationMaterialProjection
{
    internal static IReadOnlyList<ProjectedSourceLine> Project(IReadOnlyList<MealQuantityPlanLine> sourceLines)
    {
        var result = Inspect(sourceLines);
        if (result.Diagnostics.Count > 0)
            throw new BusinessRuleException(string.Join(" ", result.Diagnostics));
        return result.Lines;
    }

    internal static ReconciliationMaterialProjectionResult Inspect(IReadOnlyList<MealQuantityPlanLine> sourceLines)
    {
        var diagnostics = new List<string>();
        var lines = sourceLines
            .OrderBy(source => source.QuantityPlan.ServiceDate)
            .ThenBy(source => source.ShiftName, StringComparer.Ordinal)
            .ThenBy(source => Convert.ToHexString(source.QuantityPlanLineId), StringComparer.Ordinal)
            .Select(source => ProjectLine(source, diagnostics))
            .ToList();
        return new(lines, diagnostics.Distinct(StringComparer.Ordinal).ToList());
    }

    private static ProjectedSourceLine ProjectLine(MealQuantityPlanLine source, ICollection<string> diagnostics)
    {
        if (source.SavoryServings is not int savoryServings || source.VegetarianServings is not int vegetarianServings)
            throw new MrxSourceChangeException(
                MrxErrorCodes.ServingsSplitRequired,
                StatusCodes.Status422UnprocessableEntity,
                $"{source.QuantityPlan.ServiceDate:dd/MM/yyyy} · {ShiftLabel(source.ShiftName)}: chưa nhập đủ số suất Mặn và Chay. Cần nhập cả hai số suất trước khi tính định lượng.");

        var dishes = new List<ProjectedDish>();
        foreach (var (menuItem, variant) in source.Menu.Menuitems
                     .OrderBy(item => item.DisplayOrder)
                     .ThenBy(item => Convert.ToHexString(item.MenuItemId), StringComparer.Ordinal)
                     .Select(item => (Item: item, Variant: MenuVariantOf(item)))
                     .DistinctBy(entry => (entry.Variant, Convert.ToHexString(entry.Item.DishId))))
        {
            var servings = variant == VegetarianVariant ? vegetarianServings : savoryServings;
            var boms = BomSelectionResolver.Resolve(
                menuItem.Dish.Dishboms,
                source.CustomerId,
                source.MenuSchedule.MenuPrice,
                source.MenuSchedule.ServiceDate);
            if (boms.Count == 0)
            {
                diagnostics.Add($"{source.QuantityPlan.ServiceDate:dd/MM/yyyy} · {ShiftLabel(source.ShiftName)} · món '{menuItem.Dish.DishName}' chưa có định mức nguyên liệu phù hợp.");
                dishes.Add(new ProjectedDish(menuItem, variant, servings, []));
                continue;
            }

            var materials = new List<ProjectedMaterial>();
            foreach (var bom in boms.OrderBy(item => Convert.ToHexString(item.BomId), StringComparer.Ordinal))
            {
                var converted = ReconciliationBatchService.ConvertToCanonical(
                    bom.GrossQtyPerServing * servings,
                    bom.Unit,
                    bom.Ingredient.Unit);
                var persistedQuantity = decimal.Round(converted, 6, MidpointRounding.AwayFromZero);
                if (converted > 0 && persistedQuantity <= 0)
                {
                    diagnostics.Add($"{source.QuantityPlan.ServiceDate:dd/MM/yyyy} · {ShiftLabel(source.ShiftName)} · món '{menuItem.Dish.DishName}' có lượng nguyên liệu quá nhỏ để ghi nhận.");
                    continue;
                }
                if (persistedQuantity <= 0) continue;
                materials.Add(new ProjectedMaterial(bom, persistedQuantity));
            }
            dishes.Add(new ProjectedDish(menuItem, variant, servings, materials));
        }
        return new ProjectedSourceLine(source, dishes);
    }

    internal const string SavoryVariant = "savory";
    internal const string VegetarianVariant = "vegetarian";

    /// <summary>BR-MRX-SERV-1: slot <c>vegetarian-*</c> thuộc thực đơn chay; mọi slot khác thuộc thực đơn mặn.</summary>
    internal static string MenuVariantOf(MenuItem item) =>
        WeeklyMenuImportProjection.ParsePersistedDishSlot(item.DishSlot).VariantKey == VegetarianVariant
            ? VegetarianVariant
            : SavoryVariant;

    private static string ShiftLabel(string shift) => shift.Equals("MORNING", StringComparison.OrdinalIgnoreCase) ? "Ca sáng" : shift.Equals("AFTERNOON", StringComparison.OrdinalIgnoreCase) ? "Ca chiều" : shift;
}

internal sealed record ReconciliationMaterialProjectionResult(IReadOnlyList<ProjectedSourceLine> Lines, IReadOnlyList<string> Diagnostics);
internal sealed record ProjectedSourceLine(MealQuantityPlanLine Source, IReadOnlyList<ProjectedDish> Dishes);
internal sealed record ProjectedDish(MenuItem MenuItem, string MenuVariant, int Servings, IReadOnlyList<ProjectedMaterial> Materials);
internal sealed record ProjectedMaterial(DishBom Bom, decimal RequiredQuantity);
