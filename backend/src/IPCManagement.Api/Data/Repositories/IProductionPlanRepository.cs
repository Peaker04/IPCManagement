using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IProductionPlanRepository
{
    Task<(IEnumerable<ProductionPlan> Items, int TotalCount)> GetPagedAsync(int pageNumber, int pageSize);
    Task<ProductionPlan?> GetByIdWithLinesAsync(byte[] id);
    Task<IReadOnlyList<ProductionPlan>> GetFilteredAsync(DateOnly? serviceDate, DateOnly? dateFrom, DateOnly? dateTo, byte[]? customerId, CancellationToken cancellationToken = default);
}
