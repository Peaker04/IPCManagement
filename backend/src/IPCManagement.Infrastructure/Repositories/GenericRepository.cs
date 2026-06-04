using IPCManagement.Infrastructure.Data;
using IPCManagement.Application.Interfaces.Repositories;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Infrastructure.Repositories;

/// <summary>
/// Base implementation của IGenericRepository dùng EF Core.
/// Các repository cụ thể kế thừa và override khi cần.
/// </summary>
public abstract class GenericRepository<T> : IGenericRepository<T> where T : class
{
    protected readonly IpcManagementContext _context;
    protected readonly DbSet<T> _dbSet;

    protected GenericRepository(IpcManagementContext context)
    {
        _context = context;
        _dbSet   = context.Set<T>();
    }

    public virtual async Task<T?> GetByIdAsync(byte[] id)
        => await _dbSet.FindAsync(id);

    public virtual async Task<IEnumerable<T>> GetAllAsync()
        => await _dbSet.AsNoTracking().ToListAsync();

    /// <summary>Override tại repository cụ thể để áp dụng filter/search.</summary>
    public virtual async Task<(IEnumerable<T> Items, int TotalCount)> GetPagedAsync(
        int pageNumber, int pageSize, string? searchKeyword = null)
    {
        var query      = _dbSet.AsNoTracking();
        var totalCount = await query.CountAsync();
        var items      = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public virtual async Task AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
    }

    public virtual async Task UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();
    }

    public virtual async Task DeleteAsync(byte[] id)
    {
        var entity = await GetByIdAsync(id);
        if (entity is not null)
        {
            _dbSet.Remove(entity);
            await _context.SaveChangesAsync();
        }
    }

    public virtual async Task<bool> ExistsAsync(byte[] id)
        => await _dbSet.FindAsync(id) is not null;
}
