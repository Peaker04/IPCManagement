using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class CurrentStockRepository : GenericRepository<Currentstock>, ICurrentStockRepository
{
    public CurrentStockRepository(IpcManagementContext context) : base(context) { }

    public async Task<Currentstock?> GetByWarehouseAndIngredientAsync(byte[] warehouseId, byte[] ingredientId)
    {
        return await _dbSet
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .FirstOrDefaultAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }

    public async Task<IEnumerable<Currentstock>> GetByWarehouseAsync(byte[] warehouseId)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .Where(c => c.WarehouseId == warehouseId)
            .ToListAsync();
    }

    public async Task<bool> ExistsAsync(byte[] warehouseId, byte[] ingredientId)
    {
        return await _dbSet.AnyAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }
}
