using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;

namespace IPCManagement.Api.Services;

public interface IDishService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync();
    Task<DishDto?>                  GetByIdAsync(string id);
    Task<DishDto>                   CreateAsync(CreateDishDto dto);
    Task<DishDto?>                  UpdateAsync(string id, UpdateDishDto dto);
    Task<bool>                      DeleteAsync(string id);
}
