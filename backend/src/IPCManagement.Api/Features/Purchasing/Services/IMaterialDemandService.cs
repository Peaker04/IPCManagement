
using IPCManagement.Api.Features.Planning.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IMaterialDemandService
{
    Task<MaterialDemandResultDto?> GenerateAsync(
        GenerateMaterialDemandRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<MaterialDemandStalenessDto> GetStalenessAsync(
        string serviceDate,
        string? customerId,
        string? scopeOrShift,
        CancellationToken cancellationToken = default);

    Task<MaterialDemandApprovalDto?> ApproveAsync(
        string materialRequestId,
        string? userId,
        string? reason,
        CancellationToken cancellationToken = default);
}
