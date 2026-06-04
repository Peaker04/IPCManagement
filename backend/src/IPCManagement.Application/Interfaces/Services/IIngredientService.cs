using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Ingredient;

namespace IPCManagement.Application.Interfaces.Services;

public interface IIngredientService
{
    Task<PagedResponseDto<IngredientDto>> GetPagedAsync(PagedRequestDto request);
    Task<IngredientDto?>                 GetByIdAsync(string id);
    Task<IngredientDto>                  CreateAsync(CreateIngredientDto dto);
    Task<IngredientDto?>                 UpdateAsync(string id, UpdateIngredientDto dto);
    Task<bool>                           DeleteAsync(string id);
}
