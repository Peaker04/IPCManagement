using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class ProductionPlanRepository : IProductionPlanRepository
{
    private readonly IpcManagementContext _context;

    public ProductionPlanRepository(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<(IEnumerable<Productionplan> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize)
    {
        var query = _context.Productionplans
            .AsNoTracking()
            .Include(plan => plan.Customer)
            .Include(plan => plan.MenuVersion)
            .Include(plan => plan.CreatedByNavigation)
            .OrderByDescending(plan => plan.PlanDate)
            .AsQueryable();

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Productionplan?> GetByIdWithLinesAsync(byte[] id)
        => await _context.Productionplans
            .AsNoTracking()
            .Include(plan => plan.Customer)
            .Include(plan => plan.MenuVersion)
            .Include(plan => plan.CreatedByNavigation)
            .Include(plan => plan.Productionplanlines)
                .ThenInclude(line => line.Dish)
            .FirstOrDefaultAsync(plan => plan.PlanId == id);

    public async Task<IReadOnlyList<Productionplan>> GetFilteredAsync(
        DateOnly? serviceDate,
        byte[]? customerId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Productionplans
            .AsNoTracking()
            .Include(plan => plan.Customer)
            .Include(plan => plan.MenuVersion)
            .Include(plan => plan.CreatedByNavigation)
            .Include(plan => plan.Productionplanlines)
                .ThenInclude(line => line.Dish)
            .AsQueryable();

        if (serviceDate.HasValue)
        {
            query = query.Where(plan => plan.PlanDate == serviceDate.Value);
        }

        if (customerId is not null)
        {
            query = query.Where(plan => plan.CustomerId == customerId);
        }

        return await query
            .OrderByDescending(plan => plan.PlanDate)
            .ToListAsync(cancellationToken);
    }
}
