using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IIngredientRepository : IGenericRepository<Ingredient>
{
    Task<Ingredient?> FindByCodeAsync(string ingredientCode);
    Task<bool>        IsCodeExistsAsync(string code, byte[]? excludeId = null);
    Task<IEnumerable<Ingredient>> GetByWarehouseAsync(byte[] warehouseId);
}
