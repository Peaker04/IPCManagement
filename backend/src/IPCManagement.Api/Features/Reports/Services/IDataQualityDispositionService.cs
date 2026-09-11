using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IDataQualityDispositionService
{
    Task<IReadOnlyList<DataQualityDispositionDto>> GetAsync(string? status, CancellationToken cancellationToken = default);
    Task<DataQualityDispositionDto> CreateAsync(CreateDataQualityDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
    Task<DataQualityDispositionDto> ReviewAsync(string dispositionId, ReviewDataQualityDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
    Task<DataQualityDispositionDto> ApplyAsync(string dispositionId, ApplyDataQualityDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
}
