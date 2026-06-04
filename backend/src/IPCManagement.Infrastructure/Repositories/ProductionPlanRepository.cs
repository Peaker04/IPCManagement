using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Domain.Entities;
using IPCManagement.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Infrastructure.Repositories;

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
            .Include(plan => plan.CreatedByNavigation)
            .Include(plan => plan.Productionplanlines)
                .ThenInclude(line => line.Dish)
            .FirstOrDefaultAsync(plan => plan.PlanId == id);
}
