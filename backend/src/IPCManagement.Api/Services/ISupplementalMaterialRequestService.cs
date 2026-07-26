using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface ISupplementalMaterialRequestService
{
    Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequestDto request,
        string actorUserId,
        string? scopedWarehouseId = null);
}
