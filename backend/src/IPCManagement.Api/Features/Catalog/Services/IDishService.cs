using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishService
{
    Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request);
    Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false);
    Task<BomCoverageReportDto> GetBomCoverageAsync();
    Task<BomValidationReportDto> GetBomValidationAsync();
    Task<MenuImportHistoryDto> GetMenuImportHistoryAsync();
    Task<SampleImportStatusDto> GetSampleImportStatusAsync();
    Task<byte[]> BuildBomTemplateWorkbookAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default);
    Task<BomImportPreviewDto> PreviewBomImportAsync(Stream fileStream, BomImportPreviewRequestDto request, CancellationToken cancellationToken = default);
    Task<BomImportCommitResultDto> CommitBomImportAsync(Stream fileStream, BomImportCommitRequestDto request, string? userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId);
    Task<DishDto?>                  GetByIdAsync(string id);
    Task<DishDto>                   CreateAsync(CreateDishRequest dto);
    Task<DishDto?>                  UpdateAsync(string id, UpdateDishRequest dto);
    Task<bool>                      DeleteAsync(string id);
    Task<DishCatalogBomLineDto?>    AddBomLineAsync(string dishId, CreateDishBomLineRequest dto);
    Task<DishCatalogBomLineDto?>    UpdateBomLineAsync(string dishId, string bomId, UpdateDishBomLineRequest dto, string? userId);
    Task<bool>                      CloseBomLineAsync(string dishId, string bomId);
}
