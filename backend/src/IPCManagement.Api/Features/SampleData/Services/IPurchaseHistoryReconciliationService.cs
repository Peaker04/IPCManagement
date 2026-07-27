
using IPCManagement.Api.Features.SampleData.Contracts;

namespace IPCManagement.Api.Features.SampleData.Services;

public interface IPurchaseHistoryReconciliationService
{
    Task<PurchaseHistoryPreviewDto> PreviewAsync(CancellationToken cancellationToken = default);

    Task<PurchaseHistoryApplyResultDto> ApplyAsync(
        PurchaseHistoryApplyRequest request,
        byte[] appliedBy,
        CancellationToken cancellationToken = default);
}
