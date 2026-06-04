using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Interfaces.Repositories;

public interface IProductionPlanRepository
{
    Task<(IEnumerable<Productionplan> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Productionplan?> GetByIdWithLinesAsync(byte[] id);
}
