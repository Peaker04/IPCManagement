using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Data.Repositories;

public interface IStocktakeRepository : IGenericRepository<Stocktake>
{
    Task<(IReadOnlyList<Stocktake>, int)> GetPagedAsync(StocktakeFilterRequestDto request);
    Task<Stocktake?> GetByIdWithLinesAsync(byte[] id);
}
