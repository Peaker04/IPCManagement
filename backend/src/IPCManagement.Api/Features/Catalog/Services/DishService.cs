using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed class DishService : IDishService
{
    private readonly IDishCatalogService _catalogService;
    private readonly IDishCatalogDiagnosticsService _diagnosticsService;
    private readonly IDishBomTemplateService _templateService;
    private readonly IDishBomImportService _importService;
    private readonly IDishBomService _bomService;

    public DishService(IDishRepository dishRepo, IpcManagementContext context, IMemoryCache cache)
        : this(
            dishRepo,
            context,
            cache,
            new DishCatalogService(dishRepo, context, cache),
            new DishCatalogDiagnosticsService(context),
            new DishBomTemplateService(context),
            new DishBomImportService(context, cache),
            new DishBomService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            new DishCatalogDiagnosticsService(context),
            new DishBomTemplateService(context),
            new DishBomImportService(context, cache),
            new DishBomService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            diagnosticsService,
            new DishBomTemplateService(context),
            new DishBomImportService(context, cache),
            new DishBomService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService,
        IDishBomTemplateService templateService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            diagnosticsService,
            templateService,
            new DishBomImportService(context, cache),
            new DishBomService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService,
        IDishBomTemplateService templateService,
        IDishBomImportService importService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            diagnosticsService,
            templateService,
            importService,
            new DishBomService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService,
        IDishBomTemplateService templateService,
        IDishBomImportService importService,
        IDishBomService bomService)
    {
        _ = dishRepo;
        _ = context;
        _ = cache;
        _catalogService = catalogService;
        _diagnosticsService = diagnosticsService;
        _templateService = templateService;
        _importService = importService;
        _bomService = bomService;
    }

    public Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request)
        => _catalogService.GetPagedAsync(request);

    public Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false)
        => _catalogService.GetCatalogAsync(includeInactive);

    public Task<BomCoverageReportDto> GetBomCoverageAsync() => _diagnosticsService.GetBomCoverageAsync();
    public Task<BomValidationReportDto> GetBomValidationAsync() => _diagnosticsService.GetBomValidationAsync();
    public Task<MenuImportHistoryDto> GetMenuImportHistoryAsync() => _diagnosticsService.GetMenuImportHistoryAsync();
    public Task<SampleImportStatusDto> GetSampleImportStatusAsync() => _diagnosticsService.GetSampleImportStatusAsync();

    public Task<byte[]> BuildBomTemplateWorkbookAsync(
        BomTemplateQueryDto query,
        CancellationToken cancellationToken = default)
        => _templateService.BuildAsync(query, cancellationToken);

    public Task<BomImportPreviewDto> PreviewBomImportAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken = default)
        => _importService.PreviewAsync(fileStream, request, cancellationToken);

    public Task<BomImportCommitResultDto> CommitBomImportAsync(
        Stream fileStream,
        BomImportCommitRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _importService.CommitAsync(fileStream, request, userId, cancellationToken);

    public Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId)
        => _bomService.GetBomLinesAsync(dishId);

    public Task<DishDto?> GetByIdAsync(string id) => _catalogService.GetByIdAsync(id);
    public Task<DishDto> CreateAsync(CreateDishRequest dto) => _catalogService.CreateAsync(dto);
    public Task<DishDto?> UpdateAsync(string id, UpdateDishRequest dto) => _catalogService.UpdateAsync(id, dto);
    public Task<bool> DeleteAsync(string id) => _catalogService.DeleteAsync(id);

    public Task<DishCatalogBomLineDto?> AddBomLineAsync(string dishId, CreateDishBomLineRequest dto)
        => _bomService.AddBomLineAsync(dishId, dto);

    public Task<DishCatalogBomLineDto?> UpdateBomLineAsync(
        string dishId,
        string bomId,
        UpdateDishBomLineRequest dto,
        string? userId)
        => _bomService.UpdateBomLineAsync(dishId, bomId, dto, userId);

    public Task<bool> CloseBomLineAsync(string dishId, string bomId)
        => _bomService.CloseBomLineAsync(dishId, bomId);
}
