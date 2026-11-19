using IPCManagement.Api.Features.Catalog.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishCatalogDiagnosticsService
{
    Task<BomCoverageReportDto> GetBomCoverageAsync(decimal? priceTier = null);
    Task<BomCoverageReportDto> GetMrxBomCoverageAsync(decimal? priceTier, DateOnly? effectiveDate);
    Task<BomValidationReportDto> GetBomValidationAsync();
    Task<MenuImportHistoryDto> GetMenuImportHistoryAsync();
    Task<SampleImportStatusDto> GetSampleImportStatusAsync();
}
