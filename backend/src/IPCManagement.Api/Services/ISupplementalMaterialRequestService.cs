using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public interface ISupplementalMaterialRequestService
{
    Task<PagedResponseDto<SupplementalMaterialRequestDto>> GetPagedAsync(
        SupplementalMaterialRequestFilterDto request,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto?> GetByIdAsync(string id, string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequestDto request,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> FulfillAsync(
        string id,
        FulfillSupplementalMaterialRequestDto request,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> RouteToPurchasingAsync(
        string id,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> RejectAsync(
        string id,
        RejectSupplementalMaterialRequestDto request,
        string actorUserId,
        string? scopedWarehouseId = null);
}
