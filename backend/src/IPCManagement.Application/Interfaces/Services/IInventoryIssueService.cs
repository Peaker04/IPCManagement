using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;

namespace IPCManagement.Application.Interfaces.Services;

public interface IInventoryIssueService
{
    Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryIssueDto?> GetByIdAsync(string id);
}
