using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Interfaces.Repositories;

public interface IUserRepository : IGenericRepository<User>
{
    Task<User?> FindByUsernameAsync(string username);
    Task<User?> GetWithRoleAsync(byte[] userId);
    Task<bool>  IsUsernameExistsAsync(string username);
}
