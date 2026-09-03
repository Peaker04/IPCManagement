using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationMaterialProjection
{
    internal static IReadOnlyList<ProjectedSourceLine> Project(IReadOnlyList<MealQuantityPlanLine> sourceLines)
    {
        return sourceLines
            .OrderBy(source => source.QuantityPlan.ServiceDate)
            .ThenBy(source => source.ShiftName, StringComparer.Ordinal)
            .ThenBy(source => Convert.ToHexString(source.QuantityPlanLineId), StringComparer.Ordinal)
            .Select(ProjectLine)
            .ToList();
    }

    private static ProjectedSourceLine ProjectLine(MealQuantityPlanLine source)
    {
        var dishes = new List<ProjectedDish>();
        foreach (var menuItem in source.Menu.Menuitems
                     .OrderBy(item => item.DisplayOrder)
                     .ThenBy(item => Convert.ToHexString(item.MenuItemId), StringComparer.Ordinal)
                     .DistinctBy(item => Convert.ToHexString(item.DishId)))
        {
            var boms = BomSelectionResolver.Resolve(
                menuItem.Dish.Dishboms,
                source.CustomerId,
                source.MenuSchedule.MenuPrice,
                source.MenuSchedule.ServiceDate);
            if (boms.Count == 0)
                throw new BusinessRuleException($"Món '{menuItem.Dish.DishName}' chưa có BOM đã phát hành hợp lệ.");

            var materials = new List<ProjectedMaterial>();
            foreach (var bom in boms.OrderBy(item => Convert.ToHexString(item.BomId), StringComparer.Ordinal))
            {
                var converted = ReconciliationBatchService.ConvertToCanonical(
                    bom.GrossQtyPerServing * source.FinalServings,
                    bom.Unit,
                    bom.Ingredient.Unit);
                var persistedQuantity = decimal.Round(converted, 6, MidpointRounding.AwayFromZero);
                if (converted > 0 && persistedQuantity <= 0)
                    throw new BusinessRuleException($"Món '{menuItem.Dish.DishName}' có lượng nguyên liệu dương nhỏ hơn độ chính xác lưu trữ.");
                if (persistedQuantity <= 0) continue;
                materials.Add(new ProjectedMaterial(bom, persistedQuantity));
            }
            dishes.Add(new ProjectedDish(menuItem, materials));
        }
        return new ProjectedSourceLine(source, dishes);
    }
}

internal sealed record ProjectedSourceLine(MealQuantityPlanLine Source, IReadOnlyList<ProjectedDish> Dishes);
internal sealed record ProjectedDish(MenuItem MenuItem, IReadOnlyList<ProjectedMaterial> Materials);
internal sealed record ProjectedMaterial(DishBom Bom, decimal RequiredQuantity);
