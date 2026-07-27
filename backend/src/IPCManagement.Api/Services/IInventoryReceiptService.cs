using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface IInventoryReceiptService
{
    Task<PagedResponseDto<InventoryReceiptDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryReceiptDto?> GetByIdAsync(string id);
    Task<InventoryReceiptCreatedDto?> CreateAsync(CreateInventoryReceiptRequest dto, string? userId);
    Task<InventoryReceiptCreatedDto?> CreateFromPurchaseRequestAsync(CreateInventoryReceiptFromPurchaseRequest dto, string? userId);
}
