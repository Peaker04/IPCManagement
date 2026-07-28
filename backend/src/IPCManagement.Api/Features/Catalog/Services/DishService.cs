using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public class DishService : IDishService
{
    private readonly IDishCatalogService _catalogService;
    private readonly IDishCatalogDiagnosticsService _diagnosticsService;
    private readonly IpcManagementContext _context;
    private readonly IMemoryCache _cache;
    private const string BomStatusDraft = "DRAFT";
    private const string BomStatusPublished = "PUBLISHED";
    private const string BomStatusArchived = "ARCHIVED";
    private const int BlankBomRowsPerDish = 8;
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];

    public DishService(IDishRepository dishRepo, IpcManagementContext context, IMemoryCache cache)
        : this(
            dishRepo,
            context,
            cache,
            new DishCatalogService(dishRepo, context, cache),
            new DishCatalogDiagnosticsService(context))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService)
        : this(dishRepo, context, cache, catalogService, new DishCatalogDiagnosticsService(context))
    {
    }

    public DishService(
        IDishRepository dishRepo,
        IpcManagementContext context,
        IMemoryCache cache,
        IDishCatalogService catalogService,
        IDishCatalogDiagnosticsService diagnosticsService)
    {
        _catalogService = catalogService;
        _diagnosticsService = diagnosticsService;
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
    public async Task<byte[]> BuildBomTemplateWorkbookAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default)
    {
        var priceTier = NormalizePriceTier(query.PriceTier);
        var customerId = ParseOptionalCustomerId(query.CustomerId);
        var dishId = ParseOptionalDishId(query.DishId);
        var templateType = NormalizeBomTemplateType(query.TemplateType, dishId is not null);
        var customerCode = await ResolveCustomerCodeAsync(customerId, cancellationToken);
        var rows = new List<IReadOnlyList<string>>();
        var today = ServiceCalendar.Today();

        if (templateType != "blank")
        {
            var dishesQuery = _context.Dishes
            .AsNoTracking()
            .Include(dish => dish.Dishboms)
                .ThenInclude(bom => bom.Ingredient)
            .Include(dish => dish.Dishboms)
                .ThenInclude(bom => bom.Unit)
            .Where(dish => dish.IsActive ?? true);

            if (dishId is not null)
            {
                dishesQuery = dishesQuery.Where(dish => dish.DishId.SequenceEqual(dishId));
            }

            var dishes = await dishesQuery
                .OrderBy(dish => dish.DishCode)
                .ToListAsync(cancellationToken);
            var effectiveFrom = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            foreach (var dish in dishes)
            {
                var currentLines = query.IncludeCurrent
                    ? dish.Dishboms
                        .Where(line => line.PriceTierAmount == priceTier)
                        .Where(line => MatchesBomCustomerScope(line.CustomerId, customerId))
                        .Where(line => IsPublishedBomLine(line))
                        .Where(line => line.EffectiveFrom <= today && (line.EffectiveTo is null || line.EffectiveTo >= today))
                        .OrderBy(line => line.Ingredient.IngredientName)
                        .ToList()
                    : [];

                if (templateType == "missing" && currentLines.Count > 0)
                {
                    continue;
                }

                if (currentLines.Count == 0)
                {
                    AddBlankBomRows(rows, dish, priceTier, customerCode, effectiveFrom);
                    continue;
                }

                foreach (var line in currentLines)
                {
                    rows.Add([
                        dish.DishCode,
                        dish.DishName,
                        priceTier.ToString("0.##", CultureInfo.InvariantCulture),
                        customerCode ?? string.Empty,
                        line.Ingredient.IngredientName,
                        line.Unit.UnitCode,
                        line.GrossQtyPerServing.ToString("0.######", CultureInfo.InvariantCulture),
                        line.WasteRatePercent.ToString("0.##", CultureInfo.InvariantCulture),
                        line.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        line.EffectiveTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                        line.BomStatus,
                        string.Empty
                    ]);
                }
            }
        }

        var scope = customerCode is null ? "Global" : $"Customer {customerCode}";
        return BomTemplateWorkbookBuilder.Build(priceTier, $"{scope} / {templateType}", today, rows);
    }

    public async Task<BomImportPreviewDto> PreviewBomImportAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken = default)
        => await BuildBomImportPreviewAsync(fileStream, request, cancellationToken);

    public async Task<BomImportCommitResultDto> CommitBomImportAsync(
        Stream fileStream,
        BomImportCommitRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var preview = await BuildBomImportPreviewAsync(fileStream, request, cancellationToken);
        if (!preview.CanCommit)
        {
            throw new InvalidOperationException("File BOM còn lỗi, cần sửa preview trước khi commit.");
        }

        var priceTier = NormalizePriceTier(request.PriceTier);
        var customerId = ParseOptionalCustomerId(request.CustomerId);
        var actor = GuidHelper.ParseGuidString(userId);
        var rows = await ParseBomImportRowsAsync(fileStream, request, cancellationToken);
        var validRows = rows.Where(row => row.Errors.Count == 0).ToList();
        var now = DateTime.UtcNow;
        var created = 0;
        var updated = 0;
        var archived = 0;
        var batchCode = $"BOM-{priceTier:0}-{now:yyyyMMddHHmmss}";

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var importedIngredients = new Dictionary<string, Ingredient>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in validRows)
        {
            var effectiveFrom = row.EffectiveFrom;
            var effectiveTo = row.EffectiveTo;
            var status = NormalizeBomStatus(row.BomStatus);
            var ingredient = row.Ingredient ?? await CreateImportedIngredientAsync(row, importedIngredients, cancellationToken);
            var unit = row.Unit!;
            var existing = await _context.Dishboms
                .Include(line => line.Ingredient)
                .Include(line => line.Unit)
                .Where(line =>
                    line.DishId == row.Dish!.DishId &&
                    line.IngredientId == ingredient.IngredientId &&
                    line.UnitId == unit.UnitId &&
                    line.PriceTierAmount == priceTier &&
                    line.EffectiveFrom <= (effectiveTo ?? DateOnly.MaxValue) &&
                    (line.EffectiveTo == null || line.EffectiveTo >= effectiveFrom))
                .Where(line => customerId == null
                    ? line.CustomerId == null
                    : line.CustomerId != null && line.CustomerId.SequenceEqual(customerId))
                .OrderByDescending(line => line.EffectiveFrom)
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null && IsPublishedBomLine(existing))
            {
                if (existing.EffectiveFrom < effectiveFrom && (existing.EffectiveTo is null || existing.EffectiveTo >= effectiveFrom))
                {
                    existing.EffectiveTo = effectiveFrom.AddDays(-1);
                    archived++;
                }

                if (existing.EffectiveFrom == effectiveFrom)
                {
                    var oldGross = existing.GrossQtyPerServing;
                    var oldWaste = existing.WasteRatePercent;
                    existing.GrossQtyPerServing = DecimalPolicy.RoundQuantity(row.GrossQtyPerServing);
                    existing.WasteRatePercent = row.WasteRatePercent;
                    existing.EffectiveTo = effectiveTo;
                    existing.BomStatus = status;
                    AddBomAdjustmentIfNeeded(existing.BomId, oldGross, existing.GrossQtyPerServing, oldWaste, existing.WasteRatePercent, row.Note, userId);
                    updated++;
                    continue;
                }
            }

            var entity = new DishBom
            {
                BomId = GuidHelper.NewId(),
                DishId = row.Dish!.DishId,
                IngredientId = ingredient.IngredientId,
                UnitId = unit.UnitId,
                CustomerId = customerId,
                PriceTierAmount = priceTier,
                GrossQtyPerServing = DecimalPolicy.RoundQuantity(row.GrossQtyPerServing),
                WasteRatePercent = row.WasteRatePercent,
                BomStatus = status,
                EffectiveFrom = effectiveFrom,
                EffectiveTo = effectiveTo
            };
            _context.Dishboms.Add(entity);
            created++;
        }

        if (actor is not null)
        {
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = now,
                ChangedBy = actor,
                BusinessArea = "BOM",
                EntityName = nameof(DishBom),
                EntityId = actor,
                FieldName = "BulkImport",
                OldValue = null,
                NewValue = $"{batchCode}; created={created}; updated={updated}; archived={archived}; rows={validRows.Count}; tier={priceTier}; scope={preview.BomScope}",
                Reason = "Import BOM theo đơn giá/khách hàng từ file Excel-compatible."
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        ClearCatalogCache();

        return new BomImportCommitResultDto
        {
            GeneratedAt = DateTime.UtcNow,
            PriceTier = preview.PriceTier,
            CustomerId = preview.CustomerId,
            BomScope = preview.BomScope,
            TotalRows = preview.TotalRows,
            ValidRows = preview.ValidRows,
            ErrorRows = preview.ErrorRows,
            WarningRows = preview.WarningRows,
            CanCommit = true,
            Rows = preview.Rows,
            Warnings = preview.Warnings,
            CreatedRows = created,
            UpdatedRows = updated,
            ArchivedRows = archived,
            AuditBatchCode = batchCode
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
        var bomStatus = NormalizeBomStatus(dto.BomStatus);
        var priceTier = NormalizePriceTier(dto.PriceTierAmount ?? 25000m);
        var customerId = ParseOptionalCustomerId(dto.CustomerId);
        if (dto.EffectiveTo is not null && dto.EffectiveTo < effectiveFrom)
        {
            throw new ArgumentException("Ngày hết hiệu lực phải sau ngày bắt đầu.");
        }

        if (bomStatus == BomStatusPublished &&
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

        if (dto.CustomerId is not null)
        {
            targetCustomerId = ParseOptionalCustomerId(dto.CustomerId);
        }
        if (dto.PriceTierAmount is not null)
        {
            targetPriceTier = NormalizePriceTier(dto.PriceTierAmount.Value);
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
            !MatchesBomCustomerScope(entity.CustomerId, targetCustomerId) ||
            targetPriceTier != entity.PriceTierAmount ||
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

        if (targetStatus == BomStatusPublished &&
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

    private async Task<BomImportPreviewDto> BuildBomImportPreviewAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        var priceTier = NormalizePriceTier(request.PriceTier);
        var customerId = ParseOptionalCustomerId(request.CustomerId);
        var rows = await ParseBomImportRowsAsync(fileStream, request, cancellationToken);
        var duplicateKeys = rows
            .GroupBy(row => $"{row.DishCode}|{row.IngredientCode}|{row.UnitCode}|{row.EffectiveFrom:yyyy-MM-dd}")
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var overlapRows = rows
            .Where(row =>
                !string.IsNullOrWhiteSpace(row.DishCode) &&
                !string.IsNullOrWhiteSpace(row.IngredientCode) &&
                !string.IsNullOrWhiteSpace(row.UnitCode))
            .GroupBy(row => $"{row.DishCode}|{row.IngredientCode}|{row.UnitCode}", StringComparer.OrdinalIgnoreCase)
            .SelectMany(group =>
            {
                var groupRows = group.ToList();
                var rowNumbers = new HashSet<int>();
                for (var i = 0; i < groupRows.Count; i++)
                {
                    for (var j = i + 1; j < groupRows.Count; j++)
                    {
                        if (DateRangesOverlap(
                            groupRows[i].EffectiveFrom,
                            groupRows[i].EffectiveTo,
                            groupRows[j].EffectiveFrom,
                            groupRows[j].EffectiveTo))
                        {
                            rowNumbers.Add(groupRows[i].RowNumber);
                            rowNumbers.Add(groupRows[j].RowNumber);
                        }
                    }
                }

                return rowNumbers;
            })
            .ToHashSet();

        var previewRows = rows.Select(row =>
        {
            var errors = row.Errors.ToList();
            var warnings = row.Warnings.ToList();
            var key = $"{row.DishCode}|{row.IngredientCode}|{row.UnitCode}|{row.EffectiveFrom:yyyy-MM-dd}";
            if (duplicateKeys.Contains(key))
            {
                errors.Add("Trùng dish/ingredient/unit/effective date trong file.");
            }
            if (overlapRows.Contains(row.RowNumber))
            {
                errors.Add("Khoảng hiệu lực BOM bị overlap trong file.");
            }

            return new BomImportPreviewRowDto
            {
                RowNumber = row.RowNumber,
                DishCode = row.DishCode,
                DishName = row.Dish?.DishName ?? row.DishName,
                IngredientCode = row.IngredientCode,
                IngredientName = row.Ingredient?.IngredientName ?? row.IngredientName,
                UnitCode = row.Unit?.UnitCode ?? row.UnitCode,
                GrossQtyPerServing = row.GrossQtyPerServing,
                WasteRatePercent = row.WasteRatePercent,
                EffectiveFrom = row.EffectiveFrom,
                EffectiveTo = row.EffectiveTo,
                Status = errors.Count > 0 ? "error" : warnings.Count > 0 ? "warning" : "valid",
                Action = errors.Count > 0 ? "blocked" : row.Action,
                Errors = errors,
                Warnings = warnings
            };
        }).ToList();

        return new BomImportPreviewDto
        {
            GeneratedAt = DateTime.UtcNow,
            PriceTier = priceTier,
            CustomerId = customerId is null ? null : GuidHelper.ToGuidString(customerId),
            BomScope = customerId is null ? "global" : "customer",
            TotalRows = previewRows.Count,
            ValidRows = previewRows.Count(row => row.Errors.Count == 0),
            ErrorRows = previewRows.Count(row => row.Errors.Count > 0),
            WarningRows = previewRows.Count(row => row.Warnings.Count > 0),
            CanCommit = previewRows.Count > 0 && previewRows.All(row => row.Errors.Count == 0),
            Rows = previewRows,
            Warnings = []
        };
    }

    private async Task<List<BomImportRow>> ParseBomImportRowsAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        var priceTier = NormalizePriceTier(request.PriceTier);
        var customerId = ParseOptionalCustomerId(request.CustomerId);
        var importRows = await ReadBomImportSourceRowsAsync(fileStream, cancellationToken);
        if (importRows.Count == 0)
        {
            return [];
        }

        var dishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .ToDictionaryAsync(dish => dish.DishCode.Trim(), StringComparer.OrdinalIgnoreCase, cancellationToken);
        var ingredientList = await _context.Ingredients
            .AsNoTracking()
            .Include(item => item.Unit)
            .Where(item => item.IsActive ?? true)
            .ToListAsync(cancellationToken);
        var ingredients = ingredientList
            .ToDictionary(item => item.IngredientCode.Trim(), StringComparer.OrdinalIgnoreCase);
        var ingredientNameGroups = ingredientList
            .GroupBy(item => NormalizeIngredientLookupKey(item.IngredientName, item.Unit.UnitCode), StringComparer.OrdinalIgnoreCase)
            .ToList();
        var ingredientsByNameUnit = ingredientNameGroups
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single(), StringComparer.OrdinalIgnoreCase);
        var ambiguousIngredientNameUnits = ingredientNameGroups
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var usedIngredientCodes = ingredientList
            .Select(item => item.IngredientCode.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasWarehouse = await _context.Warehouses
            .AsNoTracking()
            .AnyAsync(cancellationToken);
        var units = await _context.Units
            .AsNoTracking()
            .ToDictionaryAsync(item => item.UnitCode.Trim(), StringComparer.OrdinalIgnoreCase, cancellationToken);
        var existingLines = await _context.Dishboms
            .AsNoTracking()
            .Where(line => line.PriceTierAmount == priceTier)
            .Where(line => customerId == null ? line.CustomerId == null : line.CustomerId != null && line.CustomerId.SequenceEqual(customerId))
            .ToListAsync(cancellationToken);

        var result = new List<BomImportRow>();
        foreach (var importRow in importRows)
        {
            string Get(string name)
                => importRow.Cells.GetValueOrDefault(NormalizeHeader(name), string.Empty).Trim();

            var errors = new List<string>();
            var warnings = new List<string>();
            var dishCode = Get("DishCode");
            var dishName = Get("DishName");
            var ingredientCode = Get("IngredientCode");
            var ingredientName = Get("IngredientName");
            var unitCode = Get("UnitCode");
            var grossQtyText = Get("GrossQtyPerServing");
            var wasteRateText = Get("WasteRatePercent");
            if (IsBlankBomEntry(ingredientCode, ingredientName, unitCode, grossQtyText, wasteRateText))
            {
                continue;
            }

            var tierText = Get("PriceTier");
            var hasTierText = !string.IsNullOrWhiteSpace(tierText);
            var normalizedRowTier = default(decimal);
            if (hasTierText && !TryNormalizeImportPriceTier(tierText, out normalizedRowTier))
            {
                errors.Add("PriceTier chỉ được là 25000, 30000 hoặc 34000.");
            }
            else if (hasTierText && normalizedRowTier != priceTier)
            {
                errors.Add("PriceTier trong file không khớp với tier đang import.");
            }

            dishes.TryGetValue(dishCode, out var dish);
            var ingredient = default(Ingredient);
            if (!string.IsNullOrWhiteSpace(ingredientCode))
            {
                ingredients.TryGetValue(ingredientCode, out ingredient);
            }
            if (ingredient is not null && string.IsNullOrWhiteSpace(unitCode))
            {
                unitCode = ingredient.Unit.UnitCode;
            }

            units.TryGetValue(unitCode, out var unit);
            if (ingredient is null && string.IsNullOrWhiteSpace(ingredientCode) && !string.IsNullOrWhiteSpace(ingredientName) && unit is not null)
            {
                var nameUnitKey = NormalizeIngredientLookupKey(ingredientName, unit.UnitCode);
                if (ambiguousIngredientNameUnits.Contains(nameUnitKey))
                {
                    errors.Add("IngredientName + UnitCode đang trùng nhiều nguyên liệu, cần nhập IngredientCode để map chính xác.");
                }
                else if (ingredientsByNameUnit.TryGetValue(nameUnitKey, out var matchedIngredient))
                {
                    ingredient = matchedIngredient;
                    ingredientCode = matchedIngredient.IngredientCode;
                    ingredientName = matchedIngredient.IngredientName;
                }
            }

            if (dish is null)
            {
                errors.Add("DishCode không tồn tại hoặc món đã ngừng sử dụng.");
            }
            if (string.IsNullOrWhiteSpace(ingredientCode) && string.IsNullOrWhiteSpace(ingredientName))
            {
                errors.Add("IngredientName bắt buộc khi không nhập IngredientCode.");
            }
            else if (!string.IsNullOrWhiteSpace(ingredientCode) && ingredient is null)
            {
                errors.Add("IngredientCode không tồn tại hoặc nguyên liệu đã ngừng sử dụng.");
            }
            if (unit is null)
            {
                errors.Add("UnitCode không tồn tại.");
            }
            else if (ingredient is null && string.IsNullOrWhiteSpace(ingredientCode))
            {
                if (!hasWarehouse)
                {
                    errors.Add("Chưa có kho nguyên liệu để tự tạo IngredientCode mới.");
                }
                else
                {
                    ingredientCode = CreateUniqueIngredientCode(ingredientName, usedIngredientCodes);
                    warnings.Add($"Nguyên liệu mới sẽ được tạo khi commit: {ingredientCode}.");
                }
            }

            if (!decimal.TryParse(grossQtyText, NumberStyles.Number, CultureInfo.InvariantCulture, out var grossQty) || grossQty <= 0)
            {
                errors.Add("GrossQtyPerServing phải lớn hơn 0.");
            }
            if (!decimal.TryParse(wasteRateText, NumberStyles.Number, CultureInfo.InvariantCulture, out var wasteRate) || wasteRate < 0 || wasteRate > 100)
            {
                errors.Add("WasteRatePercent phải nằm trong 0-100.");
            }
            if (!DateOnly.TryParse(Get("EffectiveFrom"), CultureInfo.InvariantCulture, DateTimeStyles.None, out var effectiveFrom))
            {
                effectiveFrom = request.EffectiveFrom ?? ServiceCalendar.Today();
                warnings.Add("EffectiveFrom trống/không hợp lệ, dùng ngày mặc định.");
            }
            DateOnly? effectiveTo = null;
            var effectiveToText = Get("EffectiveTo");
            var parsedEffectiveTo = default(DateOnly);
            if (!string.IsNullOrWhiteSpace(effectiveToText) &&
                !DateOnly.TryParse(effectiveToText, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsedEffectiveTo))
            {
                errors.Add("EffectiveTo không hợp lệ.");
            }
            else if (!string.IsNullOrWhiteSpace(effectiveToText))
            {
                effectiveTo = parsedEffectiveTo;
            }
            if (effectiveTo is not null && effectiveTo < effectiveFrom)
            {
                errors.Add("EffectiveTo phải sau EffectiveFrom.");
            }

            var status = Get("BomStatus");
            if (string.IsNullOrWhiteSpace(status))
            {
                status = BomStatusPublished;
            }
            else
            {
                try
                {
                    status = NormalizeBomStatus(status);
                }
                catch (ArgumentException ex)
                {
                    errors.Add(ex.Message);
                }
            }

            var action = "create";
            if (dish is not null && ingredient is not null && unit is not null)
            {
                var overlap = existingLines.FirstOrDefault(line =>
                    line.DishId.SequenceEqual(dish.DishId) &&
                    line.IngredientId.SequenceEqual(ingredient.IngredientId) &&
                    line.UnitId.SequenceEqual(unit.UnitId) &&
                    line.EffectiveFrom <= (effectiveTo ?? DateOnly.MaxValue) &&
                    (line.EffectiveTo == null || line.EffectiveTo >= effectiveFrom));
                action = overlap is null ? "create" : overlap.EffectiveFrom == effectiveFrom ? "update" : "version";
            }

            result.Add(new BomImportRow(
                importRow.RowNumber,
                dishCode,
                dishName,
                ingredientCode,
                ingredientName,
                unitCode,
                grossQty,
                wasteRate,
                effectiveFrom,
                effectiveTo,
                status,
                Get("Note"),
                action,
                dish,
                ingredient,
                unit,
                errors,
                warnings));
        }

        return result;
    }

    private static async Task<IReadOnlyList<BomImportSourceRow>> ReadBomImportSourceRowsAsync(
        Stream fileStream,
        CancellationToken cancellationToken)
    {
        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
        }

        // Trần cứng XlsxSecurityLimits.MaxUploadBytes (10 MB) — trùng mức [RequestSizeLimit]
        // của hai endpoint bom-import. Trước đây CopyToAsync nạp trọn upload vào MemoryStream
        // không giới hạn rồi ToArray() nhân đôi mức chiếm RAM; đó là DoS bộ nhớ trực tiếp.
        // Hàng rào ở đây là lớp phòng thủ thứ hai: service vẫn an toàn khi được gọi từ nơi
        // không đi qua pipeline HTTP (job nền, test).
        var bytes = await XlsxSecurityLimits.ReadAllBytesWithinLimitAsync(
            fileStream,
            "File import BOM",
            cancellationToken);
        if (bytes.Length == 0)
        {
            return [];
        }

        return IsXlsx(bytes)
            ? ReadBomImportWorkbookRows(bytes)
            : ReadBomImportCsvRows(bytes, cancellationToken);
    }

    private static bool IsXlsx(byte[] bytes)
        => bytes.Length >= 2 && bytes[0] == (byte)'P' && bytes[1] == (byte)'K';

    private static IReadOnlyList<BomImportSourceRow> ReadBomImportCsvRows(
        byte[] bytes,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(new MemoryStream(bytes), Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var content = reader.ReadToEndAsync(cancellationToken).GetAwaiter().GetResult();
        var lines = content.Split(["\r\n", "\n"], StringSplitOptions.None);
        if (lines.Length <= 1)
        {
            return [];
        }

        var header = SplitCsvLine(lines[0]).Select(NormalizeHeader).ToList();
        var result = new List<BomImportSourceRow>();
        for (var i = 1; i < lines.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i]))
            {
                continue;
            }

            var cells = SplitCsvLine(lines[i]);
            var mapped = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var cellIndex = 0; cellIndex < header.Count && cellIndex < cells.Count; cellIndex++)
            {
                mapped[header[cellIndex]] = cells[cellIndex];
            }

            result.Add(new BomImportSourceRow(i + 1, mapped));
        }

        return result;
    }

    private static IReadOnlyList<BomImportSourceRow> ReadBomImportWorkbookRows(byte[] bytes)
    {
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            File.WriteAllBytes(tempFilePath, bytes);
            var reader = new XlsxWorkbookReader();
            var sheetNames = reader.GetSheetNames(tempFilePath);
            var sheetName = sheetNames.FirstOrDefault(name => string.Equals(name, "BOM", StringComparison.OrdinalIgnoreCase))
                ?? sheetNames.FirstOrDefault()
                ?? throw new InvalidOperationException("File Excel không có sheet BOM.");
            var rows = reader.ReadRowsWithMetadata(tempFilePath, sheetName);
            var headerRow = rows.FirstOrDefault(row =>
                BomTemplateWorkbookBuilder.Headers.All(header =>
                    row.Cells.Values.Any(value => NormalizeHeader(value) == NormalizeHeader(header))));
            if (headerRow is null)
            {
                throw new InvalidOperationException("File Excel BOM thiếu dòng header đúng cấu trúc.");
            }

            var headersByColumn = headerRow.Cells
                .Where(item => !string.IsNullOrWhiteSpace(item.Value))
                .ToDictionary(item => item.Key, item => NormalizeHeader(item.Value), StringComparer.OrdinalIgnoreCase);

            return rows
                .Where(row => row.RowNumber > headerRow.RowNumber)
                .Where(row => row.Cells.Values.Any(value => !string.IsNullOrWhiteSpace(value)))
                .Select(row =>
                {
                    var mapped = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var (column, header) in headersByColumn)
                    {
                        mapped[header] = row.Cells.GetValueOrDefault(column, string.Empty);
                    }

                    return new BomImportSourceRow(row.RowNumber, mapped);
                })
                .ToList();
        }
        finally
        {
            if (File.Exists(tempFilePath))
            {
                File.Delete(tempFilePath);
            }
        }
    }

    private static List<string> SplitCsvLine(string line)
    {
        var result = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    cell.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (ch == ',' && !inQuotes)
            {
                result.Add(cell.ToString());
                cell.Clear();
                continue;
            }

            cell.Append(ch);
        }

        result.Add(cell.ToString());
        return result;
    }

    private static string NormalizeHeader(string value)
        => value.Trim().Replace(" ", string.Empty, StringComparison.OrdinalIgnoreCase).ToUpperInvariant();

    private static bool IsBlankBomEntry(
        string ingredientCode,
        string ingredientName,
        string unitCode,
        string grossQty,
        string wasteRate)
        => string.IsNullOrWhiteSpace(ingredientCode) &&
           string.IsNullOrWhiteSpace(ingredientName) &&
           string.IsNullOrWhiteSpace(unitCode) &&
           string.IsNullOrWhiteSpace(grossQty) &&
           string.IsNullOrWhiteSpace(wasteRate);

    private static string NormalizeIngredientLookupKey(string ingredientName, string unitCode)
        => $"{NormalizeTextKey(ingredientName)}|{NormalizeTextKey(unitCode)}";

    private static string NormalizeTextKey(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(ch))
            {
                builder.Append(char.ToUpperInvariant(ch));
            }
        }

        return builder.ToString();
    }

    private static string CreateUniqueIngredientCode(string ingredientName, ISet<string> usedCodes)
    {
        var baseCode = CreateIngredientCodeBase(ingredientName);
        var candidate = baseCode;
        for (var suffix = 2; usedCodes.Contains(candidate); suffix++)
        {
            var trimmedBase = baseCode.Length > 44 ? baseCode[..44] : baseCode;
            candidate = $"{trimmedBase}-{suffix}";
        }

        usedCodes.Add(candidate);
        return candidate;
    }

    private static string CreateIngredientCodeBase(string ingredientName)
    {
        var key = NormalizeTextKey(ingredientName);
        if (string.IsNullOrWhiteSpace(key))
        {
            key = "NEW";
        }

        return $"ING-{(key.Length > 32 ? key[..32] : key)}";
    }

    private static string ToCsvLine(IEnumerable<string> cells)
        => string.Join(",", cells.Select(cell => $"\"{(cell ?? string.Empty).Replace("\"", "\"\"")}\""));

    private async Task<Ingredient> CreateImportedIngredientAsync(
        BomImportRow row,
        IDictionary<string, Ingredient> importedIngredients,
        CancellationToken cancellationToken)
    {
        if (importedIngredients.TryGetValue(row.IngredientCode, out var cachedIngredient))
        {
            return cachedIngredient;
        }

        var existingIngredient = await _context.Ingredients
            .Include(item => item.Unit)
            .FirstOrDefaultAsync(item => item.IngredientCode == row.IngredientCode, cancellationToken);
        if (existingIngredient is not null)
        {
            importedIngredients[row.IngredientCode] = existingIngredient;
            return existingIngredient;
        }

        var warehouseId = await _context.Warehouses
            .AsNoTracking()
            .OrderBy(item => item.WarehouseCode)
            .Select(item => item.WarehouseId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new InvalidOperationException("Chưa có kho nguyên liệu để tự tạo IngredientCode mới.");

        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = row.IngredientCode,
            IngredientName = row.IngredientName.Trim(),
            UnitId = row.Unit!.UnitId,
            WarehouseId = warehouseId,
            ReferencePrice = 0,
            IsFreshDaily = false,
            IsActive = true
        };

        _context.Ingredients.Add(ingredient);
        importedIngredients[row.IngredientCode] = ingredient;
        return ingredient;
    }

    private async Task<string?> ResolveCustomerCodeAsync(byte[]? customerId, CancellationToken cancellationToken)
    {
        if (customerId is null)
        {
            return null;
        }

        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerId), cancellationToken);
        return customer?.CustomerCode;
    }

    private static bool MatchesBomCustomerScope(byte[]? left, byte[]? right)
        => left is null ? right is null : right is not null && left.SequenceEqual(right);

    private static bool DateRangesOverlap(DateOnly leftFrom, DateOnly? leftTo, DateOnly rightFrom, DateOnly? rightTo)
        => leftFrom <= (rightTo ?? DateOnly.MaxValue) && rightFrom <= (leftTo ?? DateOnly.MaxValue);

    private static decimal NormalizePriceTier(decimal tier)
    {
        var normalized = decimal.Round(tier, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new ArgumentException("Đơn giá BOM chỉ được là 25000, 30000 hoặc 34000.")
        };
    }

    private static string NormalizeBomTemplateType(string? templateType, bool hasDishFilter)
    {
        var normalized = string.IsNullOrWhiteSpace(templateType)
            ? (hasDishFilter ? "dish" : "missing")
            : templateType.Trim().ToLowerInvariant();
        return normalized switch
        {
            "missing" or "blank" or "all" or "dish" => normalized,
            _ => "missing"
        };
    }

    private static byte[]? ParseOptionalCustomerId(string? customerId)
        => string.IsNullOrWhiteSpace(customerId)
            ? null
            : GuidHelper.ParseGuidString(customerId) ?? throw new ArgumentException("Khách hàng không hợp lệ.");

    private static byte[]? ParseOptionalDishId(string? dishId)
        => string.IsNullOrWhiteSpace(dishId)
            ? null
            : GuidHelper.ParseGuidString(dishId) ?? throw new ArgumentException("Món ăn không hợp lệ.");

    private static void AddBlankBomRows(
        ICollection<IReadOnlyList<string>> rows,
        Dish dish,
        decimal priceTier,
        string? customerCode,
        string effectiveFrom)
    {
        for (var index = 0; index < BlankBomRowsPerDish; index++)
        {
            rows.Add([
                dish.DishCode,
                dish.DishName,
                priceTier.ToString("0.##", CultureInfo.InvariantCulture),
                customerCode ?? string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                effectiveFrom,
                string.Empty,
                BomStatusPublished,
                string.Empty
            ]);
        }
    }

    private sealed record BomImportSourceRow(
        int RowNumber,
        IReadOnlyDictionary<string, string> Cells);

    private sealed record BomImportRow(
        int RowNumber,
        string DishCode,
        string DishName,
        string IngredientCode,
        string IngredientName,
        string UnitCode,
        decimal GrossQtyPerServing,
        decimal WasteRatePercent,
        DateOnly EffectiveFrom,
        DateOnly? EffectiveTo,
        string BomStatus,
        string? Note,
        string Action,
        Dish? Dish,
        Ingredient? Ingredient,
        Unit? Unit,
        IReadOnlyList<string> Errors,
        IReadOnlyList<string> Warnings);

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
        BomStatus = NormalizeBomStatus(bom.BomStatus),
        BomStatusLabel = MapBomStatusLabel(bom.BomStatus),
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
            .Where(line => SupportedBomPriceTiers.Contains(line.PriceTierAmount));

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

    private static bool IsPublishedBomLine(DishBom bom) => NormalizeBomStatus(bom.BomStatus) == BomStatusPublished;

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

    private static bool TryNormalizeImportPriceTier(string value, out decimal normalized)
    {
        normalized = default;
        if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return false;
        }

        try
        {
            normalized = NormalizePriceTier(parsed);
        }
        catch (ArgumentException)
        {
            return false;
        }

        return true;
    }
}
