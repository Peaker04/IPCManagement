using IPCManagement.Api.Models.DTOs.Workflow;

namespace IPCManagement.Api.Services.Workflow;

public interface IPurchaseOrderService
{
    Task<IReadOnlyList<PurchaseOrderDto>> CreateFromApprovedRequestAsync(string purchaseRequestId, string? userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PurchaseOrderDto>> GetListAsync(string? status, CancellationToken cancellationToken = default);

    Task<PurchaseOrderDto?> GetByIdAsync(string purchaseOrderId, CancellationToken cancellationToken = default);

    Task<PurchaseOrderDto> RecordReceiptAsync(string purchaseOrderId, RecordPurchaseOrderReceiptDto request, CancellationToken cancellationToken = default);

    Task<PurchaseOrderDto> CancelAsync(string purchaseOrderId, CancellationToken cancellationToken = default);
}
