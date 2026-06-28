using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;

namespace IPCManagement.Api.Services;

public interface IDishService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync();
    Task<BomCoverageReportDto> GetBomCoverageAsync();
    Task<BomValidationReportDto> GetBomValidationAsync();
    Task<MenuImportHistoryDto> GetMenuImportHistoryAsync();
    Task<SampleImportStatusDto> GetSampleImportStatusAsync();
    Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId);
    Task<DishDto?>                  GetByIdAsync(string id);
    Task<DishDto>                   CreateAsync(CreateDishDto dto);
    Task<DishDto?>                  UpdateAsync(string id, UpdateDishDto dto);
    Task<bool>                      DeleteAsync(string id);
    Task<DishCatalogBomLineDto?>    AddBomLineAsync(string dishId, CreateDishBomLineDto dto);
    Task<DishCatalogBomLineDto?>    UpdateBomLineAsync(string dishId, string bomId, UpdateDishBomLineDto dto, string? userId);
    Task<bool>                      CloseBomLineAsync(string dishId, string bomId);
}
