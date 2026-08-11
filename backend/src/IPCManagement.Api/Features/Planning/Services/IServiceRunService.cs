using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Planning.Services;

public interface IServiceRunService
{
    Task<ServiceRunLifecycleProjectionDto?> GetProjectionAsync(string serviceRunId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> GetByPlanAsync(ServiceRunByPlanQuery query, CancellationToken cancellationToken = default);
    Task<PagedResponseDto<ServiceRunOperationalRowDto>> GetPageAsync(ServiceRunPageQuery query, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> OpenAsync(OpenServiceRunRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> StartAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> RecordActualServingsAsync(string serviceRunId, RecordActualServingsRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> ConfirmServiceAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> WaiveServiceConfirmationAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> ResolveVarianceAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> ResolveServingVarianceAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> DeclareVarianceAsync(string serviceRunId, DeclareServiceRunVarianceRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> ApproveVarianceWaiverAsync(string serviceRunId, string declarationId, ApproveServiceRunVarianceWaiverRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunLifecycleProjectionDto?> CloseAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default);
    Task<ServiceRunAdjustmentDto?> CreateAdjustmentAsync(string serviceRunId, CreateServiceRunAdjustmentRequest request, string? userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceRunAdjustmentDto>> GetAdjustmentsAsync(string serviceRunId, CancellationToken cancellationToken = default);
}
