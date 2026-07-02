using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IPurchaseRequestWorkflowService
{
    Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandDto request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task UpdateLineSupplierAsync(
        string requestId,
        string lineId,
        UpdatePurchaseRequestLineSupplierDto request,
        string? userId,
        CancellationToken cancellationToken = default);
}
