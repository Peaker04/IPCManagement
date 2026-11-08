using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IUserRepository : IGenericRepository<User>
{
    Task<User?> FindByUsernameAsync(string username);
    Task<User?> GetWithRoleAsync(byte[] userId);
    Task<bool> LockActiveUserForSessionMutationAsync(byte[] userId, CancellationToken cancellationToken = default);
    Task<bool>  IsUsernameExistsAsync(string username);
}
