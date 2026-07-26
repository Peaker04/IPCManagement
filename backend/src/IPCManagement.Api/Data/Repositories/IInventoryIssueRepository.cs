using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryIssueRepository : IGenericRepository<Inventoryissue>
{
    Task<(IEnumerable<Inventoryissue> Items, int TotalCount)> GetPagedAsync(InventoryIssueFilterRequestDto request);
    Task<Inventoryissue?> GetByIdWithLinesAsync(byte[] id);
    Task<Materialrequest?> GetMaterialRequestForIssueAsync(byte[] id);
    Task<IReadOnlyList<Inventoryissueline>> GetIssuedLinesForMaterialRequestAsync(byte[] materialRequestId);
}
