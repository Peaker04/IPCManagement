using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IpcManagementContext _context;

    public RefreshTokenRepository(IpcManagementContext context)
        => _context = context;

    public async Task<RefreshToken?> FindValidByHashAsync(string tokenHash, byte[] userId)
        => await _context.Refreshtokens
            .Include(rt => rt.User).ThenInclude(u => u.Role)
            .FirstOrDefaultAsync(rt =>
                rt.TokenHash == tokenHash &&
                rt.UserId.SequenceEqual(userId));

    public async Task<RefreshToken?> FindByHashAsync(string tokenHash)
        => await _context.Refreshtokens
            .FirstOrDefaultAsync(rt => rt.TokenHash == tokenHash);

    public void Add(RefreshToken token)
        => _context.Refreshtokens.Add(token);

    public async Task CleanupExpiredForUserAsync(byte[] userId)
    {
        await _context.Refreshtokens
            .Where(rt => rt.UserId.SequenceEqual(userId) &&
                         (rt.ExpiresAt < DateTime.UtcNow || rt.IsRevoked || rt.IsUsed))
            .ExecuteDeleteAsync();
    }

    public async Task PrepareForLoginAsync(
        byte[] userId,
        string deviceInfo,
        int activeTokensToRetain)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(activeTokensToRetain);

        var now = DateTime.UtcNow;
        await _context.Refreshtokens
            .Where(token => token.UserId.SequenceEqual(userId) &&
                (token.ExpiresAt < now || token.IsRevoked || token.IsUsed || token.DeviceInfo == deviceInfo))
            .ExecuteDeleteAsync();

        var surplusTokenIds = await _context.Refreshtokens
            .AsNoTracking()
            .Where(token => token.UserId.SequenceEqual(userId) &&
                token.ExpiresAt >= now && !token.IsRevoked && !token.IsUsed)
            .OrderByDescending(token => token.CreatedAt)
            .Skip(activeTokensToRetain)
            .Select(token => token.TokenId)
            .ToListAsync();

        if (surplusTokenIds.Count > 0)
        {
            await _context.Refreshtokens
                .Where(token => surplusTokenIds.Contains(token.TokenId))
                .ExecuteDeleteAsync();
        }
    }

    public Task SaveChangesAsync()
        => _context.SaveChangesAsync();
}
