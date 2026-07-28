using System.Globalization;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

internal sealed class DishBomImportParser(IpcManagementContext context)
{
    public async Task<List<BomImportRow>> ParseAsync(
        Stream fileStream,
        BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        var priceTier = DishBomPolicy.NormalizePriceTier(request.PriceTier);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(request.CustomerId);
        var importRows = await ReadSourceRowsAsync(fileStream, cancellationToken);
        if (importRows.Count == 0)
        {
            return [];
        }

        var dishes = await context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .ToDictionaryAsync(dish => dish.DishCode.Trim(), StringComparer.OrdinalIgnoreCase, cancellationToken);
        var ingredientList = await context.Ingredients
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
        var hasWarehouse = await context.Warehouses
            .AsNoTracking()
            .AnyAsync(cancellationToken);
        var units = await context.Units
            .AsNoTracking()
            .ToDictionaryAsync(item => item.UnitCode.Trim(), StringComparer.OrdinalIgnoreCase, cancellationToken);
        var existingLines = await context.Dishboms
            .AsNoTracking()
            .Where(line => line.PriceTierAmount == priceTier)
            .Where(line => customerId == null
                ? line.CustomerId == null
                : line.CustomerId != null && line.CustomerId.SequenceEqual(customerId))
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
            if (hasTierText && !DishBomPolicy.TryNormalizeImportPriceTier(tierText, out normalizedRowTier))
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
            if (ingredient is null && string.IsNullOrWhiteSpace(ingredientCode) &&
                !string.IsNullOrWhiteSpace(ingredientName) && unit is not null)
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
                status = DishBomPolicy.Published;
            }
            else
            {
                try
                {
                    status = DishBomPolicy.NormalizeStatus(status);
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

    private static async Task<IReadOnlyList<BomImportSourceRow>> ReadSourceRowsAsync(
        Stream fileStream,
        CancellationToken cancellationToken)
    {
        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
        }

        var bytes = await XlsxSecurityLimits.ReadAllBytesWithinLimitAsync(
            fileStream,
            "File import BOM",
            cancellationToken);
        if (bytes.Length == 0)
        {
            return [];
        }

        return IsXlsx(bytes)
            ? ReadWorkbookRows(bytes)
            : ReadCsvRows(bytes, cancellationToken);
    }

    private static bool IsXlsx(byte[] bytes)
        => bytes.Length >= 2 && bytes[0] == (byte)'P' && bytes[1] == (byte)'K';

    private static IReadOnlyList<BomImportSourceRow> ReadCsvRows(
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

    private static IReadOnlyList<BomImportSourceRow> ReadWorkbookRows(byte[] bytes)
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

    private sealed record BomImportSourceRow(
        int RowNumber,
        IReadOnlyDictionary<string, string> Cells);
}

internal sealed record BomImportRow(
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
