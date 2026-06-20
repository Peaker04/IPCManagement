using IPCManagement.Api.Models.DTOs.SampleData;

namespace IPCManagement.Api.Services.SampleData;

public interface ISampleDataImportService
{
    Task<SampleDataImportResultDto> ImportAsync(
        SampleDataImportRequestDto request,
        CancellationToken cancellationToken = default);
}
