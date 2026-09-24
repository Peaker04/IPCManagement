using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Data.Repositories;

public class InventoryReceiptRepository : GenericRepository<InventoryReceipt>, IInventoryReceiptRepository
{
    public InventoryReceiptRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IEnumerable<InventoryReceipt> Items, int TotalCount)> GetPagedAsync(
        InventoryReceiptFilterRequestDto request)
    {
        var (pageNumber, pageSize) = NormalizePaging(request.PageNumber, request.PageSize);

        var query = _context.Inventoryreceipts
            .AsNoTracking()
            .Include(receipt => receipt.Supplier)
            .Include(receipt => receipt.Warehouse)
            .Include(receipt => receipt.CreatedByNavigation)
            .AsQueryable();

        if (request.PurchaseOrderOnly)
            query = query.Where(receipt => receipt.PurchaseOrderId != null);
        if (!string.IsNullOrWhiteSpace(request.PurchaseOrderId))
        {
            var purchaseOrderId = GuidHelper.ParseGuidString(request.PurchaseOrderId)
                ?? throw new ArgumentException("PurchaseOrderId không hợp lệ.", nameof(request));
            query = query.Where(receipt => receipt.PurchaseOrderId == purchaseOrderId);
        }

        query = query.OrderByDescending(receipt => receipt.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<InventoryReceipt?> GetByIdWithLinesAsync(byte[] id)
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
