using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Warehouse;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Services;

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
