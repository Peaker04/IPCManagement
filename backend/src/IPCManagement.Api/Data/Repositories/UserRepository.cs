using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class UserRepository : GenericRepository<User>, IUserRepository
{
    public UserRepository(IpcManagementContext context) : base(context) { }

    public async Task<User?> FindByUsernameAsync(string username)
        => await _dbSet
            .AsNoTracking()
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Username == username);

    public async Task<User?> GetWithRoleAsync(byte[] userId)
        => await _dbSet
            .AsNoTracking()
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == userId);

    public async Task<bool> IsUsernameExistsAsync(string username)
        => await _dbSet.AnyAsync(u => u.Username == username);
}
