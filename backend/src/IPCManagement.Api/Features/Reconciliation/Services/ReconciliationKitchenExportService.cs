using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationKitchenExportService(IpcManagementContext context)
{
    public async Task<ReconciliationKitchenCookingExportDto?> GetAsync(string batchId, CancellationToken token = default)
    {
        var id = ReconciliationBatchService.RequiredId(batchId);
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var batch = inMemory
            ? (await context.Reconciliationbatches.AsNoTracking().ToListAsync(token)).SingleOrDefault(item => item.BatchId.SequenceEqual(id))
            : await context.Reconciliationbatches.AsNoTracking().SingleOrDefaultAsync(item => item.BatchId == id, token);
        if (batch is null) return null;

        var dailyLines = inMemory
            ? (await context.Reconciliationbatchdailylines.AsNoTracking().ToListAsync(token)).Where(item => item.BatchId.SequenceEqual(id)).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking().Where(item => item.BatchId == id).ToListAsync(token);
        if (dailyLines.Count == 0)
            throw new InvalidOperationException("LEGACY_DAILY_LINEAGE_MISSING: Lô chưa có dữ liệu nấu ăn đóng băng theo ngày.");
        var dailyById = dailyLines.ToDictionary(item => Convert.ToHexString(item.DailyLineId), StringComparer.Ordinal);
        var dailyIds = dailyLines.Select(item => item.DailyLineId).ToList();
        var contributors = inMemory
            ? (await context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync(token))
                .Where(item => item.DailyLineId is not null && dailyIds.Any(idValue => idValue.SequenceEqual(item.DailyLineId))).ToList()
            : await context.Reconciliationbatchcontributors.AsNoTracking()
                .Where(item => item.DailyLineId != null && dailyIds.Contains(item.DailyLineId)).ToListAsync(token);
        if (contributors.Count == 0 || contributors.Any(item => item.DishId is null
                || string.IsNullOrWhiteSpace(item.FrozenShiftName)
                || string.IsNullOrWhiteSpace(item.FrozenDishCode)
                || string.IsNullOrWhiteSpace(item.FrozenDishName)
                || item.FrozenServings is null
                || item.FrozenBomQuantityPerServing is null))
            throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_MISSING: Lô chưa có đủ món, ca, số suất và định lượng BOM đóng băng để xuất phiếu nấu.");

        var weeklyLineIds = dailyLines.Select(item => item.BatchLineId).Distinct(ByteArrayComparer.Instance).ToList();
        var weeklyLines = inMemory
            ? await context.Reconciliationbatchlines.ToListAsync(token)
            : await context.Reconciliationbatchlines.AsNoTracking().Include(item => item.Ingredient).Include(item => item.CanonicalUnit)
                .Where(item => weeklyLineIds.Contains(item.BatchLineId)).ToListAsync(token);
        var weeklyById = weeklyLines.ToDictionary(item => Convert.ToHexString(item.BatchLineId), StringComparer.Ordinal);

        var rows = contributors.GroupBy(item =>
        {
            var daily = dailyById[Convert.ToHexString(item.DailyLineId!)];
            return new
            {
                daily.ServiceDate,
                item.FrozenShiftName,
                DishId = Convert.ToHexString(item.DishId!),
                IngredientId = Convert.ToHexString(item.BatchLineId)
            };
        }).Select(group =>
        {
            var first = group.First();
            if (group.Any(item => item.FrozenServings != first.FrozenServings
                    || item.FrozenBomQuantityPerServing != first.FrozenBomQuantityPerServing
                    || item.FrozenWasteRatePercent != first.FrozenWasteRatePercent
                    || !string.Equals(item.FrozenDishCode, first.FrozenDishCode, StringComparison.Ordinal)
                    || !string.Equals(item.FrozenDishName, first.FrozenDishName, StringComparison.Ordinal)))
                throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS: Các đóng góp cùng món/nguyên liệu không thống nhất dữ liệu đóng băng.");
            var weekly = weeklyById[Convert.ToHexString(first.BatchLineId)];
            return new ReconciliationKitchenCookingRowDto(
                group.Key.ServiceDate,
                Weekday(group.Key.ServiceDate.DayOfWeek),
                Shift(first.FrozenShiftName!), first.FrozenDishCode!, first.FrozenDishName!, first.FrozenServings!.Value,
                weekly.Ingredient?.IngredientCode ?? string.Empty, weekly.Ingredient?.IngredientName ?? string.Empty,
                CompactUnit(weekly.CanonicalUnit?.UnitName),
                first.FrozenBomQuantityPerServing!.Value,
                first.FrozenWasteRatePercent,
                DecimalPolicy.RoundQuantity(group.Sum(item => item.SourceQuantity)));
        }).OrderBy(item => item.ServiceDate)
          .ThenBy(item => item.ShiftName, StringComparer.Ordinal)
          .ThenBy(item => item.DishName, StringComparer.Ordinal)
          .ThenBy(item => item.IngredientName, StringComparer.Ordinal)
          .ToList();
        return new(GuidHelper.ToGuidString(batch.BatchId), batch.Version, rows);
    }

    public static byte[] BuildCsv(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows)
    {
        var csv = new StringBuilder();
        csv.AppendLine("Ngày,Thứ,Ca,Món,Số suất,Nguyên liệu,Đơn vị,Định lượng BOM / suất,Hao hụt (%),Tổng lượng cần cho món");
        foreach (var row in rows)
            csv.AppendJoin(',', Csv(row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)), Csv(row.Weekday), Csv(row.ShiftName), Csv(row.DishName),
                row.Servings.ToString(CultureInfo.InvariantCulture), Csv(row.IngredientName), Csv(row.UnitName), Number(row.BomQuantityPerServing),
                row.WasteRatePercent is null ? string.Empty : Number(row.WasteRatePercent.Value), Number(row.TotalRequiredQuantity)).Append("\r\n");
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
    }

    public static byte[] BuildXlsx(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteEntry(archive, "[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""");
            WriteEntry(archive, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            WriteEntry(archive, "xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Phiếu nấu" sheetId="1" r:id="rId1"/></sheets></workbook>""");
            WriteEntry(archive, "xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""");
            WriteEntry(archive, "xl/styles.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>""");
            WriteEntry(archive, "xl/worksheets/sheet1.xml", BuildWorksheet(rows));
        }
        return output.ToArray();
    }

    private static string BuildWorksheet(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows)
    {
        string[] headers = ["Ngày", "Thứ", "Ca", "Món", "Số suất", "Nguyên liệu", "Đơn vị", "Định lượng BOM / suất", "Hao hụt (%)", "Tổng lượng cần cho món"];
        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="3" width="14" customWidth="1"/><col min="4" max="4" width="28" customWidth="1"/><col min="5" max="5" width="10" customWidth="1"/><col min="6" max="6" width="28" customWidth="1"/><col min="7" max="7" width="10" customWidth="1"/><col min="8" max="10" width="20" customWidth="1"/></cols><sheetData>""");
        AppendXlsxRow(xml, 1, headers, true);
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            AppendXlsxRow(xml, index + 2,
            [
                row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), row.Weekday, row.ShiftName, row.DishName,
                row.Servings.ToString(CultureInfo.InvariantCulture), row.IngredientName, row.UnitName, Number(row.BomQuantityPerServing),
                row.WasteRatePercent is null ? string.Empty : Number(row.WasteRatePercent.Value), Number(row.TotalRequiredQuantity)
            ], false);
        }
        return xml.Append($"</sheetData><autoFilter ref=\"A1:J{rows.Count + 1}\"/></worksheet>").ToString();
    }

    private static void AppendXlsxRow(StringBuilder xml, int rowNumber, IReadOnlyList<string> values, bool header)
    {
        xml.Append($"<row r=\"{rowNumber}\">");
        for (var index = 0; index < values.Count; index++)
        {
            var reference = $"{(char)('A' + index)}{rowNumber}";
            var style = header ? " s=\"1\"" : string.Empty;
            xml.Append($"<c r=\"{reference}\" t=\"inlineStr\"{style}><is><t>{SecurityElement.Escape(values[index])}</t></is></c>");
        }
        xml.Append("</row>");
    }

    private static void WriteEntry(ZipArchive archive, string path, string content)
    {
        using var writer = new StreamWriter(archive.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string Csv(string value) => $"\"{value.Replace("\"", "\"\"")}\"";
    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
    private static string Shift(string value) => value.Trim().ToUpperInvariant() switch
    {
        "MORNING" => "Ca sáng",
        "AFTERNOON" => "Ca chiều",
        "EVENING" => "Ca tối",
        "FULLDAY" => "Cả ngày",
        _ => value
    };

    private static string CompactUnit(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "kilogram" or "kilograms" => "kg",
        "gram" or "grams" => "g",
        "liter" or "litre" or "liters" or "litres" => "lít",
        "milliliter" or "millilitre" or "milliliters" or "millilitres" => "ml",
        _ => value?.Trim() ?? string.Empty
    };

    private static string Weekday(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "Thứ 2", DayOfWeek.Tuesday => "Thứ 3", DayOfWeek.Wednesday => "Thứ 4",
        DayOfWeek.Thursday => "Thứ 5", DayOfWeek.Friday => "Thứ 6", DayOfWeek.Saturday => "Thứ 7", _ => "Chủ nhật"
    };

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        internal static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? left, byte[]? right) => left is not null && right is not null && left.SequenceEqual(right);
        public int GetHashCode(byte[] value) => Convert.ToHexString(value).GetHashCode(StringComparison.Ordinal);
    }
}
