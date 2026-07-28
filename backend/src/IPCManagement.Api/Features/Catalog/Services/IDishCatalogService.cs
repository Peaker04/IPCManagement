using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishCatalogService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false);
    Task<DishDto?> GetByIdAsync(string id);
    Task<DishDto> CreateAsync(CreateDishRequest dto);
    Task<DishDto?> UpdateAsync(string id, UpdateDishRequest dto);
    Task<bool> DeleteAsync(string id);
}
