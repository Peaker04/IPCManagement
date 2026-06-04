using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;

namespace IPCManagement.Application.Interfaces.Services;

public interface IInventoryReceiptService
{
    Task<PagedResponseDto<InventoryReceiptDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryReceiptDto?> GetByIdAsync(string id);
    Task<InventoryReceiptCreatedDto?> CreateAsync(CreateInventoryReceiptDto dto, string? userId);
}
