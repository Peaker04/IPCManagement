using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Ingredient;

namespace IPCManagement.Api.Services;

public interface IIngredientService
{
    Task<PagedResponseDto<IngredientDto>> GetPagedAsync(PagedRequestDto request);
    Task<List<IngredientDto>>            GetLookupAsync();
    Task<IngredientDto?>                 GetByIdAsync(string id);
    Task<IngredientDto>                  CreateAsync(CreateIngredientDto dto);
    Task<IngredientDto?>                 UpdateAsync(string id, UpdateIngredientDto dto);
    Task<bool>                           DeleteAsync(string id);
}
