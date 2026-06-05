using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Warehouse;

namespace IPCManagement.Api.Services;

public interface IWarehouseService
{
    Task<PagedResponseDto<WarehouseDto>> GetPagedAsync(PagedRequestDto request);
    Task<WarehouseDto?> GetByIdAsync(string id);
}
