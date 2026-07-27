using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IPurchaseReceivingService
{
    Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default);
}
