using IPCManagement.Api.Features.SampleData.Contracts;

namespace IPCManagement.Api.Features.SampleData.Services;

public interface ISampleBomImportService
{
    Task<SampleDataImportResultDto> ImportAsync(
        SampleDataImportRequest request,
        CancellationToken cancellationToken = default);
}
