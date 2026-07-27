using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryIssueRepository : IGenericRepository<InventoryIssue>
{
    Task<(IEnumerable<InventoryIssue> Items, int TotalCount)> GetPagedAsync(InventoryIssueFilterRequestDto request);
    Task<InventoryIssue?> GetByIdWithLinesAsync(byte[] id);
    Task<MaterialRequest?> GetMaterialRequestForIssueAsync(byte[] id);
    Task<IReadOnlyList<InventoryIssueLine>> GetIssuedLinesForMaterialRequestAsync(byte[] materialRequestId);
}
