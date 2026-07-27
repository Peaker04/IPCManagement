using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Ingredient;

namespace IPCManagement.Api.Services;

public interface IIngredientService
{
    Task<PagedResponseDto<IngredientDto>> GetPagedAsync(PagedRequestDto request);
    Task<IngredientDto?>                 GetByIdAsync(string id);
    Task<IngredientDto>                  CreateAsync(CreateIngredientRequest dto);
    Task<IngredientDto?>                 UpdateAsync(string id, UpdateIngredientRequest dto);
    Task<bool>                           DeleteAsync(string id);
}
