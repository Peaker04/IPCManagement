using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Warehouse;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class WarehouseService : IWarehouseService
{
    private readonly IWarehouseRepository _warehouseRepository;

    public WarehouseService(IWarehouseRepository warehouseRepository)
    {
        _warehouseRepository = warehouseRepository;
    }

    public async Task<PagedResponseDto<WarehouseDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _warehouseRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize,
            request.SearchKeyword);

        return PagedResponseDto<WarehouseDto>.Create(
            items.Select(MapToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<WarehouseDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var warehouse = await _warehouseRepository.GetByIdAsync(bytes);
        return warehouse is null ? null : MapToDto(warehouse);
    }

    private static WarehouseDto MapToDto(Warehouse warehouse) => new()
    {
        WarehouseId = GuidHelper.ToGuidString(warehouse.WarehouseId),
        WarehouseCode = warehouse.WarehouseCode,
        WarehouseName = warehouse.WarehouseName,
        WarehouseType = warehouse.WarehouseType,
        Note = warehouse.Note
    };
}
