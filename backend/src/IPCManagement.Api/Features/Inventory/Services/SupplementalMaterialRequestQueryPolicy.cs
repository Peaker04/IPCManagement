using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class SupplementalMaterialRequestQueryPolicy
{
    internal static async Task<byte[]> ResolveCanonicalScopeAsync(
        IOperationalWarehouseResolver resolver,
        params string?[] suppliedIds)
    {
        var canonicalId = await resolver.ResolveAsync();
        foreach (var supplied in suppliedIds.Where(value => value is not null))
        {
            var suppliedId = GuidHelper.ParseGuidString(supplied)
                ?? throw new UnauthorizedAccessException("Phạm vi kho của người dùng không hợp lệ.");
            if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
                throw new UnauthorizedAccessException("Phạm vi kho không khớp kho vận hành của hệ thống.");
        }
        return canonicalId;
    }

    internal static async Task EnsureCanonicalWarehouseAsync(
        IOperationalWarehouseResolver resolver,
        byte[] sourceWarehouseId,
        string? scopedWarehouseId)
    {
        var canonicalId = await ResolveCanonicalScopeAsync(resolver, scopedWarehouseId);
        if (!sourceWarehouseId.AsSpan().SequenceEqual(canonicalId))
            throw new BusinessRuleException("Chứng từ nguồn không thuộc kho vận hành của hệ thống.");
    }

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
