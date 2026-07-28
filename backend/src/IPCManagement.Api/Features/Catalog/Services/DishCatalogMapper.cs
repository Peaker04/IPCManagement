using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Catalog.Services;

internal static class DishCatalogMapper
{
    internal static DishDto ToDto(Dish dish) => new()
    {
        DishId = GuidHelper.ToGuidString(dish.DishId),
        DishCode = dish.DishCode,
        DishName = dish.DishName,
        DishType = dish.DishType,
        DishGroup = dish.DishGroup,
        IsActive = dish.IsActive ?? true
    };

    internal static DishCatalogDto ToCatalogDto(Dish dish) => new()
    {
        DishId = GuidHelper.ToGuidString(dish.DishId),
        DishCode = dish.DishCode,
        DishName = dish.DishName,
        DishType = dish.DishType,
        DishGroup = dish.DishGroup,
        IsActive = dish.IsActive ?? true,
        MenuSlots = dish.Menuitems
            .Where(item => !string.IsNullOrWhiteSpace(item.DishSlot))
            .OrderBy(item => item.DisplayOrder)
            .Select(item => item.DishSlot!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList(),
        BomLines = dish.Dishboms
            .Where(bom => bom.PriceTierAmount is 25000m or 30000m or 34000m)
            .OrderBy(bom => bom.Ingredient.IngredientName)
            .ThenBy(bom => bom.EffectiveFrom)
            .Select(ToBomLineDto)
            .ToList()
    };

    private static DishCatalogBomLineDto ToBomLineDto(DishBom bom)
    {
        var status = NormalizeBomStatus(bom.BomStatus);
        return new DishCatalogBomLineDto
        {
            BomId = GuidHelper.ToGuidString(bom.BomId),
            IngredientId = GuidHelper.ToGuidString(bom.IngredientId),
            IngredientCode = bom.Ingredient.IngredientCode,
            IngredientName = bom.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(bom.UnitId),
            UnitCode = bom.Unit.UnitCode,
            UnitName = bom.Unit.UnitName,
            CustomerId = bom.CustomerId is null ? null : GuidHelper.ToGuidString(bom.CustomerId),
            CustomerCode = bom.Customer?.CustomerCode,
            CustomerName = bom.Customer?.CustomerName,
            PriceTierAmount = bom.PriceTierAmount,
            BomScope = bom.CustomerId is null ? "global" : "customer",
            GrossQtyPerServing = bom.GrossQtyPerServing,
            WasteRatePercent = bom.WasteRatePercent,
            BomStatus = status,
            BomStatusLabel = status switch
            {
                "DRAFT" => "Draft",
                "ARCHIVED" => "Archived",
                _ => "Published"
            },
            EffectiveFrom = bom.EffectiveFrom,
            EffectiveTo = bom.EffectiveTo,
            ReferencePrice = bom.Ingredient.ReferencePrice
        };
    }

    private static string NormalizeBomStatus(string? status)
    {
        var value = string.IsNullOrWhiteSpace(status) ? "PUBLISHED" : status.Trim().ToUpperInvariant();
        return value switch
        {
            "DRAFT" or "PUBLISHED" or "ARCHIVED" => value,
            _ => throw new ArgumentException("Trạng thái BOM không hợp lệ.")
        };
    }
}
