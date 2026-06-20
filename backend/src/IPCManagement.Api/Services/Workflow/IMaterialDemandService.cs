using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IMaterialDemandService
{
    Task<MaterialDemandResultDto?> GenerateAsync(
        GenerateMaterialDemandRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default);
}
