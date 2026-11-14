using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Shared.Contracts;

using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;

namespace IPCManagement.Api.Features.Catalog.Services;

public class IngredientService : IIngredientService
{
    private readonly IIngredientRepository _ingredientRepo;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;

    public IngredientService(
        IIngredientRepository ingredientRepo,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext context,
        IEfTransactionRunner transactionRunner)
    {
        _ingredientRepo = ingredientRepo;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _context = context;
        _transactionRunner = transactionRunner;
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

    public async Task<IngredientDto> CreateAsync(CreateIngredientRequest dto)
    {
        var unitBytes      = GuidHelper.ParseGuidString(dto.UnitId)
            ?? throw new ArgumentException("UnitId không hợp lệ.");
        var ingredientId = GuidHelper.NewId();
        var entity = await _transactionRunner.ExecuteAsync(async token =>
        {
            await IngredientUnitLock.AcquireAsync(_context, unitBytes, token);
            if (await _ingredientRepo.IsCodeExistsAsync(dto.IngredientCode))
                throw new BusinessRuleException($"Mã nguyên liệu '{dto.IngredientCode}' đã tồn tại.");
            await RejectDuplicateNameAndUnitAsync(dto.IngredientName, unitBytes);
            var warehouseBytes = await ResolveCanonicalWarehouseAsync(dto.WarehouseId);
            var created = new Ingredient
            {
                IngredientId = ingredientId,
                IngredientCode = dto.IngredientCode.Trim(),
                IngredientName = dto.IngredientName.Trim(),
                IsFreshDaily = dto.IsFreshDaily,
                ReferencePrice = DecimalPolicy.RoundMoney(dto.ReferencePrice),
                UnitId = unitBytes,
                WarehouseId = warehouseBytes,
                IsActive = true
            };
            await _ingredientRepo.AddAsync(created);
            return created;
        }, async token =>
        {
            var persisted = await _ingredientRepo.FindByCodeAsync(dto.IngredientCode.Trim());
            return persisted is not null && persisted.IngredientId.AsSpan().SequenceEqual(ingredientId);
        });
        return IngredientMapper.MapToDto(entity);
    }

    public async Task<IngredientDto?> UpdateAsync(string id, UpdateIngredientRequest dto)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;
        var entity = await _transactionRunner.ExecuteAsync(async token =>
        {
            var current = await _ingredientRepo.GetByIdAsync(bytes);
            if (current is null) return null;
            if (dto.IsActive != false && (dto.IngredientName is not null || dto.UnitId is not null || current.IsActive == false))
            {
                var proposedUnit = dto.UnitId is null ? current.UnitId : GuidHelper.ParseGuidString(dto.UnitId)
                    ?? throw new ArgumentException("UnitId không hợp lệ.");
                await IngredientUnitLock.AcquireAsync(_context, proposedUnit, token);
                await RejectDuplicateNameAndUnitAsync(dto.IngredientName ?? current.IngredientName, proposedUnit, current.IngredientId);
            }

            if (dto.IngredientName is not null) current.IngredientName = dto.IngredientName.Trim();
            if (dto.IsFreshDaily is not null) current.IsFreshDaily = dto.IsFreshDaily.Value;
            if (dto.ReferencePrice is not null) current.ReferencePrice = DecimalPolicy.RoundMoney(dto.ReferencePrice.Value);
            if (dto.IsActive is not null) current.IsActive = dto.IsActive.Value;
            if (dto.UnitId is not null)
                current.UnitId = GuidHelper.ParseGuidString(dto.UnitId)
                    ?? throw new ArgumentException("UnitId không hợp lệ.");
            current.WarehouseId = await ResolveCanonicalWarehouseAsync(dto.WarehouseId);
            await _ingredientRepo.UpdateAsync(current);
            return current;
        }, async token =>
        {
            var persisted = await _ingredientRepo.GetByIdAsync(bytes);
            return persisted is not null
                && (dto.IngredientName is null || persisted.IngredientName == dto.IngredientName.Trim())
                && (dto.UnitId is null || persisted.UnitId.AsSpan().SequenceEqual(GuidHelper.ParseGuidString(dto.UnitId)))
                && (dto.IsActive is null || persisted.IsActive == dto.IsActive)
                && (dto.IsFreshDaily is null || persisted.IsFreshDaily == dto.IsFreshDaily)
                && (dto.ReferencePrice is null || persisted.ReferencePrice == DecimalPolicy.RoundMoney(dto.ReferencePrice.Value));
        });
        if (entity is null) return null;
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

    private async Task<byte[]> ResolveCanonicalWarehouseAsync(string? suppliedWarehouseId)
    {
        var canonicalId = await _operationalWarehouseResolver.ResolveAsync();
        if (suppliedWarehouseId is null) return canonicalId;
        var suppliedId = GuidHelper.ParseGuidString(suppliedWarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
            throw new BusinessRuleException("Kho trên yêu cầu không khớp kho vận hành của hệ thống.");
        return canonicalId;
    }

    private async Task RejectDuplicateNameAndUnitAsync(string name, byte[] unitId, byte[]? excludeId = null)
    {
        var normalizedName = name.Trim();
        var matches = await _ingredientRepo.GetActiveByUnitAsync(unitId);
        var duplicate = matches.FirstOrDefault(item =>
            (excludeId is null || !item.IngredientId.AsSpan().SequenceEqual(excludeId)) &&
            string.Equals(item.IngredientName.Trim(), normalizedName, StringComparison.OrdinalIgnoreCase));
        if (duplicate is not null)
            throw new BusinessRuleException($"Nguyên liệu '{normalizedName}' cùng đơn vị đã tồn tại với mã '{duplicate.IngredientCode}'. Hãy dùng nguyên liệu hiện có.");
    }

}
