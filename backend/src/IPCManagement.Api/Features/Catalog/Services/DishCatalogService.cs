using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Caching;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed class DishCatalogService : IDishCatalogService
{
    private readonly IDishRepository _dishRepo;
    private readonly IpcManagementContext _context;
    private readonly IMemoryCache _cache;

    public DishCatalogService(IDishRepository dishRepo, IpcManagementContext context, IMemoryCache cache)
    {
        _dishRepo = dishRepo;
        _context = context;
        _cache = cache;
    }

    public async Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _dishRepo.GetPagedAsync(
            request.PageNumber, request.PageSize, request.SearchKeyword);

        return PagedResponseDto<DishDto>.Create(
            items.Select(DishCatalogMapper.ToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false)
    {
        var cacheKey = DishCatalogCache.Key(includeInactive);
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<DishCatalogDto>? cachedCatalog) && cachedCatalog is not null)
        {
            return cachedCatalog;
        }

        var dishes = includeInactive
            ? await _context.Dishes
                .AsNoTracking()
                .Include(dish => dish.Dishboms)
                    .ThenInclude(bom => bom.Ingredient)
                .Include(dish => dish.Dishboms)
                    .ThenInclude(bom => bom.Unit)
                .Include(dish => dish.Menuitems)
                .OrderBy(dish => dish.DishCode)
                .ToListAsync()
            : await _dishRepo.GetCatalogAsync();
        var result = dishes.Select(DishCatalogMapper.ToCatalogDto).ToList();

        _cache.Set(
            cacheKey,
            result,
            new MemoryCacheEntryOptions().SetAbsoluteExpiration(TimeSpan.FromMinutes(30)));

        return result;
    }

    public async Task<DishDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null)
        {
            return null;
        }

        var entity = await _dishRepo.GetByIdAsync(bytes);
        return entity is null ? null : DishCatalogMapper.ToDto(entity);
    }

    public async Task<DishDto> CreateAsync(CreateDishRequest dto)
    {
        if (await _dishRepo.IsCodeExistsAsync(dto.DishCode))
        {
            throw new BusinessRuleException($"Mã món ăn '{dto.DishCode}' đã tồn tại.");
        }

        var entity = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = dto.DishCode.Trim(),
            DishName = dto.DishName.Trim(),
            DishType = dto.DishType?.Trim(),
            DishGroup = dto.DishGroup?.Trim(),
            IsActive = true
        };

        await _dishRepo.AddAsync(entity);
        DishCatalogCache.Clear(_cache);
        return DishCatalogMapper.ToDto(entity);
    }

    public async Task<DishDto?> UpdateAsync(string id, UpdateDishRequest dto)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null)
        {
            return null;
        }

        var entity = await _dishRepo.GetByIdAsync(bytes);
        if (entity is null)
        {
            return null;
        }

        if (dto.DishName is not null) entity.DishName = dto.DishName.Trim();
        if (dto.DishType is not null) entity.DishType = dto.DishType.Trim();
        if (dto.DishGroup is not null) entity.DishGroup = dto.DishGroup.Trim();
        if (dto.IsActive is not null) entity.IsActive = dto.IsActive;

        await _dishRepo.UpdateAsync(entity);
        DishCatalogCache.Clear(_cache);
        return DishCatalogMapper.ToDto(entity);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null)
        {
            return false;
        }

        var entity = await _dishRepo.GetByIdAsync(bytes);
        if (entity is null)
        {
            return false;
        }

        entity.IsActive = false;
        await _dishRepo.UpdateAsync(entity);
        DishCatalogCache.Clear(_cache);
        return true;
    }
}
