using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

public sealed class SampleBomImportService : ISampleBomImportService
{
    private static readonly string[] BomRequiredHeaders =
    [
        "Món",
        "Nguyên liệu chính",
        "Khối lượng ( kg)",
        "Giá nhập (kg)",
        "Số lượng suất ăn",
        "Định lượng (gram) / khay"
    ];

    private static readonly IReadOnlyList<(string SheetName, decimal PriceTier)> PresetBomSheets =
    [
        ("định lượng suất 25k", 25000m),
        ("định lượng suất 30k", 30000m),
        ("định lượng suất 34k", 34000m)
    ];

    private static readonly IReadOnlyDictionary<string, (string Code, string Name)> PresetBomUnitByIngredient =
        new Dictionary<string, (string Code, string Name)>(StringComparer.OrdinalIgnoreCase)
        {
            ["Bánh mì"] = ("O", "Ổ"),
            ["Chuối"] = ("QUA", "Quả"),
            ["Chả cá"] = ("MIENG", "Miếng"),
            ["Căn cuộn"] = ("CAY", "Cây"),
            ["Sữa chua"] = ("HOP", "Hộp"),
            ["Trứng cút"] = ("CAI", "Cái"),
            ["Trứng cút lột sẵn"] = ("CAI", "Cái"),
            ["trứng cút lọt sẵn"] = ("CAI", "Cái"),
            ["Trứng gà"] = ("CAI", "Cái"),
            ["Trứng gà (cái)"] = ("CAI", "Cái"),
            ["Trứng gà trung"] = ("CAI", "Cái"),
            ["Đậu khuôn"] = ("LAT", "Lát"),
            ["Đậu khuôn chiên"] = ("LAT", "Lát"),
            ["Đậu khuôn chiên lát nhỏ"] = ("LAT", "Lát")
        };

    private readonly IpcManagementContext _context;
    private readonly IHostEnvironment _environment;
    private readonly XlsxWorkbookReader _reader = new();
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;

    public SampleBomImportService(
        IpcManagementContext context,
        IHostEnvironment environment,
        IOperationalWarehouseResolver operationalWarehouseResolver)
    {
        _context = context;
        _environment = environment;
        _operationalWarehouseResolver = operationalWarehouseResolver;
    }

    public async Task<SampleDataImportResultDto> ImportAsync(
        SampleDataImportRequest request,
        CancellationToken cancellationToken = default)
    {
        var sourceDirectory = ResolveSourceDirectory(request.SourceDirectory);
        var result = new SampleDataImportResultDto
        {
            DryRun = request.DryRun,
            SourceDirectory = sourceDirectory.FullName
        };

        await ImportBomDataAsync(sourceDirectory, request, result, cancellationToken);
        if (!request.DryRun)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        return result;
    }

    private async Task ImportBomDataAsync(
        DirectoryInfo sourceDirectory,
        SampleDataImportRequest request,
        SampleDataImportResultDto result,
        CancellationToken cancellationToken)
    {
        var bomFile = sourceDirectory.GetFiles("IPC. Định lượng 07.2026.xlsx").FirstOrDefault();
        if (bomFile is null)
        {
            AddMissingFile(result, "IPC. Định lượng 07.2026.xlsx", "BOM tiers 25k/30k/34k");
            return;
        }

        var sourceRows = PresetBomSheets
            .SelectMany(sheet => _reader
                .ReadTable(bomFile.FullName, sheet.SheetName, BomRequiredHeaders, request.MaxRows)
                .Select(row => new PresetBomSourceRow(sheet.SheetName, sheet.PriceTier, row)))
            .ToList();
        var deduplication = PresetBomImportPolicy.ValidateAndDeduplicate(sourceRows);
        foreach (var warning in deduplication.Warnings)
        {
            AddWarning(result, warning);
        }

        var fileResult = AddFileResult(
            result,
            bomFile.FullName,
            "Dishes/BOM tiers 25k/30k/34k/Ingredients/Suppliers",
            request.DryRun,
            sourceRows.Count);
        var warehouse = await EnsureWarehouseAsync(request.DryRun, result.Counts, cancellationToken);
        var existingUnits = await _context.Units.ToListAsync(cancellationToken);
        var kgUnit = EnsureUnit("KG", "Kilogram", existingUnits, request.DryRun, result.Counts);
        var presetUnits = PresetBomUnitByIngredient.Values
            .Distinct()
            .ToDictionary(
                definition => definition.Code,
                definition => EnsureUnit(definition.Code, definition.Name, existingUnits, request.DryRun, result.Counts),
                StringComparer.OrdinalIgnoreCase);
        var existingSuppliers = await _context.Suppliers.ToListAsync(cancellationToken);
        var existingIngredients = await _context.Ingredients.ToListAsync(cancellationToken);
        var existingDishes = await _context.Dishes.ToListAsync(cancellationToken);
        var existingBomLines = await _context.Dishboms.ToListAsync(cancellationToken);

        if (request.ReplaceBomCatalog)
        {
            result.Warnings.Add(
                $"Thay catalog BOM: loại bỏ {existingBomLines.Count} dòng BOM cũ trước khi nạp ba tier cố định.");
            if (!request.DryRun)
            {
                var existingAdjustments = await _context.Bomadjustments.ToListAsync(cancellationToken);
                _context.Bomadjustments.RemoveRange(existingAdjustments);
                _context.Dishboms.RemoveRange(existingBomLines);
            }

            existingBomLines.Clear();
        }

        foreach (var sourceRow in deduplication.Rows)
        {
            var row = sourceRow.Row;
            var dishName = Get(row, "Món");
            var ingredientName = Get(row, "Nguyên liệu chính");
            if (string.IsNullOrWhiteSpace(dishName) || string.IsNullOrWhiteSpace(ingredientName))
            {
                fileResult.RowsSkipped++;
                continue;
            }

            var grossQty = PresetBomImportPolicy.ParseGrossQtyPerServing(row);
            if (grossQty <= 0)
            {
                fileResult.RowsSkipped++;
                AddWarning(result, $"Bỏ qua BOM '{dishName}'/'{ingredientName}' vì định lượng không hợp lệ.");
                continue;
            }

            EnsureSupplier(Get(row, "Supplier"), existingSuppliers, request.DryRun, result.Counts);
            var unit = ResolvePresetBomUnit(ingredientName, kgUnit, presetUnits);
            var ingredient = EnsureIngredient(
                ingredientName,
                unit,
                warehouse,
                ParseDecimal(Get(row, "Giá nhập (kg)")),
                existingIngredients,
                request.DryRun,
                result.Counts,
                updateUnit: false);
            var dish = EnsureDish(
                dishName,
                Get(row, "Loại món"),
                Get(row, "Menu"),
                existingDishes,
                request.DryRun,
                result.Counts);
            EnsureBomLine(
                dish,
                ingredient,
                unit,
                grossQty,
                sourceRow.PriceTier,
                existingBomLines,
                request.DryRun,
                result.Counts);
            fileResult.RowsImported++;
        }
    }

    private async Task<Warehouse> EnsureWarehouseAsync(
        bool dryRun,
        SampleDataImportCountsDto counts,
        CancellationToken cancellationToken)
    {
        var warehouseId = await _operationalWarehouseResolver.ResolveAsync(cancellationToken);
        return await _context.Warehouses.AsNoTracking()
            .SingleOrDefaultAsync(item => item.WarehouseId == warehouseId, cancellationToken)
            ?? throw new BusinessRuleException("Kho vận hành đã cấu hình không tồn tại.");
    }

    private Unit EnsureUnit(
        string code,
        string name,
        List<Unit> units,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var unitCode = string.IsNullOrWhiteSpace(code) ? "UNIT" : code.Trim().ToUpperInvariant();
        var existing = units.FirstOrDefault(item =>
            string.Equals(item.UnitCode, unitCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            return existing;
        }

        counts.UnitsCreated++;
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = unitCode,
            UnitName = string.IsNullOrWhiteSpace(name) ? unitCode : name.Trim(),
            BaseUnitCode = unitCode,
            ConvertRateToBase = 1
        };
        if (!dryRun)
        {
            _context.Units.Add(unit);
        }

        units.Add(unit);
        return unit;
    }

    private Supplier? EnsureSupplier(
        string supplierName,
        List<Supplier> suppliers,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        if (string.IsNullOrWhiteSpace(supplierName))
        {
            return null;
        }

        var normalized = NormalizeName(supplierName);
        var existing = suppliers.FirstOrDefault(item =>
            string.Equals(NormalizeName(item.SupplierName), normalized, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.IsActive = true;
            counts.SuppliersUpdated++;
            return existing;
        }

        counts.SuppliersCreated++;
        var supplier = new Supplier
        {
            SupplierId = GuidHelper.NewId(),
            SupplierCode = BuildUniqueSupplierCode(supplierName, suppliers),
            SupplierName = supplierName.Trim(),
            IsActive = true
        };
        if (!dryRun)
        {
            _context.Suppliers.Add(supplier);
        }

        suppliers.Add(supplier);
        return supplier;
    }

    private string BuildUniqueSupplierCode(string supplierName, List<Supplier> suppliers)
    {
        var knownSuppliers = suppliers
            .Concat(_context.Suppliers.Local)
            .DistinctBy(item => Convert.ToBase64String(item.SupplierId))
            .ToList();
        var baseCode = StableCode("SUP", supplierName);
        if (!knownSuppliers.Any(item => string.Equals(item.SupplierCode, baseCode, StringComparison.OrdinalIgnoreCase)))
        {
            return baseCode;
        }

        for (var suffix = 2; suffix < 1000; suffix++)
        {
            var candidate = $"{baseCode}-{suffix}";
            if (!knownSuppliers.Any(item => string.Equals(item.SupplierCode, candidate, StringComparison.OrdinalIgnoreCase)))
            {
                return candidate;
            }
        }

        return StableCode("SUP", $"{supplierName}-{Guid.NewGuid():N}");
    }

    private Ingredient EnsureIngredient(
        string ingredientName,
        Unit unit,
        Warehouse warehouse,
        decimal referencePrice,
        List<Ingredient> ingredients,
        bool dryRun,
        SampleDataImportCountsDto counts,
        bool updateUnit = false)
    {
        referencePrice = DecimalPolicy.RoundMoney(referencePrice);
        var normalized = NormalizeName(ingredientName);
        var stableCode = StableCode("ING", ingredientName);
        var existing = ingredients.FirstOrDefault(item =>
            string.Equals(NormalizeName(item.IngredientName), normalized, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.IngredientCode, stableCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.IngredientName = ingredientName.Trim();
            if (updateUnit && !existing.UnitId.SequenceEqual(unit.UnitId))
            {
                existing.UnitId = unit.UnitId;
            }

            if (referencePrice > 0 && existing.ReferencePrice != referencePrice)
            {
                existing.ReferencePrice = referencePrice;
            }

            existing.IsActive = true;
            counts.IngredientsUpdated++;
            return existing;
        }

        counts.IngredientsCreated++;
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = stableCode,
            IngredientName = ingredientName.Trim(),
            UnitId = unit.UnitId,
            WarehouseId = warehouse.WarehouseId,
            ReferencePrice = referencePrice,
            IsFreshDaily = true,
            IsActive = true
        };
        if (!dryRun)
        {
            _context.Ingredients.Add(ingredient);
        }

        ingredients.Add(ingredient);
        return ingredient;
    }

    private static Unit ResolvePresetBomUnit(
        string ingredientName,
        Unit kgUnit,
        IReadOnlyDictionary<string, Unit> presetUnits)
    {
        var normalizedName = NormalizeName(ingredientName);
        return PresetBomUnitByIngredient.TryGetValue(normalizedName, out var definition)
            ? presetUnits[definition.Code]
            : kgUnit;
    }

    private Dish EnsureDish(
        string dishName,
        string dishGroup,
        string dishType,
        List<Dish> dishes,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var normalized = NormalizeName(dishName);
        var stableCode = StableCode("DISH", dishName);
        var existing = dishes.FirstOrDefault(item =>
            string.Equals(NormalizeName(item.DishName), normalized, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.DishCode, stableCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.DishName = dishName.Trim();
            existing.DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? existing.DishGroup : dishGroup.Trim();
            existing.DishType = string.IsNullOrWhiteSpace(dishType) ? existing.DishType : dishType.Trim();
            existing.IsActive = true;
            counts.DishesUpdated++;
            return existing;
        }

        counts.DishesCreated++;
        var dish = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = stableCode,
            DishName = dishName.Trim(),
            DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? null : dishGroup.Trim(),
            DishType = string.IsNullOrWhiteSpace(dishType) ? null : dishType.Trim(),
            IsActive = true
        };
        if (!dryRun)
        {
            _context.Dishes.Add(dish);
        }

        dishes.Add(dish);
        return dish;
    }

    private void EnsureBomLine(
        Dish dish,
        Ingredient ingredient,
        Unit unit,
        decimal grossQty,
        decimal priceTier,
        List<DishBom> bomLines,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        grossQty = DecimalPolicy.RoundQuantity(grossQty);
        var existing = bomLines.FirstOrDefault(item =>
            item.EffectiveTo is null &&
            item.DishId.SequenceEqual(dish.DishId) &&
            item.IngredientId.SequenceEqual(ingredient.IngredientId) &&
            item.CustomerId is null &&
            item.PriceTierAmount == priceTier);
        if (existing is not null)
        {
            existing.GrossQtyPerServing = grossQty;
            existing.UnitId = unit.UnitId;
            counts.BomLinesUpdated++;
            return;
        }

        counts.BomLinesCreated++;
        var bom = new DishBom
        {
            BomId = GuidHelper.NewId(),
            DishId = dish.DishId,
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            CustomerId = null,
            PriceTierAmount = priceTier,
            GrossQtyPerServing = grossQty,
            WasteRatePercent = DecimalPolicy.RoundPercent(0),
            BomStatus = "PUBLISHED",
            EffectiveFrom = new DateOnly(2026, 1, 1),
            EffectiveTo = null
        };
        if (!dryRun)
        {
            _context.Dishboms.Add(bom);
        }

        bomLines.Add(bom);
    }

    private DirectoryInfo ResolveSourceDirectory(string? configuredPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            var explicitDirectory = new DirectoryInfo(configuredPath);
            return explicitDirectory.Exists
                ? explicitDirectory
                : throw new DirectoryNotFoundException($"Không tìm thấy thư mục dữ liệu mẫu: {configuredPath}");
        }

        for (var current = new DirectoryInfo(_environment.ContentRootPath); current is not null; current = current.Parent)
        {
            var docs = new DirectoryInfo(Path.Combine(current.FullName, ".docs"));
            if (docs.Exists)
            {
                return docs;
            }
        }

        throw new DirectoryNotFoundException("Không tìm thấy thư mục .docs từ ContentRootPath.");
    }

    private static SampleDataFileResultDto AddFileResult(
        SampleDataImportResultDto result,
        string workbookPath,
        string domain,
        bool dryRun,
        int rowsScanned)
    {
        var fileResult = new SampleDataFileResultDto
        {
            FileName = Path.GetFileName(workbookPath),
            Domain = domain,
            Status = dryRun ? "DryRun" : "Imported",
            RowsScanned = rowsScanned
        };
        result.Files.Add(fileResult);
        return fileResult;
    }

    private static void AddMissingFile(SampleDataImportResultDto result, string fileName, string domain)
    {
        result.Warnings.Add($"Không tìm thấy file {fileName}.");
        result.Files.Add(new SampleDataFileResultDto
        {
            FileName = fileName,
            Domain = domain,
            Status = "Missing"
        });
    }

    private static string Get(IReadOnlyDictionary<string, string> row, string key)
        => row.TryGetValue(key, out var value) ? value.Trim() : string.Empty;

    private static decimal ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var normalized = value.Trim().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : 0;
    }

    private static string NormalizeName(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string StableCode(string prefix, string name)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(NormalizeName(name).ToUpperInvariant()));
        return $"{prefix}-{Convert.ToHexString(hash)[..10]}";
    }

    private static void AddWarning(SampleDataImportResultDto result, string warning)
    {
        if (result.Warnings.Count < 100)
        {
            result.Warnings.Add(warning);
        }
    }
}
