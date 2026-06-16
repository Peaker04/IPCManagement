using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class IngredientRepository : GenericRepository<Ingredient>, IIngredientRepository
{
    public IngredientRepository(IpcManagementContext context) : base(context) { }

    public async Task<Ingredient?> FindByCodeAsync(string ingredientCode)
        => await _dbSet
            .AsNoTracking()
            .Include(i => i.Unit)
            .Include(i => i.Warehouse)
            .FirstOrDefaultAsync(i => i.IngredientCode == ingredientCode);

    public async Task<bool> IsCodeExistsAsync(string code, byte[]? excludeId = null)
    {
        var query = _dbSet.Where(i => i.IngredientCode == code);
        if (excludeId is not null)
            query = query.Where(i => i.IngredientId != excludeId);
        return await query.AnyAsync();
    }

    public async Task<IEnumerable<Ingredient>> GetByWarehouseAsync(byte[] warehouseId)
        => await _dbSet
            .AsNoTracking()
            .Include(i => i.Unit)
            .Where(i => i.WarehouseId == warehouseId)
            .ToListAsync();

    public override async Task<(IEnumerable<Ingredient> Items, int TotalCount)> GetPagedAsync(
        int pageNumber, int pageSize, string? searchKeyword = null)
    {
        var query = _dbSet
            .AsNoTracking()
            .Include(i => i.Unit)
            .Include(i => i.Warehouse)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchKeyword))
        {
            var kw = searchKeyword.Trim().ToLower();
            query = query.Where(i =>
                i.IngredientName.ToLower().Contains(kw) ||
                i.IngredientCode.ToLower().Contains(kw));
        }

        var totalCount = await query.CountAsync();
        var items      = await query
            .OrderBy(i => i.IngredientCode)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }
}
