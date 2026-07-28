using IPCManagement.Api.Features.Catalog.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishCatalogDiagnosticsService
{
    Task<BomCoverageReportDto> GetBomCoverageAsync();
    Task<BomValidationReportDto> GetBomValidationAsync();
    Task<MenuImportHistoryDto> GetMenuImportHistoryAsync();
    Task<SampleImportStatusDto> GetSampleImportStatusAsync();
}
