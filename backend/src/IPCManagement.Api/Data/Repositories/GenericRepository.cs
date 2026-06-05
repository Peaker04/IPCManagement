using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

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
        int maxPageSize = _context.PaginationOptions.MaxPageSize;
        pageSize   = Math.Clamp(pageSize, 1, maxPageSize);
        pageNumber = Math.Max(1, pageNumber);

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

    public virtual void Add(T entity)
    {
        _dbSet.Add(entity);
    }

    public virtual void Update(T entity)
    {
        _dbSet.Update(entity);
    }

    public virtual void Remove(T entity)
    {
        _dbSet.Remove(entity);
    }

    public virtual async Task<bool> ExistsAsync(byte[] id)
    {
        // Dùng AnyAsync thay FindAsync để tránh materialise toàn bộ entity
        var keyName = _context.Model
            .FindEntityType(typeof(T))!
            .FindPrimaryKey()!
            .Properties[0].Name;
        return await _dbSet.AnyAsync(e => EF.Property<byte[]>(e, keyName) == id);
    }
}
