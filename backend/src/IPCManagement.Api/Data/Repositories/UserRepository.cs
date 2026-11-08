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

    public async Task<bool> LockActiveUserForSessionMutationAsync(
        byte[] userId,
        CancellationToken cancellationToken = default)
    {
        var user = _context.Database.IsMySql()
            ? await _dbSet.FromSqlInterpolated($"SELECT * FROM users WHERE userId = {userId} FOR UPDATE")
                .SingleOrDefaultAsync(cancellationToken)
            : await _dbSet.SingleOrDefaultAsync(item => item.UserId == userId, cancellationToken);

        return user?.IsActive == true;
    }

    public async Task<bool> IsUsernameExistsAsync(string username)
        => await _dbSet.AnyAsync(u => u.Username == username);
}
