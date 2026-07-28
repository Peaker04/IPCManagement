using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed class DishBomImportService : IDishBomImportService
{
    private readonly IpcManagementContext _context;
    private readonly IMemoryCache _cache;
    private readonly DishBomImportParser _parser;
    private readonly IEfTransactionRunner _transactionRunner;

    public DishBomImportService(
        IpcManagementContext context,
        IMemoryCache cache,
        IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _cache = cache;
        _parser = new DishBomImportParser(context);
        _transactionRunner = transactionRunner;
    }

    public Task<BomImportPreviewDto> PreviewAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken = default)
        => BuildPreviewAsync(fileStream, request, cancellationToken);

    public async Task<BomImportCommitResultDto> CommitAsync(
        Stream fileStream,
        BomImportCommitRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var preview = await BuildPreviewAsync(fileStream, request, cancellationToken);
        if (!preview.CanCommit)
        {
            throw new BusinessRuleException("File BOM còn lỗi, cần sửa preview trước khi commit.");
        }

        var priceTier = DishBomPolicy.NormalizePriceTier(request.PriceTier);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(request.CustomerId);
        var actor = GuidHelper.ParseGuidString(userId);
        var rows = await _parser.ParseAsync(fileStream, request, cancellationToken);
        var validRows = rows.Where(row => row.Errors.Count == 0).ToList();
        var now = DateTime.UtcNow;
        var batchCode = $"BOM-{priceTier:0}-{now:yyyyMMddHHmmss}";

        var result = await _transactionRunner.ExecuteAsync(
            async token =>
            {
                var created = 0;
                var updated = 0;
                var archived = 0;
                var importedIngredients = new Dictionary<string, Ingredient>(StringComparer.OrdinalIgnoreCase);
                foreach (var row in validRows)
                {
                    var effectiveFrom = row.EffectiveFrom;
                    var effectiveTo = row.EffectiveTo;
                    var status = DishBomPolicy.NormalizeStatus(row.BomStatus);
                    var ingredient = row.Ingredient ?? await CreateImportedIngredientAsync(row, importedIngredients, token);
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
                                .FirstOrDefaultAsync(token);

                    if (existing is not null && DishBomPolicy.IsPublished(existing))
                    {
                        if (existing.EffectiveFrom < effectiveFrom &&
                            (existing.EffectiveTo is null || existing.EffectiveTo >= effectiveFrom))
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
                            AddBomAdjustmentIfNeeded(
                                existing.BomId,
                                oldGross,
                                existing.GrossQtyPerServing,
                                oldWaste,
                                existing.WasteRatePercent,
                                row.Note,
                                userId);
                            updated++;
                            continue;
                        }
                    }

                    _context.Dishboms.Add(new DishBom
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
                    });
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

                await _context.SaveChangesAsync(token);
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
            },
            async token =>
            {
                foreach (var row in validRows)
                {
                    var ingredientId = row.Ingredient?.IngredientId ?? await _context.Ingredients
                        .Where(ingredient => ingredient.IngredientCode == row.IngredientCode)
                        .Select(ingredient => ingredient.IngredientId)
                        .FirstOrDefaultAsync(token);
                    if (ingredientId is null ||
                        !await _context.Dishboms
                            .AsNoTracking()
                            .AnyAsync(
                                bom =>
                                    bom.DishId == row.Dish!.DishId &&
                                    bom.IngredientId == ingredientId &&
                                    bom.UnitId == row.Unit!.UnitId &&
                                    bom.PriceTierAmount == priceTier &&
                                    bom.EffectiveFrom == row.EffectiveFrom &&
                                    bom.GrossQtyPerServing == DecimalPolicy.RoundQuantity(row.GrossQtyPerServing) &&
                                    (customerId == null
                                        ? bom.CustomerId == null
                                        : bom.CustomerId != null && bom.CustomerId == customerId),
                                token))
                    {
                        return false;
                    }
                }

                return true;
            },
            cancellationToken: cancellationToken);
        DishCatalogCache.Clear(_cache);
        return result;
    }

    private async Task<BomImportPreviewDto> BuildPreviewAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        var priceTier = DishBomPolicy.NormalizePriceTier(request.PriceTier);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(request.CustomerId);
        var rows = await _parser.ParseAsync(fileStream, request, cancellationToken);
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
            .SelectMany(group => FindOverlappingRows(group.ToList()))
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

    private static IEnumerable<int> FindOverlappingRows(IReadOnlyList<BomImportRow> rows)
    {
        var rowNumbers = new HashSet<int>();
        for (var i = 0; i < rows.Count; i++)
        {
            for (var j = i + 1; j < rows.Count; j++)
            {
                if (DishBomPolicy.DateRangesOverlap(
                    rows[i].EffectiveFrom,
                    rows[i].EffectiveTo,
                    rows[j].EffectiveFrom,
                    rows[j].EffectiveTo))
                {
                    rowNumbers.Add(rows[i].RowNumber);
                    rowNumbers.Add(rows[j].RowNumber);
                }
            }
        }

        return rowNumbers;
    }

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
            ?? throw new BusinessRuleException("Chưa có kho nguyên liệu để tự tạo IngredientCode mới.");

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
