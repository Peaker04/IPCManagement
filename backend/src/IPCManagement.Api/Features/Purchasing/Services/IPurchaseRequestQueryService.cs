using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseRequestQueryService
{
    Task<IReadOnlyList<PurchaseRequestWorkflowResultDto>> GetPurchaseRequestsAsync(PurchaseRequestQueryDto query);
    Task<PagedResponseDto<PurchaseRequestWorkflowResultDto>> GetPurchaseRequestsPageAsync(PurchaseRequestQueryDto query);
    Task<PurchaseRequestWorkflowResultDto?> GetPurchaseRequestByIdAsync(byte[] purchaseRequestId);
}
