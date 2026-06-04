using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Interfaces.Repositories;

public interface IInventoryReceiptRepository
{
    Task<(IEnumerable<Inventoryreceipt> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Inventoryreceipt?> GetByIdWithLinesAsync(byte[] id);
    Task AddAsync(Inventoryreceipt receipt);
}
