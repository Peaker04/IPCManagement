using IPCManagement.Api.Models.DTOs.SampleData;

namespace IPCManagement.Api.Services.SampleData;

public interface IPurchaseHistoryReconciliationService
{
    Task<PurchaseHistoryPreviewDto> PreviewAsync(CancellationToken cancellationToken = default);

    Task<PurchaseHistoryApplyResultDto> ApplyAsync(
        PurchaseHistoryApplyRequest request,
        byte[] appliedBy,
        CancellationToken cancellationToken = default);
}
