using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class DishRepository : GenericRepository<Dish>, IDishRepository
{
    public DishRepository(IpcManagementContext context) : base(context) { }

    public async Task<Dish?> FindByCodeAsync(string dishCode)
        => await _dbSet
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.DishCode == dishCode);

    public async Task<bool> IsCodeExistsAsync(string code, byte[]? excludeId = null)
    {
        var query = _dbSet.Where(d => d.DishCode == code);
        if (excludeId is not null)
            query = query.Where(d => d.DishId != excludeId);
        return await query.AnyAsync();
    }

    public async Task<IEnumerable<Dish>> GetByGroupAsync(string dishGroup)
        => await _dbSet
            .AsNoTracking()
            .Where(d => d.DishGroup == dishGroup)
            .OrderBy(d => d.DishCode)
            .ToListAsync();

    public async Task<IReadOnlyList<Dish>> GetCatalogAsync()
        => await _dbSet
            .AsNoTracking()
            .Include(d => d.Dishboms)
                .ThenInclude(bom => bom.Ingredient)
            .Include(d => d.Dishboms)
                .ThenInclude(bom => bom.Unit)
            .Include(d => d.Menuitems)
            .Where(d => d.IsActive ?? true)
            .OrderBy(d => d.DishCode)
            .ToListAsync();

    public override async Task<(IEnumerable<Dish> Items, int TotalCount)> GetPagedAsync(
        int pageNumber, int pageSize, string? searchKeyword = null)
    {
        var query = _dbSet.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchKeyword))
        {
            var kw = searchKeyword.Trim().ToLower();
            query = query.Where(d =>
                d.DishName.ToLower().Contains(kw) ||
                d.DishCode.ToLower().Contains(kw));
        }

        var totalCount = await query.CountAsync();
        var items      = await query
            .OrderBy(d => d.DishCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }
}
