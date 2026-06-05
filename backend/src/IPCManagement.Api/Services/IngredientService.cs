using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Ingredient;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Domain.Entities;

namespace IPCManagement.Application.Services;

public class IngredientService : IIngredientService
{
    private readonly IIngredientRepository _ingredientRepo;

    public IngredientService(IIngredientRepository ingredientRepo)
    {
        _ingredientRepo = ingredientRepo;
    }

    public async Task<PagedResponseDto<IngredientDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _ingredientRepo.GetPagedAsync(
            request.PageNumber, request.PageSize, request.SearchKeyword);

        return PagedResponseDto<IngredientDto>.Create(
            items.Select(MapToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<IngredientDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var entity = await _ingredientRepo.GetByIdAsync(bytes);
        return entity is null ? null : MapToDto(entity);
    }

    public async Task<IngredientDto> CreateAsync(CreateIngredientDto dto)
    {
        // Kiểm tra trùng code
        if (await _ingredientRepo.IsCodeExistsAsync(dto.IngredientCode))
            throw new InvalidOperationException($"Mã nguyên liệu '{dto.IngredientCode}' đã tồn tại.");

        var unitBytes      = GuidHelper.ParseGuidString(dto.UnitId)
            ?? throw new ArgumentException("UnitId không hợp lệ.");
        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");

        var entity = new Ingredient
        {
            IngredientId   = GuidHelper.NewId(),
            IngredientCode = dto.IngredientCode.Trim(),
            IngredientName = dto.IngredientName.Trim(),
            IsFreshDaily   = dto.IsFreshDaily,
            ReferencePrice = dto.ReferencePrice,
            UnitId         = unitBytes,
            WarehouseId    = warehouseBytes,
            IsActive       = true
        };

        await _ingredientRepo.AddAsync(entity);
        return MapToDto(entity);
    }

    public async Task<IngredientDto?> UpdateAsync(string id, UpdateIngredientDto dto)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var entity = await _ingredientRepo.GetByIdAsync(bytes);
        if (entity is null) return null;

        if (dto.IngredientName is not null) entity.IngredientName = dto.IngredientName.Trim();
        if (dto.IsFreshDaily   is not null) entity.IsFreshDaily   = dto.IsFreshDaily.Value;
        if (dto.ReferencePrice is not null) entity.ReferencePrice = dto.ReferencePrice.Value;
        if (dto.IsActive       is not null) entity.IsActive       = dto.IsActive.Value;

        if (dto.UnitId is not null)
        {
            entity.UnitId = GuidHelper.ParseGuidString(dto.UnitId)
                ?? throw new ArgumentException("UnitId không hợp lệ.");
        }
        if (dto.WarehouseId is not null)
        {
            entity.WarehouseId = GuidHelper.ParseGuidString(dto.WarehouseId)
                ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        }

        await _ingredientRepo.UpdateAsync(entity);
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return false;

        if (!await _ingredientRepo.ExistsAsync(bytes)) return false;

        await _ingredientRepo.DeleteAsync(bytes);
        return true;
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────
    private static IngredientDto MapToDto(Ingredient e) => new()
    {
        IngredientId   = GuidHelper.ToGuidString(e.IngredientId),
        IngredientCode = e.IngredientCode,
        IngredientName = e.IngredientName,
        IsActive       = e.IsActive ?? true,
        IsFreshDaily   = e.IsFreshDaily,
        ReferencePrice = e.ReferencePrice,
        UnitId         = GuidHelper.ToGuidString(e.UnitId),
        UnitName       = e.Unit?.UnitName,
        WarehouseId    = GuidHelper.ToGuidString(e.WarehouseId),
        WarehouseName  = e.Warehouse?.WarehouseName
    };
}
