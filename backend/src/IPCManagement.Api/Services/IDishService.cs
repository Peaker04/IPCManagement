using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;

namespace IPCManagement.Api.Services;

public interface IDishService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false);
    Task<BomCoverageReportDto> GetBomCoverageAsync();
    Task<BomValidationReportDto> GetBomValidationAsync();
    Task<MenuImportHistoryDto> GetMenuImportHistoryAsync();
    Task<SampleImportStatusDto> GetSampleImportStatusAsync();
    Task<string> BuildBomTemplateCsvAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default);
    Task<BomImportPreviewDto> PreviewBomImportAsync(Stream fileStream, BomImportPreviewRequestDto request, CancellationToken cancellationToken = default);
    Task<BomImportCommitResultDto> CommitBomImportAsync(Stream fileStream, BomImportCommitRequestDto request, string? userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId);
    Task<DishDto?>                  GetByIdAsync(string id);
    Task<DishDto>                   CreateAsync(CreateDishDto dto);
    Task<DishDto?>                  UpdateAsync(string id, UpdateDishDto dto);
    Task<bool>                      DeleteAsync(string id);
    Task<DishCatalogBomLineDto?>    AddBomLineAsync(string dishId, CreateDishBomLineDto dto);
    Task<DishCatalogBomLineDto?>    UpdateBomLineAsync(string dishId, string bomId, UpdateDishBomLineDto dto, string? userId);
    Task<bool>                      CloseBomLineAsync(string dishId, string bomId);
}
