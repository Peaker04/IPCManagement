using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReceiptRepository : IGenericRepository<InventoryReceipt>
{
    Task<(IEnumerable<InventoryReceipt> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<InventoryReceipt?> GetByIdWithLinesAsync(byte[] id);
}
