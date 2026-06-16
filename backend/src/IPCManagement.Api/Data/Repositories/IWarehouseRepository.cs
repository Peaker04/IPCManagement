using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IWarehouseRepository
{
    Task<(IEnumerable<Warehouse> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize,
        string? searchKeyword = null);

    Task<Warehouse?> GetByIdAsync(byte[] id);
}
