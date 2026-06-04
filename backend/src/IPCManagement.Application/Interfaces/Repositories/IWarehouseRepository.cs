using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Interfaces.Repositories;

public interface IWarehouseRepository
{
    Task<(IEnumerable<Warehouse> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? searchKeyword = null);

    Task<Warehouse?> GetByIdAsync(byte[] id);
}
