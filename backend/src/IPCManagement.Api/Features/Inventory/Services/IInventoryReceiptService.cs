using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IInventoryReceiptService
{
    Task<PagedResponseDto<InventoryReceiptDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryReceiptDto?> GetByIdAsync(string id);
    Task<InventoryReceiptCreatedDto?> CreateAsync(CreateInventoryReceiptRequest dto, string? userId);
    Task<InventoryReceiptCreatedDto?> CreateFromPurchaseRequestAsync(CreateInventoryReceiptFromPurchaseRequest dto, string? userId);
}
