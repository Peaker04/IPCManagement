using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReturnRepository : IGenericRepository<Inventoryreturn>
{
    Task<(IEnumerable<Inventoryreturn> Items, int TotalCount)> GetPagedAsync(InventoryReturnFilterRequestDto request);
    Task<Inventoryreturn?> GetByIdWithLinesAsync(byte[] id);
    Task<Dictionary<string, decimal>> GetReturnedQuantitiesByIssueAsync(byte[] issueId);
}
