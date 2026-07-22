using IPCManagement.Api.Models.DTOs.SampleData;

namespace IPCManagement.Api.Services.SampleData;

public interface IPurchaseHistoryReconciliationService
{
    Task<PurchaseHistoryPreviewDto> PreviewAsync(CancellationToken cancellationToken = default);
}
