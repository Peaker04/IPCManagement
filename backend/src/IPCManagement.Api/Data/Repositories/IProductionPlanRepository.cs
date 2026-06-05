using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IProductionPlanRepository
{
    Task<(IEnumerable<Productionplan> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<Productionplan?> GetByIdWithLinesAsync(byte[] id);
}
