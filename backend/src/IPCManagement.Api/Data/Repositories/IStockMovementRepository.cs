using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IStockMovementRepository : IGenericRepository<Stockmovement>
{
    Task<IEnumerable<Stockmovement>> GetByIngredientAsync(byte[] ingredientId);
}
