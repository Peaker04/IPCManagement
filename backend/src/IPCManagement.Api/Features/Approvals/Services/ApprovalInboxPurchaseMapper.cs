using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalInboxPurchaseMapper
{
    public static ApprovalInboxMaterialDto MapMaterial(PurchaseRequestLine line)
        => new()
        {
            Name = line.Ingredient.IngredientName,
            Quantity = DecimalPolicy.RoundQuantity(line.PurchaseQty),
            Unit = line.Unit.UnitName
        };
}
