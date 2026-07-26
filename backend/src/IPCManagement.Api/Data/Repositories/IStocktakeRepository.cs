using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Data.Repositories;

public interface IStocktakeRepository : IGenericRepository<Stocktake>
{
    Task<(IReadOnlyList<Stocktake>, int)> GetPagedAsync(StocktakeFilterRequestDto request);
    Task<Stocktake?> GetByIdWithLinesAsync(byte[] id);
}
