using System.Collections.Generic;
using System.Threading.Tasks;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

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
