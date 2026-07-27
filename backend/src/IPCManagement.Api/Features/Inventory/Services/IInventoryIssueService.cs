
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IInventoryIssueService
{
    Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(InventoryIssueFilterRequestDto request);
    Task<InventoryIssueDto?> GetByIdAsync(string id);
    Task<InventoryIssueCreatedDto?> CreateAsync(CreateInventoryIssueRequest dto, string? userId);
    Task<InventoryIssueDto?> ConfirmReceiptAsync(string id, ConfirmInventoryIssueReceiptRequest dto, string? userId);
}
