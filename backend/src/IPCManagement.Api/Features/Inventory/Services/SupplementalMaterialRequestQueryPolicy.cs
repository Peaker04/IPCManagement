using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class SupplementalMaterialRequestQueryPolicy
{
    internal static IQueryable<SupplementalMaterialRequest> ApplySearch(
        IQueryable<SupplementalMaterialRequest> query,
        IpcManagementContext context,
        string? searchKeyword)
    {
        if (string.IsNullOrWhiteSpace(searchKeyword))
        {
            return query;
        }

        var keyword = searchKeyword.Trim();
        return query.Where(item =>
            item.RequestCode.Contains(keyword) ||
            item.Status.Contains(keyword) ||
            (item.Reason != null && item.Reason.Contains(keyword)) ||
            context.Ingredients.Any(ingredient =>
                ingredient.IngredientId.SequenceEqual(item.IngredientId) &&
                (ingredient.IngredientName.Contains(keyword) ||
                 ingredient.IngredientCode.Contains(keyword))));
    }
}
