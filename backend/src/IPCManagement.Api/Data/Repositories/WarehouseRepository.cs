using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class WarehouseRepository : IWarehouseRepository
{
    private readonly IpcManagementContext _context;

    public WarehouseRepository(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<(IEnumerable<Warehouse> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? searchKeyword = null)
    {
        var query = _context.Warehouses.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(searchKeyword))
        {
            var keyword = searchKeyword.Trim().ToLower();
            query = query.Where(warehouse => warehouse.WarehouseName.ToLower().Contains(keyword));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(warehouse => warehouse.WarehouseCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Warehouse?> GetByIdAsync(byte[] id)
        => await _context.Warehouses
            .AsNoTracking()
            .FirstOrDefaultAsync(warehouse => warehouse.WarehouseId == id);
}
