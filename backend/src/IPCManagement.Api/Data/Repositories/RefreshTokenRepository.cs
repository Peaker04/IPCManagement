using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IpcManagementContext _context;

    public RefreshTokenRepository(IpcManagementContext context)
        => _context = context;

    public async Task<Refreshtoken?> FindValidByHashAsync(string tokenHash, byte[] userId)
        => await _context.Refreshtokens
            .Include(rt => rt.User).ThenInclude(u => u.Role)
            .FirstOrDefaultAsync(rt =>
                rt.TokenHash == tokenHash &&
                rt.UserId.SequenceEqual(userId));

    public async Task<Refreshtoken?> FindByHashAsync(string tokenHash)
        => await _context.Refreshtokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);

    public void Add(Refreshtoken token)
        => _context.Refreshtokens.Add(token);

    public async Task CleanupExpiredForUserAsync(byte[] userId)
    {
        var stale = await _context.Refreshtokens
            .Where(rt => rt.UserId.SequenceEqual(userId) &&
                         (rt.ExpiresAt < DateTime.UtcNow || rt.IsRevoked || rt.IsUsed))
            .ToListAsync();
        _context.Refreshtokens.RemoveRange(stale);
    }

    public Task SaveChangesAsync()
        => _context.SaveChangesAsync();
}
