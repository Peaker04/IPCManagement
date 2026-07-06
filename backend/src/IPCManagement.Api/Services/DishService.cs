using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class DishService : IDishService
{
    private readonly IDishRepository _dishRepo;
    private readonly IpcManagementContext _context;
    private readonly IMemoryCache _cache;
    private const string CatalogCacheKey = "DishCatalog";
    private const string BomStatusDraft = "DRAFT";
    private const string BomStatusPublished = "PUBLISHED";
    private const string BomStatusArchived = "ARCHIVED";

    public DishService(IDishRepository dishRepo, IpcManagementContext context, IMemoryCache cache)
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
            items.Select(MapToDto),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<IReadOnlyList<DishCatalogDto>> GetCatalogAsync(bool includeInactive = false)
    {
        var cacheKey = includeInactive ? $"{CatalogCacheKey}:all" : CatalogCacheKey;
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<DishCatalogDto>? cachedCatalog) && cachedCatalog is not null)
        {
            return cachedCatalog;
        }

        var dishes = includeInactive
            ? await _context.Dishes
                .AsNoTracking()
                .Include(d => d.Dishboms)
                    .ThenInclude(bom => bom.Ingredient)
                .Include(d => d.Dishboms)
                    .ThenInclude(bom => bom.Unit)
                .Include(d => d.Menuitems)
                .OrderBy(d => d.DishCode)
                .ToListAsync()
            : await _dishRepo.GetCatalogAsync();
        var result = dishes.Select(MapToCatalogDto).ToList();

        var cacheOptions = new MemoryCacheEntryOptions()
            .SetAbsoluteExpiration(TimeSpan.FromMinutes(30));
        _cache.Set(cacheKey, result, cacheOptions);

        return result;
    }

    public async Task<BomCoverageReportDto> GetBomCoverageAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .OrderBy(dish => dish.DishCode)
            .ToListAsync();
        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Where(line =>
                line.BomStatus == BomStatusPublished &&
                line.EffectiveFrom <= today &&
                (line.EffectiveTo == null || line.EffectiveTo >= today))
            .ToListAsync();
        var bomCountByDish = activeBomLines
            .GroupBy(line => GuidHelper.ToGuidString(line.DishId))
            .ToDictionary(group => group.Key, group => group.Count());
        var coverage = dishes
            .Select(dish =>
            {
                var dishId = GuidHelper.ToGuidString(dish.DishId);
                var bomLineCount = bomCountByDish.GetValueOrDefault(dishId);
                var hasBom = bomLineCount > 0;
                return new BomCoverageDishDto
                {
                    DishId = dishId,
                    DishCode = dish.DishCode,
                    DishName = dish.DishName,
                    DishType = dish.DishType,
                    DishGroup = dish.DishGroup,
                    BomLineCount = bomLineCount,
                    HasBom = hasBom,
                    Status = hasBom ? "complete" : "missing",
                    StatusLabel = hasBom ? "Đủ BOM" : "Thiếu định lượng"
                };
            })
            .ToList();

        return new BomCoverageReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalDishes = coverage.Count,
            CompleteDishes = coverage.Count(item => item.HasBom),
            MissingBomDishes = coverage.Count(item => !item.HasBom),
            TotalBomLines = activeBomLines.Count,
            Dishes = coverage
        };
    }

    public async Task<BomValidationReportDto> GetBomValidationAsync()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var dishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .OrderBy(dish => dish.DishCode)
            .ToListAsync();
        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .Where(line =>
                line.BomStatus == BomStatusPublished &&
                line.EffectiveFrom <= today &&
                (line.EffectiveTo == null || line.EffectiveTo >= today))
            .ToListAsync();
        var linesByDish = activeBomLines
            .GroupBy(line => GuidHelper.ToGuidString(line.DishId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var issues = new List<BomValidationIssueDto>();

        foreach (var dish in dishes)
        {
            var dishId = GuidHelper.ToGuidString(dish.DishId);
            if (!linesByDish.TryGetValue(dishId, out var dishLines) || dishLines.Count == 0)
            {
                issues.Add(CreateValidationIssue(
                    dish,
                    null,
                    "missing_bom",
                    "error",
                    "Món chưa có dòng BOM/định lượng đang hiệu lực."));
                continue;
            }

            foreach (var line in dishLines)
            {
                if (line.Ingredient is null || line.Ingredient.IsActive == false)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "missing_ingredient",
                        "error",
                        "Dòng BOM thiếu nguyên liệu hợp lệ hoặc nguyên liệu đã ngừng sử dụng."));
                }

                if (line.GrossQtyPerServing <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "zero_quantity",
                        "error",
                        "Định lượng trên mỗi suất phải lớn hơn 0."));
                }

                if (line.Unit is null || string.IsNullOrWhiteSpace(line.Unit.UnitCode) || line.Unit.ConvertRateToBase <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "unknown_unit",
                        "warning",
                        "Đơn vị tính thiếu mã hoặc hệ số quy đổi không hợp lệ."));
                }

                if (line.Ingredient is not null && line.Ingredient.ReferencePrice <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "missing_reference_price",
                        "warning",
                        "Nguyên liệu chưa có giá tham chiếu hợp lệ."));
                }
            }
        }

        return new BomValidationReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = issues.Count,
            MissingBomDishes = issues.Count(item => item.IssueCode == "missing_bom"),
            MissingIngredientLines = issues.Count(item => item.IssueCode == "missing_ingredient"),
            ZeroQuantityLines = issues.Count(item => item.IssueCode == "zero_quantity"),
            UnknownUnitLines = issues.Count(item => item.IssueCode == "unknown_unit"),
            MissingReferencePriceLines = issues.Count(item => item.IssueCode == "missing_reference_price"),
            Issues = issues
        };
    }

    public async Task<MenuImportHistoryDto> GetMenuImportHistoryAsync()
    {
        var latestBatch = await _context.Quantityimportbatches
            .AsNoTracking()
            .OrderByDescending(batch => batch.ImportedAt)
            .FirstOrDefaultAsync();
        var latestSchedule = await _context.Menuschedules
            .AsNoTracking()
            .OrderByDescending(schedule => schedule.WeekStartDate)
            .ThenByDescending(schedule => schedule.ServiceDate)
            .FirstOrDefaultAsync();
        var dishCount = await _context.Dishes.AsNoTracking().CountAsync(dish => dish.IsActive ?? true);
        var menuCount = await _context.Menus.AsNoTracking().CountAsync();
        var menuScheduleCount = await _context.Menuschedules.AsNoTracking().CountAsync();
        var bomLineCount = await _context.Dishboms.AsNoTracking().CountAsync();
        var bomAdjustedCount = await _context.Bomadjustments.AsNoTracking().CountAsync();
        var lastBomAdjustedAt = await _context.Bomadjustments
            .AsNoTracking()
            .OrderByDescending(item => item.AdjustedAt)
            .Select(item => (DateTime?)item.AdjustedAt)
            .FirstOrDefaultAsync();
        var importBatchCount = await _context.Quantityimportbatches.AsNoTracking().CountAsync();
        var warnings = new List<string>();

        if (latestBatch is null)
        {
            warnings.Add("Chưa tìm thấy batch import định lượng có thông tin source/file.");
        }
        if (latestSchedule is null)
        {
            warnings.Add("Chưa có lịch thực đơn được seed/import.");
        }
        if (bomLineCount == 0)
        {
            warnings.Add("Chưa có dòng BOM nào trong catalog.");
        }
        if (bomAdjustedCount == 0)
        {
            warnings.Add("Chưa có lịch sử cập nhật BOM; số BOM tạo/cập nhật đang là snapshot dòng hiện tại.");
        }

        return new MenuImportHistoryDto
        {
            GeneratedAt = DateTime.UtcNow,
            LastImportSource = latestBatch?.SourceType,
            LastImportFileOrBatch = latestBatch?.BatchCode ?? latestBatch?.SourceCompanyName,
            LastImportedAt = latestBatch?.ImportedAt,
            LatestMenuWeekStartDate = latestSchedule?.WeekStartDate,
            LatestMenuServiceDate = latestSchedule?.ServiceDate,
            DishCount = dishCount,
            MenuCount = menuCount,
            MenuScheduleCount = menuScheduleCount,
            BomLineCount = bomLineCount,
            BomAdjustedCount = bomAdjustedCount,
            LastBomAdjustedAt = lastBomAdjustedAt,
            MealQuantityImportBatchCount = importBatchCount,
            BomCreatedOrUpdatedCount = bomLineCount + bomAdjustedCount,
            Warnings = warnings
        };
    }

    public async Task<SampleImportStatusDto> GetSampleImportStatusAsync()
    {
        var customerCount = await _context.Customers.AsNoTracking().CountAsync();
        var dishCount = await _context.Dishes.AsNoTracking().CountAsync(dish => dish.IsActive ?? true);
        var bomLineCount = await _context.Dishboms.AsNoTracking().CountAsync();
        var menuScheduleCount = await _context.Menuschedules.AsNoTracking().CountAsync();
        var mealPlanCount = await _context.Mealquantityplans.AsNoTracking().CountAsync();
        var stockCount = await _context.Currentstocks.AsNoTracking().CountAsync();
        var reportSourceCount =
            await _context.Materialrequests.AsNoTracking().CountAsync() +
            await _context.Purchaserequests.AsNoTracking().CountAsync() +
            await _context.Inventoryissues.AsNoTracking().CountAsync() +
            await _context.Inventoryreturns.AsNoTracking().CountAsync() +
            await _context.Stockmovements.AsNoTracking().CountAsync() +
            await _context.Bomadjustments.AsNoTracking().CountAsync() +
            await _context.Quantityadjustments.AsNoTracking().CountAsync();
        var domains = new List<SampleImportDomainStatusDto>
        {
            BuildDomainStatus("customers", "Khách hàng", customerCount, "Có dữ liệu khách hàng để lập kế hoạch suất ăn."),
            BuildDomainStatus("dishes", "Món ăn", dishCount, "Có catalog món ăn."),
            BuildDomainStatus("bom", "BOM/định lượng", bomLineCount, "Có dòng định lượng nguyên liệu cho món ăn."),
            BuildDomainStatus("menuSchedules", "Lịch thực đơn", menuScheduleCount, "Có lịch thực đơn theo ngày/ca."),
            BuildDomainStatus("mealPlans", "Kế hoạch suất ăn", mealPlanCount, "Có kế hoạch số suất/định lượng."),
            BuildDomainStatus("stock", "Tồn kho", stockCount, "Có tồn kho hiện tại."),
            BuildDomainStatus("reports", "Dữ liệu báo cáo", reportSourceCount, "Có dữ liệu nguồn cho báo cáo vận hành.")
        };

        return new SampleImportStatusDto
        {
            GeneratedAt = DateTime.UtcNow,
            OverallStatus = domains.All(domain => domain.IsReady) ? "ready" : "incomplete",
            Domains = domains
        };
    }

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
        ClearCatalogCache();
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
        ClearCatalogCache();
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
        ClearCatalogCache();
        return true;
    }

    public async Task<DishCatalogBomLineDto?> AddBomLineAsync(string dishId, CreateDishBomLineDto dto)
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

        var effectiveFrom = dto.EffectiveFrom ?? DateOnly.FromDateTime(DateTime.Today);
        var bomStatus = NormalizeBomStatus(dto.BomStatus);
        if (dto.EffectiveTo is not null && dto.EffectiveTo < effectiveFrom)
        {
            throw new ArgumentException("Ngày hết hiệu lực phải sau ngày bắt đầu.");
        }

        if (bomStatus == BomStatusPublished &&
            await HasOverlappingBomLineAsync(dishBytes, ingredientBytes, unitBytes, effectiveFrom, dto.EffectiveTo))
        {
            throw new InvalidOperationException("Món ăn đã có dòng BOM trùng nguyên liệu, đơn vị và khoảng hiệu lực.");
        }

        var entity = new Dishbom
        {
            BomId = GuidHelper.NewId(),
            DishId = dishBytes,
            IngredientId = ingredientBytes,
            UnitId = unitBytes,
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
        UpdateDishBomLineDto dto,
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
        var targetGrossQty = entity.GrossQtyPerServing;
        var targetWasteRate = entity.WasteRatePercent;
        var targetEffectiveFrom = dto.EffectiveFrom ?? entity.EffectiveFrom;
        var targetEffectiveTo = dto.EffectiveTo ?? entity.EffectiveTo;
        var targetStatus = NormalizeBomStatus(dto.BomStatus, entity.BomStatus);

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
            targetGrossQty != entity.GrossQtyPerServing ||
            targetWasteRate != entity.WasteRatePercent ||
            targetEffectiveFrom != entity.EffectiveFrom;
        var shouldCreateNewVersion = IsPublishedBomLine(entity) && versionedFieldsChanged;

        if (shouldCreateNewVersion)
        {
            if (targetStatus == BomStatusPublished)
            {
                if (targetEffectiveFrom <= entity.EffectiveFrom)
                {
                    throw new ArgumentException("Ngày hiệu lực version mới phải sau ngày bắt đầu của dòng BOM published hiện tại.");
                }

                if (await HasOverlappingBomLineAsync(
                    dishBytes,
                    targetIngredientId,
                    targetUnitId,
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

            var newVersion = new Dishbom
            {
                BomId = GuidHelper.NewId(),
                DishId = entity.DishId,
                IngredientId = targetIngredientId,
                UnitId = targetUnitId,
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

        if (targetStatus == BomStatusPublished &&
            await HasOverlappingBomLineAsync(
            dishBytes,
            targetIngredientId,
            targetUnitId,
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

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (entity.EffectiveTo is null || entity.EffectiveTo > today)
        {
            entity.EffectiveTo = entity.EffectiveFrom > today ? entity.EffectiveFrom : today;
        }

        await _context.SaveChangesAsync();
        ClearCatalogCache();
        return true;
    }

    private void ClearCatalogCache()
    {
        _cache.Remove(CatalogCacheKey);
        _cache.Remove($"{CatalogCacheKey}:all");
    }

    private static BomValidationIssueDto CreateValidationIssue(
        Dish dish,
        Dishbom? line,
        string issueCode,
        string severity,
        string message) => new()
    {
        DishId = GuidHelper.ToGuidString(dish.DishId),
        DishCode = dish.DishCode,
        DishName = dish.DishName,
        BomId = line is null ? null : GuidHelper.ToGuidString(line.BomId),
        IngredientId = line is null ? null : GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line?.Ingredient?.IngredientName,
        IssueCode = issueCode,
        Severity = severity,
        Message = message
    };

    private static SampleImportDomainStatusDto BuildDomainStatus(
        string domain,
        string displayName,
        int rowCount,
        string readyNotes)
    {
        var isReady = rowCount > 0;
        return new SampleImportDomainStatusDto
        {
            Domain = domain,
            DisplayName = displayName,
            RowCount = rowCount,
            IsReady = isReady,
            Status = isReady ? "ready" : "missing",
            Notes = isReady ? readyNotes : "Chưa có dữ liệu hoặc dữ liệu chưa được import/seed."
        };
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

    private static DishCatalogDto MapToCatalogDto(Dish e) => new()
    {
        DishId = GuidHelper.ToGuidString(e.DishId),
        DishCode = e.DishCode,
        DishName = e.DishName,
        DishType = e.DishType,
        DishGroup = e.DishGroup,
        IsActive = e.IsActive ?? true,
        MenuSlots = e.Menuitems
            .Where(item => !string.IsNullOrWhiteSpace(item.DishSlot))
            .OrderBy(item => item.DisplayOrder)
            .Select(item => item.DishSlot!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList(),
        BomLines = e.Dishboms
            .OrderBy(bom => bom.Ingredient.IngredientName)
            .ThenBy(bom => bom.EffectiveFrom)
            .Select(MapCatalogBomLine)
            .ToList()
    };

    private static DishCatalogBomLineDto MapCatalogBomLine(Dishbom bom) => new()
    {
        BomId = GuidHelper.ToGuidString(bom.BomId),
        IngredientId = GuidHelper.ToGuidString(bom.IngredientId),
        IngredientCode = bom.Ingredient.IngredientCode,
        IngredientName = bom.Ingredient.IngredientName,
        UnitId = GuidHelper.ToGuidString(bom.UnitId),
        UnitCode = bom.Unit.UnitCode,
        UnitName = bom.Unit.UnitName,
        GrossQtyPerServing = bom.GrossQtyPerServing,
        WasteRatePercent = bom.WasteRatePercent,
        BomStatus = NormalizeBomStatus(bom.BomStatus),
        BomStatusLabel = MapBomStatusLabel(bom.BomStatus),
        EffectiveFrom = bom.EffectiveFrom,
        EffectiveTo = bom.EffectiveTo,
        ReferencePrice = bom.Ingredient.ReferencePrice
    };

    private IQueryable<Dishbom> QueryBomLines(byte[] dishBytes)
        => _context.Dishboms
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .Where(line => line.DishId == dishBytes);

    private Task<bool> HasOverlappingBomLineAsync(
        byte[] dishId,
        byte[] ingredientId,
        byte[] unitId,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo,
        byte[]? excludeBomId = null)
    {
        var effectiveToValue = effectiveTo ?? DateOnly.MaxValue;
        var query = _context.Dishboms.Where(line =>
            line.DishId == dishId &&
            line.IngredientId == ingredientId &&
            line.UnitId == unitId);

        if (excludeBomId is not null)
        {
            query = query.Where(line => line.BomId != excludeBomId);
        }

        return query.AnyAsync(line =>
            line.BomStatus == BomStatusPublished &&
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

        _context.Bomadjustments.Add(new Bomadjustment
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

    private static bool IsPublishedBomLine(Dishbom bom) => NormalizeBomStatus(bom.BomStatus) == BomStatusPublished;

    private static string NormalizeBomStatus(string? status, string fallback = BomStatusPublished)
    {
        var value = string.IsNullOrWhiteSpace(status) ? fallback : status.Trim().ToUpperInvariant();
        return value switch
        {
            BomStatusDraft => BomStatusDraft,
            BomStatusPublished => BomStatusPublished,
            BomStatusArchived => BomStatusArchived,
            _ => throw new ArgumentException("Trạng thái BOM không hợp lệ.")
        };
    }

    private static string MapBomStatusLabel(string? status) => NormalizeBomStatus(status) switch
    {
        BomStatusDraft => "Draft",
        BomStatusPublished => "Published",
        BomStatusArchived => "Archived",
        _ => "Published"
    };
}
