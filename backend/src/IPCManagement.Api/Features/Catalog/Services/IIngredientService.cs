using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IIngredientService
{
    Task<PagedResponseDto<IngredientDto>> GetPagedAsync(PagedRequestDto request);
    Task<IngredientDto?>                 GetByIdAsync(string id);
    Task<IngredientDto>                  CreateAsync(CreateIngredientRequest dto);
    Task<IngredientDto?>                 UpdateAsync(string id, UpdateIngredientRequest dto);
    Task<bool>                           DeleteAsync(string id);
}
