using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Dish;

namespace IPCManagement.Application.Interfaces.Services;

public interface IDishService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<DishDto?>                  GetByIdAsync(string id);
    Task<DishDto>                   CreateAsync(CreateDishDto dto);
    Task<DishDto?>                  UpdateAsync(string id, UpdateDishDto dto);
    Task<bool>                      DeleteAsync(string id);
}
