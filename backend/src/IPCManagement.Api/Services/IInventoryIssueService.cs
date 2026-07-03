using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface IInventoryIssueService
{
    Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(PagedRequestDto request);
    Task<InventoryIssueDto?> GetByIdAsync(string id);
    Task<InventoryIssueCreatedDto?> CreateAsync(CreateInventoryIssueDto dto, string? userId);
    Task<InventoryIssueDto?> ConfirmReceiptAsync(string id, ConfirmInventoryIssueReceiptDto dto, string? userId);
}
