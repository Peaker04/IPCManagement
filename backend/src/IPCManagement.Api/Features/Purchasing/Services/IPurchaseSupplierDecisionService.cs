using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseSupplierDecisionService
{
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
}
