using IPCManagement.Api.Features.Catalog.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishBomImportService
{
    Task<BomImportPreviewDto> PreviewAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken = default);

    Task<BomImportCommitResultDto> CommitAsync(
        Stream fileStream,
        BomImportCommitRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default);
}
