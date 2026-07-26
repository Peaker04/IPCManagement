using IPCManagement.Api.Models.DTOs.SampleData;

namespace IPCManagement.Api.Services.SampleData;

public interface IPurchaseHistoryReconciliationService
{
    Task<PurchaseHistoryPreviewDto> PreviewAsync(CancellationToken cancellationToken = default);

    Task<PurchaseHistoryApplyResultDto> ApplyAsync(
        PurchaseHistoryApplyRequestDto request,
        byte[] appliedBy,
        CancellationToken cancellationToken = default);
}
