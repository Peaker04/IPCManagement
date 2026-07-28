using IPCManagement.Api.Features.Catalog.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishBomService
{
    Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId);
    Task<DishCatalogBomLineDto?> AddBomLineAsync(string dishId, CreateDishBomLineRequest dto);
    Task<DishCatalogBomLineDto?> UpdateBomLineAsync(
        string dishId,
        string bomId,
        UpdateDishBomLineRequest dto,
        string? userId);
    Task<bool> CloseBomLineAsync(string dishId, string bomId);
}
