using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface IInventoryReturnService
{
    Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryReturnDto?> GetByIdAsync(string id);
    Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnDto dto, string? userId);
}
