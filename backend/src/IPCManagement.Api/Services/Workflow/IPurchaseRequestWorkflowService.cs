using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IPurchaseRequestWorkflowService
{
    Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default);

    Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandDto request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<SupplierEvidenceResultDto> GetSupplierEvidenceAsync(
        string requestId,
        string lineId,
        CancellationToken cancellationToken = default);

    Task UpdateLineSupplierAsync(
        string requestId,
        string lineId,
        UpdatePurchaseRequestLineSupplierDto request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default);
}
