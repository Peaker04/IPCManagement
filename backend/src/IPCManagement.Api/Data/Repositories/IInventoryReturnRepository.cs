using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReturnRepository : IGenericRepository<InventoryReturn>
{
    Task<(IEnumerable<InventoryReturn> Items, int TotalCount)> GetPagedAsync(InventoryReturnFilterRequestDto request);
    Task<InventoryReturn?> GetByIdWithLinesAsync(byte[] id);
    Task<Dictionary<string, decimal>> GetReturnedQuantitiesByIssueAsync(byte[] issueId);
}
