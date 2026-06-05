using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReceiptRepository : IGenericRepository<Inventoryreceipt>
{
    Task<(IEnumerable<Inventoryreceipt> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Inventoryreceipt?> GetByIdWithLinesAsync(byte[] id);
}
