using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IWarehouseService
{
    Task<PagedResponseDto<WarehouseDto>> GetPagedAsync(PagedRequestDto request);
    Task<WarehouseDto?> GetByIdAsync(string id);
}
