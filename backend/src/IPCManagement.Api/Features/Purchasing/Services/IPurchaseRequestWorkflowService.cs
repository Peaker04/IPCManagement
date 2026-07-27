
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseRequestWorkflowService
{
    Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default);

    Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<SupplierEvidenceResultDto> GetSupplierEvidenceAsync(
        string requestId,
        string lineId,
        CancellationToken cancellationToken = default);

    Task<PurchaseLineSupplierDecisionDto> ConfirmLineSupplierAsync(
        string requestId,
        string lineId,
        ConfirmPurchaseLineSupplierRequest request,
        string? userId,
        CancellationToken cancellationToken = default);

    Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default);
}
