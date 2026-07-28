using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public class DishService : IDishService
{
    private readonly IDishCatalogService _catalogService;
    private readonly IDishCatalogDiagnosticsService _diagnosticsService;
    private readonly IDishBomTemplateService _templateService;
    private readonly IDishBomImportService _importService;
    private readonly IpcManagementContext _context;
    private readonly IMemoryCache _cache;

    public DishService(IDishRepository dishRepo, IpcManagementContext context, IMemoryCache cache)
        : this(
            dishRepo,
            context,
            cache,
            new DishCatalogService(dishRepo, context, cache),
            new DishCatalogDiagnosticsService(context),
            new DishBomTemplateService(context))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            new DishCatalogDiagnosticsService(context),
            new DishBomTemplateService(context))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService)
        : this(dishRepo, context, cache, catalogService, diagnosticsService, new DishBomTemplateService(context))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService,
        IDishBomTemplateService templateService)
        : this(
            dishRepo,
            context,
            cache,
            catalogService,
            diagnosticsService,
            templateService,
            new DishBomImportService(context, cache))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService,
        IDishBomTemplateService templateService,
        IDishBomImportService importService)
    {
        _catalogService = catalogService;
        _diagnosticsService = diagnosticsService;
        _templateService = templateService;
        _importService = importService;
        _context = context;
        _cache = cache;
    }

    public Task<PagedResponseDto<DishDto>> GetPagedAsync(PagedRequestDto request)
        => _catalogService.GetPagedAsync(request);

    public Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false)
        => _catalogService.GetCatalogAsync(includeInactive);

    public Task<BomCoverageReportDto> GetBomCoverageAsync()
        => _diagnosticsService.GetBomCoverageAsync();

    public Task<BomValidationReportDto> GetBomValidationAsync()
        => _diagnosticsService.GetBomValidationAsync();
    public Task<MenuImportHistoryDto> GetMenuImportHistoryAsync()
        => _diagnosticsService.GetMenuImportHistoryAsync();
    public Task<SampleImportStatusDto> GetSampleImportStatusAsync()
        => _diagnosticsService.GetSampleImportStatusAsync();
    public Task<byte[]> BuildBomTemplateWorkbookAsync(
        BomTemplateQueryDto query,
        CancellationToken cancellationToken = default)
        => _templateService.BuildAsync(query, cancellationToken);

    public Task<BomImportPreviewDto> PreviewBomImportAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken = default)
        => _importService.PreviewAsync(fileStream, request, cancellationToken);

    public Task<BomImportCommitResultDto> CommitBomImportAsync(
        Stream fileStream,
        BomImportCommitRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _importService.CommitAsync(fileStream, request, userId, cancellationToken);

    public async Task<IReadOnlyList<DishCatalogBomLineDto>?> GetBomLinesAsync(string dishId)
    {
        var dishBytes = GuidHelper.ParseGuidString(dishId);
        if (dishBytes is null)
        {
            return null;
        }

        var dishExists = await _context.Dishes
            .AsNoTracking()
            .AnyAsync(dish => dish.DishId == dishBytes);
        if (!dishExists)
        {
            return null;
        }

        var lines = await QueryBomLines(dishBytes)
            .OrderBy(line => line.Ingredient.IngredientName)
            .ThenBy(line => line.EffectiveFrom)
            .ToListAsync();

        return lines.Select(MapCatalogBomLine).ToList();
    }

    public Task<DishDto?> GetByIdAsync(string id)
        => _catalogService.GetByIdAsync(id);

    public Task<DishDto> CreateAsync(CreateDishRequest dto)
        => _catalogService.CreateAsync(dto);

    public Task<DishDto?> UpdateAsync(string id, UpdateDishRequest dto)
        => _catalogService.UpdateAsync(id, dto);

    public Task<bool> DeleteAsync(string id)
        => _catalogService.DeleteAsync(id);

    public async Task<DishCatalogBomLineDto?> AddBomLineAsync(string dishId, CreateDishBomLineRequest dto)
    {
        var dishBytes = GuidHelper.ParseGuidString(dishId);
        var ingredientBytes = GuidHelper.ParseGuidString(dto.IngredientId);
        if (dishBytes is null || ingredientBytes is null)
        {
            return null;
        }

        var dishExists = await _context.Dishes.AnyAsync(dish => dish.DishId == dishBytes);
        if (!dishExists)
        {
            return null;
        }

        var ingredient = await _context.Ingredients
            .Include(item => item.Unit)
            .FirstOrDefaultAsync(item => item.IngredientId == ingredientBytes && (item.IsActive ?? true));
        if (ingredient is null)
        {
            throw new ArgumentException("Nguyên liệu không hợp lệ hoặc đã ngừng sử dụng.");
        }

        var unitBytes = !string.IsNullOrWhiteSpace(dto.UnitId)
            ? GuidHelper.ParseGuidString(dto.UnitId)
            : ingredient.UnitId;
        if (unitBytes is null)
        {
            throw new ArgumentException("Đơn vị tính không hợp lệ.");
        }

        var unit = await _context.Units.FirstOrDefaultAsync(item => item.UnitId == unitBytes);
        if (unit is null)
        {
            throw new ArgumentException("Đơn vị tính không tồn tại.");
        }

        var effectiveFrom = dto.EffectiveFrom ?? ServiceCalendar.Today();
        var bomStatus = DishBomPolicy.NormalizeStatus(dto.BomStatus);
        var priceTier = DishBomPolicy.NormalizePriceTier(dto.PriceTierAmount ?? 25000m);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(dto.CustomerId);
        if (dto.EffectiveTo is not null && dto.EffectiveTo < effectiveFrom)
        {
            throw new ArgumentException("Ngày hết hiệu lực phải sau ngày bắt đầu.");
        }

        if (bomStatus == DishBomPolicy.Published &&
            await HasOverlappingBomLineAsync(dishBytes, ingredientBytes, unitBytes, priceTier, customerId, effectiveFrom, dto.EffectiveTo))
        {
            throw new InvalidOperationException("Món ăn đã có dòng BOM trùng nguyên liệu, đơn vị và khoảng hiệu lực cho cùng đơn giá/khách hàng.");
        }

        var entity = new DishBom
        {
            BomId = GuidHelper.NewId(),
            DishId = dishBytes,
            IngredientId = ingredientBytes,
            UnitId = unitBytes,
            CustomerId = customerId,
            PriceTierAmount = priceTier,
            GrossQtyPerServing = DecimalPolicy.RoundQuantity(dto.GrossQtyPerServing),
            WasteRatePercent = dto.WasteRatePercent,
            BomStatus = bomStatus,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = dto.EffectiveTo,
            Ingredient = ingredient,
            Unit = unit
        };

        _context.Dishboms.Add(entity);
        await _context.SaveChangesAsync();
        ClearCatalogCache();

        return MapCatalogBomLine(entity);
    }

    public async Task<DishCatalogBomLineDto?> UpdateBomLineAsync(
        string dishId,
        string bomId,
        UpdateDishBomLineRequest dto,
        string? userId)
    {
        var dishBytes = GuidHelper.ParseGuidString(dishId);
        var bomBytes = GuidHelper.ParseGuidString(bomId);
        if (dishBytes is null || bomBytes is null)
        {
            return null;
        }

        var entity = await QueryBomLines(dishBytes)
            .FirstOrDefaultAsync(line => line.BomId == bomBytes);
        if (entity is null)
        {
            return null;
        }

        var oldGrossQty = entity.GrossQtyPerServing;
        var oldWasteRate = entity.WasteRatePercent;
        var targetIngredientId = entity.IngredientId;
        var targetIngredient = entity.Ingredient;
        var targetUnitId = entity.UnitId;
        var targetUnit = entity.Unit;
        var targetCustomerId = entity.CustomerId;
        var targetPriceTier = entity.PriceTierAmount;
        var targetGrossQty = entity.GrossQtyPerServing;
        var targetWasteRate = entity.WasteRatePercent;
        var targetEffectiveFrom = dto.EffectiveFrom ?? entity.EffectiveFrom;
        var targetEffectiveTo = dto.EffectiveTo ?? entity.EffectiveTo;
        var targetStatus = DishBomPolicy.NormalizeStatus(dto.BomStatus, entity.BomStatus);

        if (!string.IsNullOrWhiteSpace(dto.IngredientId))
        {
            var ingredientBytes = GuidHelper.ParseGuidString(dto.IngredientId)
                ?? throw new ArgumentException("Nguyên liệu không hợp lệ.");
            targetIngredient = await _context.Ingredients
                .Include(item => item.Unit)
                .FirstOrDefaultAsync(item => item.IngredientId == ingredientBytes && (item.IsActive ?? true))
                ?? throw new ArgumentException("Nguyên liệu không tồn tại hoặc đã ngừng sử dụng.");

            targetIngredientId = ingredientBytes;
            if (string.IsNullOrWhiteSpace(dto.UnitId))
            {
                targetUnitId = targetIngredient.UnitId;
                targetUnit = targetIngredient.Unit;
            }
        }

        if (!string.IsNullOrWhiteSpace(dto.UnitId))
        {
            var unitBytes = GuidHelper.ParseGuidString(dto.UnitId)
                ?? throw new ArgumentException("Đơn vị tính không hợp lệ.");
            targetUnit = await _context.Units.FirstOrDefaultAsync(item => item.UnitId == unitBytes)
                ?? throw new ArgumentException("Đơn vị tính không tồn tại.");

            targetUnitId = unitBytes;
        }

        if (dto.CustomerId is not null)
        {
            targetCustomerId = DishBomPolicy.ParseOptionalCustomerId(dto.CustomerId);
        }
        if (dto.PriceTierAmount is not null)
        {
            targetPriceTier = DishBomPolicy.NormalizePriceTier(dto.PriceTierAmount.Value);
        }

        if (dto.GrossQtyPerServing is not null)
        {
            targetGrossQty = DecimalPolicy.RoundQuantity(dto.GrossQtyPerServing.Value);
        }
        if (dto.WasteRatePercent is not null)
        {
            targetWasteRate = dto.WasteRatePercent.Value;
        }
        if (targetEffectiveTo is not null && targetEffectiveTo < targetEffectiveFrom)
        {
            throw new ArgumentException("Ngày hết hiệu lực phải sau ngày bắt đầu.");
        }

        var versionedFieldsChanged =
            !targetIngredientId.SequenceEqual(entity.IngredientId) ||
            !targetUnitId.SequenceEqual(entity.UnitId) ||
            !DishBomPolicy.MatchesCustomerScope(entity.CustomerId, targetCustomerId) ||
            targetPriceTier != entity.PriceTierAmount ||
            targetGrossQty != entity.GrossQtyPerServing ||
            targetWasteRate != entity.WasteRatePercent ||
            targetEffectiveFrom != entity.EffectiveFrom;
        var shouldCreateNewVersion = DishBomPolicy.IsPublished(entity) && versionedFieldsChanged;

        if (shouldCreateNewVersion)
        {
            if (targetStatus == DishBomPolicy.Published)
            {
                if (targetEffectiveFrom <= entity.EffectiveFrom)
                {
                    throw new ArgumentException("Ngày hiệu lực version mới phải sau ngày bắt đầu của dòng BOM published hiện tại.");
                }

                if (await HasOverlappingBomLineAsync(
                    dishBytes,
                    targetIngredientId,
                    targetUnitId,
                    targetPriceTier,
                    targetCustomerId,
                    targetEffectiveFrom,
                    targetEffectiveTo,
                    entity.BomId))
                {
                    throw new InvalidOperationException("Món ăn đã có dòng BOM trùng nguyên liệu, đơn vị và khoảng hiệu lực.");
                }

                if (entity.EffectiveTo is null || entity.EffectiveTo >= targetEffectiveFrom)
                {
                    entity.EffectiveTo = targetEffectiveFrom.AddDays(-1);
                }
            }

            var newVersion = new DishBom
            {
                BomId = GuidHelper.NewId(),
                DishId = entity.DishId,
                IngredientId = targetIngredientId,
                UnitId = targetUnitId,
                CustomerId = targetCustomerId,
                PriceTierAmount = targetPriceTier,
                GrossQtyPerServing = targetGrossQty,
                WasteRatePercent = targetWasteRate,
                BomStatus = targetStatus,
                EffectiveFrom = targetEffectiveFrom,
                EffectiveTo = targetEffectiveTo,
                Ingredient = targetIngredient,
                Unit = targetUnit
            };
            _context.Dishboms.Add(newVersion);

            AddBomAdjustmentIfNeeded(newVersion.BomId, oldGrossQty, targetGrossQty, oldWasteRate, targetWasteRate, dto.Reason, userId);
            await _context.SaveChangesAsync();
            ClearCatalogCache();

            return MapCatalogBomLine(newVersion);
        }

        if (targetStatus == DishBomPolicy.Published &&
            await HasOverlappingBomLineAsync(
            dishBytes,
            targetIngredientId,
            targetUnitId,
            targetPriceTier,
            targetCustomerId,
            targetEffectiveFrom,
            targetEffectiveTo,
            entity.BomId))
        {
            throw new InvalidOperationException("Món ăn đã có dòng BOM trùng nguyên liệu, đơn vị và khoảng hiệu lực.");
        }

        entity.IngredientId = targetIngredientId;
        entity.Ingredient = targetIngredient;
        entity.UnitId = targetUnitId;
        entity.Unit = targetUnit;
        entity.CustomerId = targetCustomerId;
        entity.PriceTierAmount = targetPriceTier;
        entity.GrossQtyPerServing = targetGrossQty;
        entity.WasteRatePercent = targetWasteRate;
        entity.BomStatus = targetStatus;
        entity.EffectiveFrom = targetEffectiveFrom;
        entity.EffectiveTo = targetEffectiveTo;

        AddBomAdjustmentIfNeeded(entity.BomId, oldGrossQty, targetGrossQty, oldWasteRate, targetWasteRate, dto.Reason, userId);

        await _context.SaveChangesAsync();
        ClearCatalogCache();

        return MapCatalogBomLine(entity);
    }

    public async Task<bool> CloseBomLineAsync(string dishId, string bomId)
    {
        var dishBytes = GuidHelper.ParseGuidString(dishId);
        var bomBytes = GuidHelper.ParseGuidString(bomId);
        if (dishBytes is null || bomBytes is null)
        {
            return false;
        }

        var entity = await _context.Dishboms.FirstOrDefaultAsync(line =>
            line.DishId == dishBytes &&
            line.BomId == bomBytes);
        if (entity is null)
        {
            return false;
        }

        var today = ServiceCalendar.Today();
        if (entity.EffectiveTo is null || entity.EffectiveTo > today)
        {
            entity.EffectiveTo = entity.EffectiveFrom > today ? entity.EffectiveFrom : today;
        }

        await _context.SaveChangesAsync();
        ClearCatalogCache();
        return true;
    }

    private void ClearCatalogCache()
        => DishCatalogCache.Clear(_cache);

    // ─── Mapping ──────────────────────────────────────────────────────────────
    private static DishCatalogBomLineDto MapCatalogBomLine(DishBom bom) => new()
    {
        BomId = GuidHelper.ToGuidString(bom.BomId),
        IngredientId = GuidHelper.ToGuidString(bom.IngredientId),
        IngredientCode = bom.Ingredient.IngredientCode,
        IngredientName = bom.Ingredient.IngredientName,
        UnitId = GuidHelper.ToGuidString(bom.UnitId),
        UnitCode = bom.Unit.UnitCode,
        UnitName = bom.Unit.UnitName,
        CustomerId = bom.CustomerId is null ? null : GuidHelper.ToGuidString(bom.CustomerId),
        CustomerCode = bom.Customer?.CustomerCode,
        CustomerName = bom.Customer?.CustomerName,
        PriceTierAmount = bom.PriceTierAmount,
        BomScope = bom.CustomerId is null ? "global" : "customer",
        GrossQtyPerServing = bom.GrossQtyPerServing,
        WasteRatePercent = bom.WasteRatePercent,
        BomStatus = DishBomPolicy.NormalizeStatus(bom.BomStatus),
        BomStatusLabel = DishBomPolicy.MapStatusLabel(bom.BomStatus),
        EffectiveFrom = bom.EffectiveFrom,
        EffectiveTo = bom.EffectiveTo,
        ReferencePrice = bom.Ingredient.ReferencePrice
    };

    private IQueryable<DishBom> QueryBomLines(byte[] dishBytes)
        => _context.Dishboms
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .Include(line => line.Customer)
            .Where(line => line.DishId == dishBytes)
            .Where(line => DishBomPolicy.SupportedPriceTiers.Contains(line.PriceTierAmount));

    private Task<bool> HasOverlappingBomLineAsync(
        byte[] dishId,
        byte[] ingredientId,
        byte[] unitId,
        decimal priceTier,
        byte[]? customerId,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo,
        byte[]? excludeBomId = null)
    {
        var effectiveToValue = effectiveTo ?? DateOnly.MaxValue;
        var query = _context.Dishboms.Where(line =>
            line.DishId == dishId &&
            line.IngredientId == ingredientId &&
            line.UnitId == unitId &&
            line.PriceTierAmount == priceTier);

        query = customerId is null
            ? query.Where(line => line.CustomerId == null)
            : query.Where(line => line.CustomerId != null && line.CustomerId.SequenceEqual(customerId));

        if (excludeBomId is not null)
        {
            query = query.Where(line => line.BomId != excludeBomId);
        }

        return query.AnyAsync(line =>
            line.BomStatus == DishBomPolicy.Published &&
            line.EffectiveFrom <= effectiveToValue &&
            (line.EffectiveTo == null || line.EffectiveTo >= effectiveFrom));
    }

    private void AddBomAdjustmentIfNeeded(
        byte[] bomId,
        decimal oldGrossQty,
        decimal newGrossQty,
        decimal oldWasteRate,
        decimal newWasteRate,
        string? reason,
        string? userId)
    {
        var userBytes = GuidHelper.ParseGuidString(userId);
        var quantityChanged = oldGrossQty != newGrossQty || oldWasteRate != newWasteRate;
        if (userBytes is null || !quantityChanged)
        {
            return;
        }

        _context.Bomadjustments.Add(new BomAdjustment
        {
            BomAdjustmentId = GuidHelper.NewId(),
            BomId = bomId,
            OldGrossQtyPerServing = oldGrossQty,
            NewGrossQtyPerServing = newGrossQty,
            OldWasteRatePercent = oldWasteRate,
            NewWasteRatePercent = newWasteRate,
            Reason = reason,
            AdjustedBy = userBytes,
            AdjustedAt = DateTime.UtcNow
        });
    }

}
