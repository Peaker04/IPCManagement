using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface IInventoryReturnService
{
    Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(InventoryReturnFilterRequestDto request);
    Task<InventoryReturnDto?> GetByIdAsync(string id);
    Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnRequest dto, string? userId);
    Task<bool> ConfirmReceiptAsync(string id, ConfirmInventoryReturnReceiptRequest dto, string? userId);
}
