using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Interfaces.Repositories;

public interface IInventoryIssueRepository
{
    Task<(IEnumerable<Inventoryissue> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Inventoryissue?> GetByIdWithLinesAsync(byte[] id);
}
