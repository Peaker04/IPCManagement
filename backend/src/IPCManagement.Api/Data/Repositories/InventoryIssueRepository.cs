using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class InventoryIssueRepository : GenericRepository<Inventoryissue>, IInventoryIssueRepository
{
    public InventoryIssueRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IEnumerable<Inventoryissue> Items, int TotalCount)> GetPagedAsync(
        InventoryIssueFilterRequestDto request)
    {
        var (pageNumber, pageSize) = NormalizePaging(request.PageNumber, request.PageSize);

        var query = _context.Inventoryissues
            .AsNoTracking()
            .Include(issue => issue.Warehouse)
            .Include(issue => issue.IssuedByNavigation)
            .Include(issue => issue.ReceivedByNavigation)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(request.WarehouseId))
        {
            var warehouseBytes = IPCManagement.Api.Helpers.GuidHelper.ParseGuidString(request.WarehouseId);
            if (warehouseBytes is not null)
            {
                query = query.Where(i => i.WarehouseId == warehouseBytes);
            }
        }

        if (request.IssueDate.HasValue)
        {
            query = query.Where(i => i.IssueDate == request.IssueDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.ShiftName))
        {
            query = query.Where(i => i.ShiftName == request.ShiftName);
        }

        if (request.IsReceived.HasValue)
        {
            if (request.IsReceived.Value)
            {
                query = query.Where(i => i.ReceivedAt != null);
            }
            else
            {
                query = query.Where(i => i.ReceivedAt == null);
            }
        }

        query = query.OrderByDescending(issue => issue.CreatedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Inventoryissue?> GetByIdWithLinesAsync(byte[] id)
        => await _context.Inventoryissues
            .AsNoTracking()
            .Include(issue => issue.Warehouse)
            .Include(issue => issue.IssuedByNavigation)
            .Include(issue => issue.ReceivedByNavigation)
            .Include(issue => issue.Inventoryissuelines)
                .ThenInclude(line => line.Ingredient)
            .Include(issue => issue.Inventoryissuelines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(issue => issue.IssueId == id);

    public async Task<Materialrequest?> GetMaterialRequestForIssueAsync(byte[] id)
        => await _context.Materialrequests
            .Include(request => request.Materialrequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(request => request.Materialrequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(request => request.RequestId == id);

    public async Task<IReadOnlyList<Inventoryissueline>> GetIssuedLinesForMaterialRequestAsync(byte[] materialRequestId)
        => await _context.Inventoryissuelines
            .AsNoTracking()
            .Include(line => line.Issue)
            .Where(line => line.Issue.MaterialRequestId == materialRequestId)
            .ToListAsync();
}
