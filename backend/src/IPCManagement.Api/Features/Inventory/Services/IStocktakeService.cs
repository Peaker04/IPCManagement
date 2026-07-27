using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface IStocktakeService
{
    Task<PagedResponseDto<StocktakeDto>> GetPagedAsync(StocktakeFilterRequestDto request);
    Task<StocktakeDto?> GetByIdAsync(string id);
    Task<StocktakeDto> CreateAsync(CreateStocktakeRequest dto, string userId);
    Task<StocktakeDto> UpdateActualQtyAsync(string id, UpdateStocktakeLinesRequest dto, string userId);
    Task<StocktakeDto> SubmitForApprovalAsync(string id, string userId);
    Task<StocktakeDto> ApproveAsync(string id, string userId);
    Task<StocktakeDto> RejectAsync(string id, string userId, string reason);
}
