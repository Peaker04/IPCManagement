using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Data.Repositories;

public interface IInventoryReceiptRepository : IGenericRepository<InventoryReceipt>
{
    Task<(IEnumerable<InventoryReceipt> Items, int TotalCount)> GetPagedAsync(InventoryReceiptFilterRequestDto request);
    Task<InventoryReceipt?> GetByIdWithLinesAsync(byte[] id);
}
