using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class InventoryReceiptRepository : GenericRepository<Inventoryreceipt>, IInventoryReceiptRepository
{
    public InventoryReceiptRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IEnumerable<Inventoryreceipt> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize)
    {
        var query = _context.Inventoryreceipts
            .AsNoTracking()
            .Include(receipt => receipt.Supplier)
            .Include(receipt => receipt.Warehouse)
            .Include(receipt => receipt.CreatedByNavigation)
            .OrderByDescending(receipt => receipt.CreatedAt)
            .AsQueryable();

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Inventoryreceipt?> GetByIdWithLinesAsync(byte[] id)
        => await _context.Inventoryreceipts
            .AsNoTracking()
            .Include(receipt => receipt.Supplier)
            .Include(receipt => receipt.Warehouse)
            .Include(receipt => receipt.CreatedByNavigation)
            .Include(receipt => receipt.Inventoryreceiptlines)
                .ThenInclude(line => line.Ingredient)
            .Include(receipt => receipt.Inventoryreceiptlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(receipt => receipt.ReceiptId == id);
}
