using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Warehouse;

namespace IPCManagement.Application.Interfaces.Services;

public interface IWarehouseService
{
    Task<PagedResponseDto<WarehouseDto>> GetPagedAsync(PagedRequestDto request);
    Task<WarehouseDto?> GetByIdAsync(string id);
}
