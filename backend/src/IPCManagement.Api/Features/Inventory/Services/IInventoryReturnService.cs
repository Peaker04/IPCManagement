
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IInventoryReturnService
{
    Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(InventoryReturnFilterRequestDto request);
    Task<InventoryReturnDto?> GetByIdAsync(string id);
    Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnRequest dto, string? userId);
    Task<bool> ConfirmReceiptAsync(string id, ConfirmInventoryReturnReceiptRequest dto, string? userId);
}
