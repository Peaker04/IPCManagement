using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IDishRepository : IGenericRepository<Dish>
{
    Task<Dish?> FindByCodeAsync(string dishCode);
    Task<bool>  IsCodeExistsAsync(string code, byte[]? excludeId = null);
    Task<IEnumerable<Dish>> GetByGroupAsync(string dishGroup);
}
