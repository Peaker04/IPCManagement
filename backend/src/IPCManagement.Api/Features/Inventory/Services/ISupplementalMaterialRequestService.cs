
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface ISupplementalMaterialRequestService
{
    Task<PagedResponseDto<SupplementalMaterialRequestDto>> GetPagedAsync(
        SupplementalMaterialRequestFilterDto request,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto?> GetByIdAsync(string id, string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> FulfillAsync(
        string id,
        FulfillSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> RouteToPurchasingAsync(
        string id,
        string actorUserId,
        string? scopedWarehouseId = null);
    Task<SupplementalMaterialRequestDto> RejectAsync(
        string id,
        RejectSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null);
}
