using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Ingredient;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Services;

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
            items.Select(IngredientMapper.MapToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<IngredientDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var entity = await _ingredientRepo.GetByIdAsync(bytes);
        return entity is null ? null : IngredientMapper.MapToDto(entity);
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
        return IngredientMapper.MapToDto(entity);
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
        return IngredientMapper.MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return false;

        var entity = await _ingredientRepo.GetByIdAsync(bytes);
        if (entity is null) return false;

        // Soft-delete: đánh dấu không hoạt động thay vì xóa vĩnh viễn
        // để bảo toàn liên kết lịch sử (phiếu nhập/xuất kho, stock movements)
        entity.IsActive = false;
        await _ingredientRepo.UpdateAsync(entity);
        return true;
    }

}
