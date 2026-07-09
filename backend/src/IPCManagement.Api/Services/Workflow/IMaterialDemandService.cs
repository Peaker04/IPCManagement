using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IMaterialDemandService
{
    Task<MaterialDemandResultDto?> GenerateAsync(
        GenerateMaterialDemandRequestDto request,
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
