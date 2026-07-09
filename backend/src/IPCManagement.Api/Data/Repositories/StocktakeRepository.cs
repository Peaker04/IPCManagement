using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class StocktakeRepository : GenericRepository<Stocktake>, IStocktakeRepository
{
    public StocktakeRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IReadOnlyList<Stocktake>, int)> GetPagedAsync(StocktakeFilterRequestDto request)
    {
        var query = _context.Stocktakes
            .Include(s => s.Warehouse)
            .Include(s => s.CreatedByNavigation)
            .Include(s => s.ApprovedByNavigation)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.WarehouseId))
        {
            var warehouseBytes = GuidHelper.ParseGuidString(request.WarehouseId);
            if (warehouseBytes != null)
            {
                query = query.Where(s => s.WarehouseId == warehouseBytes);
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = query.Where(s => s.Status == request.Status);
        }

        if (request.FromDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt >= request.FromDate.Value);
        }

        if (request.ToDate.HasValue)
        {
            query = query.Where(s => s.CreatedAt <= request.ToDate.Value);
        }

        int totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(s => s.CreatedAt)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Stocktake?> GetByIdWithLinesAsync(byte[] id)
    {
        return await _context.Stocktakes
            .Include(s => s.Warehouse)
            .Include(s => s.CreatedByNavigation)
            .Include(s => s.ApprovedByNavigation)
            .Include(s => s.Stocktakelines)
                .ThenInclude(l => l.Ingredient)
            .Include(s => s.Stocktakelines)
                .ThenInclude(l => l.Unit)
            .FirstOrDefaultAsync(s => s.StocktakeId == id);
    }
}
