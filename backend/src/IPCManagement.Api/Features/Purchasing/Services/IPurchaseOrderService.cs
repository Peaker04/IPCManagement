
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public interface IPurchaseOrderService
{
    Task<IReadOnlyList<PurchaseOrderDto>> CreateFromApprovedRequestAsync(string purchaseRequestId, string? userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PurchaseOrderDto>> GetListAsync(string? status, CancellationToken cancellationToken = default);
    Task<PurchaseOrderPageDto> GetPageAsync(PurchaseOrderPageQueryDto query, CancellationToken cancellationToken = default);

    Task<PurchaseOrderDto?> GetByIdAsync(string purchaseOrderId, CancellationToken cancellationToken = default);

    Task<PurchaseOrderDto> CancelAsync(string purchaseOrderId, CancellationToken cancellationToken = default);
}
