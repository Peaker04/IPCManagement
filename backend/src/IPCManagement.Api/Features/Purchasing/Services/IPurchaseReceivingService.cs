
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseReceivingService
{
    Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default);
}
