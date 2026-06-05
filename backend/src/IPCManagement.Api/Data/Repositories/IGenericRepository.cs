namespace IPCManagement.Api.Data.Repositories;

/// <summary>
/// Generic repository contract — CRUD cơ bản cho mọi entity.
/// PK dùng byte[] (binary(16) MySQL).
/// </summary>
public interface IGenericRepository<T> where T : class
{
    Task<T?> GetByIdAsync(byte[] id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<(IEnumerable<T> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize, string? searchKeyword = null);
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(byte[] id);
    void Add(T entity);
    void Update(T entity);
    void Remove(T entity);
    Task<bool> ExistsAsync(byte[] id);
}
