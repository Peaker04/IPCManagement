using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class StockMovementRepository : GenericRepository<Stockmovement>, IStockMovementRepository
{
    public StockMovementRepository(IpcManagementContext context) : base(context) { }

    public async Task<IEnumerable<Stockmovement>> GetByIngredientAsync(byte[] ingredientId)
    {
        return await _dbSet
            .AsNoTracking()
            .Where(s => s.IngredientId == ingredientId)
            .OrderByDescending(s => s.MovementDate)
            .ToListAsync();
    }
}
