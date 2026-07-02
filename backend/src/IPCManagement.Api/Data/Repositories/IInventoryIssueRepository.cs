using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryIssueRepository : IGenericRepository<Inventoryissue>
{
    Task<(IEnumerable<Inventoryissue> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Inventoryissue?> GetByIdWithLinesAsync(byte[] id);
    Task<Materialrequest?> GetMaterialRequestForIssueAsync(byte[] id);
    Task<IReadOnlyList<Inventoryissueline>> GetIssuedLinesForMaterialRequestAsync(byte[] materialRequestId);
}
