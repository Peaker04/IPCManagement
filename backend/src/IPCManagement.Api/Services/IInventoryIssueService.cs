using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface IInventoryIssueService
{
    Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(InventoryIssueFilterRequestDto request);
    Task<InventoryIssueDto?> GetByIdAsync(string id);
    Task<InventoryIssueCreatedDto?> CreateAsync(CreateInventoryIssueRequest dto, string? userId);
    Task<InventoryIssueDto?> ConfirmReceiptAsync(string id, ConfirmInventoryIssueReceiptRequest dto, string? userId);
}
