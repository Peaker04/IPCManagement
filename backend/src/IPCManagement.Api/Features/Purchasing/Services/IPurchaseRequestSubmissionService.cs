using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseRequestSubmissionService
{
    Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default);
}
