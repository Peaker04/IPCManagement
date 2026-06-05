using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Ingredient;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Helpers.Mappers;

public static class IngredientMapper
{
    public static IngredientDto MapToDto(Ingredient e) => new()
    {
        IngredientId   = GuidHelper.ToGuidString(e.IngredientId),
        IngredientCode = e.IngredientCode,
        IngredientName = e.IngredientName,
        IsActive       = e.IsActive ?? true,
        IsFreshDaily   = e.IsFreshDaily,
        ReferencePrice = e.ReferencePrice,
        UnitId         = GuidHelper.ToGuidString(e.UnitId),
        UnitName       = e.Unit?.UnitName,
        WarehouseId    = GuidHelper.ToGuidString(e.WarehouseId),
        WarehouseName  = e.Warehouse?.WarehouseName
    };
}
