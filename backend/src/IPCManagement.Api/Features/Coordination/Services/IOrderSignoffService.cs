using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public interface IOrderSignoffService
{
    Task<SignoffOrderResultDto?> SignoffOrderAsync(
        string quantityPlanId,
        SignoffOrderRequest request,
        string? userId);
    Task<CoordinationScopeActionResultDto?> SignoffOrderScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId);
}
