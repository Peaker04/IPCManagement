using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReturnRepository : IGenericRepository<Inventoryreturn>
{
    Task<(IEnumerable<Inventoryreturn> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Inventoryreturn?> GetByIdWithLinesAsync(byte[] id);
    Task<Dictionary<string, decimal>> GetReturnedQuantitiesByIssueAsync(byte[] issueId);
}
