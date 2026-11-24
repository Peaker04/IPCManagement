using System.Data;
using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
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
            ? (await context.Reconciliationbatchdailylines.AsNoTracking().ToListAsync(token)).Where(item => item.BatchId.SequenceEqual(id) && item.RequiredQuantity > 0).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking().Where(item => item.BatchId == id && item.RequiredQuantity > 0).ToListAsync(token);
        if (dailyLines.Count == 0)
            throw new InvalidOperationException("LEGACY_DAILY_LINEAGE_MISSING: Lô chưa có dữ liệu nấu ăn đóng băng theo ngày.");
        var dailyById = dailyLines.ToDictionary(item => Convert.ToHexString(item.DailyLineId), StringComparer.Ordinal);
        var dailyIds = dailyLines.Select(item => item.DailyLineId).ToList();
        var contributors = inMemory
            ? (await context.Reconciliationbatchcontributors.AsNoTracking().ToListAsync(token))
                .Where(item => item.InvalidatedAt == null
                    && item.DailyLineId is not null
                    && dailyIds.Any(idValue => idValue.SequenceEqual(item.DailyLineId))).ToList()
            : await context.Reconciliationbatchcontributors.AsNoTracking()
                .Where(item => item.InvalidatedAt == null
                    && item.DailyLineId != null
                    && dailyIds.Contains(item.DailyLineId)).ToListAsync(token);
        var quantitiesByDay = contributors.GroupBy(item => Convert.ToHexString(item.DailyLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.SourceQuantity), StringComparer.Ordinal);
        if (contributors.Count == 0 || dailyLines.Any(line => !quantitiesByDay.TryGetValue(Convert.ToHexString(line.DailyLineId), out var quantity)
                || DecimalPolicy.RoundQuantity(quantity - line.RequiredQuantity) != 0)
            || contributors.Any(item => item.DishId is null
                || string.IsNullOrWhiteSpace(item.FrozenShiftName)
                || string.IsNullOrWhiteSpace(item.FrozenDishCode)
                || string.IsNullOrWhiteSpace(item.FrozenDishName)
                || string.IsNullOrWhiteSpace(item.FrozenMenuVariant)
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
                item.FrozenMenuVariant,
                DishId = Convert.ToHexString(item.DishId!),
                IngredientId = Convert.ToHexString(item.BatchLineId)
            };
        }).Select(group =>
        {
            var first = group.First();
            if (group.Any(item => item.FrozenServings != first.FrozenServings
                    || item.FrozenBomQuantityPerServing != first.FrozenBomQuantityPerServing
                    || item.FrozenBomUnitToBaseRate != first.FrozenBomUnitToBaseRate
                    || item.FrozenCanonicalUnitToBaseRate != first.FrozenCanonicalUnitToBaseRate
                    || item.FrozenWasteRatePercent != first.FrozenWasteRatePercent
                    || !string.Equals(item.FrozenMenuVariant, first.FrozenMenuVariant, StringComparison.Ordinal)
                    || !string.Equals(item.FrozenDishCode, first.FrozenDishCode, StringComparison.Ordinal)
                    || !string.Equals(item.FrozenDishName, first.FrozenDishName, StringComparison.Ordinal)))
                throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS: Các đóng góp cùng món/nguyên liệu không thống nhất dữ liệu đóng băng.");
            var weekly = weeklyById[Convert.ToHexString(first.BatchLineId)];
            var available = FrozenBomQuantityPolicy.TryGetCanonicalPerServing(first, out var canonicalRate);
            return new ReconciliationKitchenCookingRowDto(
                group.Key.ServiceDate,
                Weekday(group.Key.ServiceDate.DayOfWeek),
                Shift(first.FrozenShiftName!), first.FrozenDishCode!, first.FrozenDishName!, first.FrozenServings!.Value,
                weekly.Ingredient?.IngredientCode ?? string.Empty, weekly.Ingredient?.IngredientName ?? string.Empty,
                CompactUnit(weekly.CanonicalUnit?.UnitName),
                available ? canonicalRate : null,
                first.FrozenWasteRatePercent,
                DecimalPolicy.RoundQuantity(group.Sum(item => item.SourceQuantity)))
            {
                MenuVariant = MenuVariant(first.FrozenMenuVariant!),
                QuantityUnavailableReasonCode = available ? null : FrozenBomQuantityPolicy.UnavailableReason,
                FrozenDishIdentity = group.Key.DishId,
                IngredientIdentity = Convert.ToHexString(weekly.IngredientId),
                CanonicalUnitIdentity = Convert.ToHexString(weekly.CanonicalUnitId),
                CanCompareRecipeLine = available && group.Count() == 1
            };
        }).OrderBy(item => item.ServiceDate)
          .ThenBy(item => item.ShiftName, StringComparer.Ordinal)
          .ThenBy(item => item.DishName, StringComparer.Ordinal)
          .ThenBy(item => item.IngredientName, StringComparer.Ordinal)
          .ToList();
        return new(GuidHelper.ToGuidString(batch.BatchId), batch.Version, rows);
    }

    public async Task<byte[]> BuildCsvAsync(ReconciliationKitchenCookingExportDto document, CancellationToken token = default)
    {
        var scope = await GetDocumentScopeAsync(document.BatchId, token);
        return BuildCsv(document.Rows, scope.CustomerLabel, scope.WeekStart);
    }

    public async Task<byte[]> BuildXlsxAsync(ReconciliationKitchenCookingExportDto document, CancellationToken token = default)
    {
        var scope = await GetDocumentScopeAsync(document.BatchId, token);
        return BuildXlsx(document.Rows, scope.CustomerLabel, scope.WeekStart);
    }

    private async Task<(string CustomerLabel, DateOnly WeekStart, int MenuVersion, string CustomerId, string CustomerCode)> GetDocumentScopeAsync(string batchId, CancellationToken token)
    {
        var id = ReconciliationBatchService.RequiredId(batchId);
        var inMemory = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory";
        var batch = inMemory
            ? (await context.Reconciliationbatches.AsNoTracking().ToListAsync(token)).SingleOrDefault(item => item.BatchId.SequenceEqual(id))
            : await context.Reconciliationbatches.AsNoTracking().SingleOrDefaultAsync(item => item.BatchId == id, token);
        if (batch is null) throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_MISSING: Không tìm thấy lô cho tài liệu phiếu nấu.");
        var query = context.Menuversions.AsNoTracking();
        var version = inMemory
            ? (await query.ToListAsync(token)).SingleOrDefault(item => item.MenuVersionId.SequenceEqual(batch.MenuVersionId))
            : await query.Include(item => item.Customer).SingleOrDefaultAsync(item => item.MenuVersionId == batch.MenuVersionId, token);
        var customer = inMemory && version is not null
            ? (await context.Customers.AsNoTracking().ToListAsync(token)).SingleOrDefault(item => item.CustomerId.SequenceEqual(version.CustomerId))
            : version?.Customer;
        if (version is null || customer is null || string.IsNullOrWhiteSpace(customer.CustomerCode) || string.IsNullOrWhiteSpace(customer.CustomerName))
            throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_MISSING: Thiếu khách hàng hoặc tuần nguồn cho tài liệu phiếu nấu.");
        return ($"{customer.CustomerCode} - {customer.CustomerName}", version.WeekStartDate, version.VersionNo,
            Convert.ToHexString(customer.CustomerId), customer.CustomerCode);
    }

    public async Task<byte[]> BuildScopedXlsxAsync(DateOnly weekStart, IReadOnlyCollection<Guid> batchIds,
        DateOnly? serviceDate, string shift, CancellationToken token = default)
    {
        if (weekStart == default || weekStart.DayOfWeek != DayOfWeek.Monday)
            throw new ArgumentException("Chọn ngày thứ Hai bắt đầu tuần cần xuất.");
        if (serviceDate.HasValue && serviceDate.Value.DayNumber - weekStart.DayNumber is < 0 or > 6)
            throw new ArgumentException("Chọn ngày phục vụ trong tuần cần xuất.");
        if (shift is not ("ALL" or "MORNING" or "AFTERNOON"))
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        if (batchIds.Count is < 1 or > 100 || batchIds.Contains(Guid.Empty))
            throw new ArgumentException("Chọn từ 1 đến 100 lô hợp lệ.");

        var documents = await new EfTransactionRunner(context).ExecuteAsync(
            readToken => ReadScopedDocumentsAsync(weekStart, batchIds, readToken),
            _ => Task.FromResult(false), IsolationLevel.Serializable, token);

        var shiftLabel = shift == "ALL" ? "Tất cả ca" : Shift(shift);
        var sheet = KitchenCookingWorkbook.BuildWorksheet(documents, weekStart, serviceDate, shiftLabel, shift == "ALL");
        return BuildXlsxPackage(sheet, printTitles: true);
    }

    private async Task<List<KitchenCookingWorkbook.Batch>> ReadScopedDocumentsAsync(
        DateOnly weekStart, IEnumerable<Guid> batchIds, CancellationToken token)
    {
        var documents = new List<KitchenCookingWorkbook.Batch>();
        foreach (var batchId in batchIds.Distinct().Order())
        {
            var id = batchId.ToString();
            var scope = await GetDocumentScopeAsync(id, token);
            if (scope.WeekStart != weekStart)
                throw new ArgumentException("Có lô nằm ngoài tuần cần xuất.");
            var message = $"KITCHEN_FROZEN_LINEAGE_MISSING: Lô của {scope.CustomerLabel}, thực đơn phiên bản {scope.MenuVersion}, thiếu hoặc mâu thuẫn dữ liệu phiếu nấu.";
            ReconciliationKitchenCookingExportDto? document;
            try
            {
                document = await GetAsync(id, token);
            }
            catch (InvalidOperationException error) when (error.Message.StartsWith("KITCHEN_FROZEN_LINEAGE_", StringComparison.Ordinal)
                || error.Message.StartsWith("LEGACY_DAILY_LINEAGE_MISSING", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(message, error);
            }
            if (document is null || document.Rows.Count == 0)
                throw new InvalidOperationException(message);
            documents.Add(new(scope.CustomerId, scope.CustomerCode, document));
        }
        return documents;
    }

    public static byte[] BuildCsv(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows, string customerLabel, DateOnly weekStart)
    {
        var csv = new StringBuilder();
        csv.AppendLine("Ngày,Thứ,Ca,Thực đơn,Món,Số suất,Nguyên liệu,Đơn vị,Định lượng BOM / suất,Hao hụt (%),Tổng lượng cần cho món,Khách hàng,Tuần bắt đầu,Tuần kết thúc");
        foreach (var row in rows)
            csv.AppendJoin(',', Csv(row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)), Csv(row.Weekday), Csv(row.ShiftName), Csv(row.MenuVariant), Csv(row.DishName),
                row.Servings.ToString(CultureInfo.InvariantCulture), Csv(row.IngredientName), Csv(row.UnitName), Rate(row.BomQuantityPerServing),
                row.WasteRatePercent is null ? string.Empty : Number(row.WasteRatePercent.Value), Number(row.TotalRequiredQuantity), Csv(customerLabel), Csv(weekStart.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)), Csv(weekStart.AddDays(6).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture))).Append("\r\n");
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
    }

    public static byte[] BuildXlsx(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows, string customerLabel, DateOnly weekStart) =>
        BuildXlsxPackage(BuildWorksheet(rows, customerLabel, weekStart));

    private static byte[] BuildXlsxPackage(string worksheet, bool printTitles = false)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteEntry(archive, "[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""");
            WriteEntry(archive, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            const string workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Phiếu nấu" sheetId="1" r:id="rId1"/></sheets></workbook>""";
            WriteEntry(archive, "xl/workbook.xml", printTitles ? workbook.Replace("</workbook>", """<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'Phiếu nấu'!$1:$2</definedName></definedNames></workbook>""", StringComparison.Ordinal) : workbook);
            WriteEntry(archive, "xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""");
            const string styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>""";
            WriteEntry(archive, "xl/styles.xml", printTitles ? AddCookingStyles(styles) : styles);
            WriteEntry(archive, "xl/worksheets/sheet1.xml", worksheet);
        }
        return output.ToArray();
    }

    private static string BuildWorksheet(IReadOnlyList<ReconciliationKitchenCookingRowDto> rows, string customerLabel, DateOnly weekStart)
    {
        string[] headers = ["Ngày", "Thứ", "Ca", "Thực đơn", "Món", "Số suất", "Nguyên liệu", "Đơn vị", "Định lượng BOM / suất", "Hao hụt (%)", "Tổng lượng cần cho món", "Khách hàng", "Tuần bắt đầu", "Tuần kết thúc"];
        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="13" customWidth="1"/><col min="2" max="4" width="14" customWidth="1"/><col min="5" max="5" width="28" customWidth="1"/><col min="6" max="6" width="10" customWidth="1"/><col min="7" max="7" width="28" customWidth="1"/><col min="8" max="8" width="10" customWidth="1"/><col min="9" max="11" width="20" customWidth="1"/><col min="12" max="12" width="28" customWidth="1"/><col min="13" max="14" width="16" customWidth="1"/></cols><sheetData>""");
        AppendXlsxRow(xml, 1, headers, true);
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            AppendXlsxRow(xml, index + 2,
            [
                row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), row.Weekday, row.ShiftName, row.MenuVariant, row.DishName,
                row.Servings.ToString(CultureInfo.InvariantCulture), row.IngredientName, row.UnitName, Rate(row.BomQuantityPerServing),
                row.WasteRatePercent is null ? string.Empty : Number(row.WasteRatePercent.Value), Number(row.TotalRequiredQuantity),
                customerLabel, weekStart.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), weekStart.AddDays(6).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
            ], false);
        }
        return xml.Append($"</sheetData><autoFilter ref=\"A1:N{rows.Count + 1}\"/></worksheet>").ToString();
    }

    private static string AddCookingStyles(string styles)
    {
        var dishStyles = new StringBuilder();
        // Styles 2–5 are shaded/unshaded, each with a stronger rule at the start of a dish.
        // Styles 6–9 use the same treatments and center the merged serving cells.
        foreach (var centered in new[] { false, true })
        foreach (var fill in new[] { 0, 3 })
        foreach (var border in new[] { 1, 2 })
        {
            var alignment = centered ? """horizontal="center" vertical="center" """ : """vertical="top" """;
            dishStyles.Append($"""<xf numFmtId="0" fontId="0" fillId="{fill}" borderId="{border}" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment {alignment}wrapText="1"/></xf>""");
        }
        dishStyles.Append("""<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1" wrapText="1"/></xf>""");
        dishStyles.Append("""<xf numFmtId="0" fontId="2" fillId="4" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" indent="1" wrapText="1"/></xf>""");
        const string gridRule = """style="thin"><color rgb="FFC7D5E2"/>""";
        const string headerRule = """style="thin"><color rgb="FF8296AB"/>""";
        return styles.Replace("FFFFFFFF", "FF172638", StringComparison.Ordinal)
            .Replace("FF1F4E78", "FFE9F1F9", StringComparison.Ordinal)
            .Replace("<fonts count=\"2\">", "<fonts count=\"3\">", StringComparison.Ordinal)
            .Replace("</fonts>", """<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts>""", StringComparison.Ordinal)
            .Replace("<fills count=\"3\">", "<fills count=\"5\">", StringComparison.Ordinal)
            .Replace("</fills>", """<fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF264B67"/></patternFill></fill></fills>""", StringComparison.Ordinal)
            .Replace("<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>",
                $"""<borders count="4"><border><left/><right/><top/><bottom/><diagonal/></border><border><left {gridRule}</left><right {gridRule}</right><top {gridRule}</top><bottom {gridRule}</bottom><diagonal/></border><border><left {gridRule}</left><right {gridRule}</right><top {headerRule}</top><bottom {gridRule}</bottom><diagonal/></border><border><left {headerRule}</left><right {headerRule}</right><top {headerRule}</top><bottom {headerRule}</bottom><diagonal/></border></borders>""", StringComparison.Ordinal)
            .Replace("""fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">""",
                """fontId="1" fillId="2" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">""", StringComparison.Ordinal)
            .Replace("<cellXfs count=\"2\">", "<cellXfs count=\"12\">", StringComparison.Ordinal)
            .Replace("</cellXfs>", $"{dishStyles}</cellXfs>", StringComparison.Ordinal);
    }

    private static void AppendXlsxRow(StringBuilder xml, int rowNumber, IReadOnlyList<string> values, bool header)
    {
        xml.Append($"<row r=\"{rowNumber}\">");
        var style = header ? " s=\"1\"" : string.Empty;
        for (var index = 0; index < values.Count; index++)
        {
            var reference = $"{(char)('A' + index)}{rowNumber}";
            if (!header && index is 5 or 8 or 9 or 10 && decimal.TryParse(values[index], NumberStyles.Number, CultureInfo.InvariantCulture, out _))
                xml.Append($"<c r=\"{reference}\" t=\"n\"{style}><v>{values[index]}</v></c>");
            else
                xml.Append($"<c r=\"{reference}\" t=\"inlineStr\"{style}><is><t>{SecurityElement.Escape(values[index])}</t></is></c>");
        }
        xml.Append("</row>");
    }

    private static void WriteEntry(ZipArchive archive, string path, string content)
    {
        using var writer = new StreamWriter(archive.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string Csv(string value) => MrxReportCsvStreamWriter.Csv(value);
    private static string Number(decimal? value) => value?.ToString("0.######", CultureInfo.InvariantCulture) ?? string.Empty;
    private static string Rate(decimal? value) => value?.ToString("0.############################", CultureInfo.InvariantCulture) ?? string.Empty;
    private static string Shift(string value) => value.Trim().ToUpperInvariant() switch
    {
        "MORNING" => "Ca sáng",
        "AFTERNOON" => "Ca chiều",
        "EVENING" => "Ca tối",
        "FULLDAY" => "Cả ngày",
        _ => value
    };

    private static string MenuVariant(string value) => value.Trim().ToLowerInvariant() switch
    {
        "savory" => "Mặn",
        "vegetarian" => "Chay",
        _ => throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_MISSING: Loại thực đơn đóng băng không hợp lệ.")
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
