using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface ICurrentStockRepository : IGenericRepository<Currentstock>
{
    Task<Currentstock?> GetByWarehouseAndIngredientAsync(byte[] warehouseId, byte[] ingredientId);
    Task<IEnumerable<Currentstock>> GetByWarehouseAsync(byte[] warehouseId);
    Task<bool> ExistsAsync(byte[] warehouseId, byte[] ingredientId);
}
