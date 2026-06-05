using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

public class DishService : IDishService
{
    private readonly IDishRepository _dishRepo;

    public DishService(IDishRepository dishRepo)
    {
        _dishRepo = dishRepo;
    }

    public async Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _dishRepo.GetPagedAsync(
            request.PageNumber, request.PageSize, request.SearchKeyword);

        return PagedResponseDto<DishDto>.Create(
            items.Select(MapToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<DishDto?> GetByIdAsync(string id)
    {
        var bytes  = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var entity = await _dishRepo.GetByIdAsync(bytes);
        return entity is null ? null : MapToDto(entity);
    }

    public async Task<DishDto> CreateAsync(CreateDishDto dto)
    {
        if (await _dishRepo.IsCodeExistsAsync(dto.DishCode))
            throw new InvalidOperationException($"Mã món ăn '{dto.DishCode}' đã tồn tại.");

        var entity = new Dish
        {
            DishId    = GuidHelper.NewId(),
            DishCode  = dto.DishCode.Trim(),
            DishName  = dto.DishName.Trim(),
            DishType  = dto.DishType?.Trim(),
            DishGroup = dto.DishGroup?.Trim(),
            IsActive  = true
        };

        await _dishRepo.AddAsync(entity);
        return MapToDto(entity);
    }

    public async Task<DishDto?> UpdateAsync(string id, UpdateDishDto dto)
    {
        var bytes  = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var entity = await _dishRepo.GetByIdAsync(bytes);
        if (entity is null) return null;

        if (dto.DishName  is not null) entity.DishName  = dto.DishName.Trim();
        if (dto.DishType  is not null) entity.DishType  = dto.DishType.Trim();
        if (dto.DishGroup is not null) entity.DishGroup = dto.DishGroup.Trim();
        if (dto.IsActive  is not null) entity.IsActive  = dto.IsActive;

        await _dishRepo.UpdateAsync(entity);
        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return false;

        var entity = await _dishRepo.GetByIdAsync(bytes);
        if (entity is null) return false;

        // Soft-delete: giữ lại dữ liệu cho BOM, menu, kế hoạch sản xuất
        entity.IsActive = false;
        await _dishRepo.UpdateAsync(entity);
        return true;
    }

    // ─── Mapping ──────────────────────────────────────────────────────────────
    private static DishDto MapToDto(Dish e) => new()
    {
        DishId    = GuidHelper.ToGuidString(e.DishId),
        DishCode  = e.DishCode,
        DishName  = e.DishName,
        DishType  = e.DishType,
        DishGroup = e.DishGroup,
        IsActive  = e.IsActive ?? true
    };
}
