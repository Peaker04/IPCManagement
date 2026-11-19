using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class PreparationWorkbookBuilder
{
    private static readonly HashSet<int> MenuNumericColumns = [5];
    private static readonly HashSet<int> DemandNumericColumns = [2, 3, 4];
    private static readonly HashSet<int> DetailNumericColumns = [7];
    private const string PrintSettings = "<pageMargins left=\"0.25\" right=\"0.25\" top=\"0.4\" bottom=\"0.4\" header=\"0.2\" footer=\"0.2\"/><pageSetup paperSize=\"9\" orientation=\"landscape\" fitToWidth=\"1\" fitToHeight=\"0\"/>";

    private static string BuildPreparationSheet(ReconciliationPreparationWorkbookDto workbook, bool supplierDemand)
    {
        var last = supplierDemand ? "C" : "E";
        var duplicateNames = workbook.SummaryRows.GroupBy(row => row.IngredientName.Trim(), StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Select(row => row.IngredientId).Distinct().Skip(1).Any())
            .Select(group => group.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var xml = new StringBuilder("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="55" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/><col min="3" max="5" width="24" customWidth="1"/></cols><sheetData>""");
        AppendXlsxRow(xml, 1, [supplierDemand ? "NHU CẦU THEO NCC" : "NHU CẦU NGUYÊN LIỆU"], true);
        AppendXlsxRow(xml, 2, [ScopeLabel(workbook)], false);
        var customerText = "Khách hàng: " + string.Join("; ", workbook.CustomerColumns);
        AppendXlsxRow(xml, 3, [customerText], false, wrap: true, height: WrappedHeight(customerText, 72));
        AppendXlsxRow(xml, 4, supplierDemand ? ["Nguyên liệu", "ĐVT", "Tổng nhu cầu"] : ["Nguyên liệu", "ĐVT", "Tổng nhu cầu", "Còn thiếu", "Cấp ngoài nhu cầu"], true);
        var rowNumber = 5;
        var merges = new List<string> { $"A1:{last}1", $"A2:{last}2", $"A3:{last}3" };
        foreach (var supplyGroup in workbook.SummaryRows.GroupBy(row => supplierDemand ? string.Empty : row.PreparationGroupCode)
            .OrderBy(group => group.Key == PreparationSupplyGroups.Unclassified ? 1 : 0).ThenBy(group => group.Key, StringComparer.Ordinal))
        {
            if (!supplierDemand)
            {
                merges.Add($"A{rowNumber}:{last}{rowNumber}");
                AppendXlsxRow(xml, rowNumber++, [$"NHÓM CUNG ỨNG: {PreparationSupplyGroups.Labels.GetValueOrDefault(supplyGroup.Key, "Chưa phân nhóm")}"], true);
            }
            foreach (var supplier in supplyGroup.GroupBy(row => new { row.SupplierId, row.SupplierName })
                .OrderBy(group => supplierDemand && group.Key.SupplierId is null).ThenBy(group => group.Key.SupplierName, StringComparer.Ordinal))
            {
                merges.Add($"A{rowNumber}:{last}{rowNumber}");
                var supplierLabel = supplier.Key.SupplierName + (supplier.First().SupplierCode is { } code ? $" ({code})" : "");
                var heading = supplierDemand && supplier.Key.SupplierId is null ? "CẦN XÁC MINH NCC" : "NHÀ CUNG CẤP";
                AppendXlsxRow(xml, rowNumber++, [$"{heading}: {supplierLabel}"], true);
                foreach (var row in supplier.OrderBy(item => item.IngredientName, StringComparer.Ordinal))
                {
                    var name = duplicateNames.Contains(row.IngredientName.Trim()) ? $"{row.IngredientName} ({row.IngredientCode})" : row.IngredientName;
                    var quantity = Number(row.TotalQuantity);
                    AppendXlsxRow(xml, rowNumber++, supplierDemand
                        ? [name, row.CanonicalUnitName, quantity]
                        : [name, row.CanonicalUnitName, quantity, row.RemainingQuantity is { } remaining ? Number(remaining) : "Chưa xác định", Number(row.UnplannedIssuedQuantity)],
                        false, DemandNumericColumns,
                        wrap: true, integer: supplierDemand && !quantity.Contains('.'));
                }
            }
        }
        xml.Append($"</sheetData><mergeCells count=\"{merges.Count}\">");
        foreach (var merge in merges) xml.Append($"<mergeCell ref=\"{merge}\"/>");
        return xml.Append("</mergeCells>" + PrintSettings + "</worksheet>").ToString();
    }
    public static byte[] BuildXlsx(ReconciliationPreparationWorkbookDto workbook, bool includeMenus = false, bool supplierDemand = false)
    {
        var customerIds = workbook.CustomerColumnDefinitions.Select(customer => customer.CustomerId).ToHashSet(StringComparer.Ordinal);
        if (customerIds.Count != workbook.CustomerColumnDefinitions.Count || customerIds.Any(string.IsNullOrWhiteSpace)
            || !workbook.CustomerColumns.SequenceEqual(workbook.CustomerColumnDefinitions.Select(CustomerLabel), StringComparer.Ordinal)
            || workbook.SummaryRows.Any(row => row.CustomerQuantities.Count != customerIds.Count || row.CustomerQuantities.Keys.Any(key => !customerIds.Contains(key)))
            || workbook.MenuRows.Any(row => !customerIds.Contains(row.CustomerId)))
            throw new InvalidOperationException("Thiếu hoặc không khớp định danh khách hàng trong bảng chuẩn bị.");
        var includesMenus = !supplierDemand && (includeMenus || workbook.MenuRows.Count > 0);
        var secondSheetType = supplierDemand ? "" : """<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""";
        var secondSheet = supplierDemand ? "" : """<sheet name="Chi tiết phân bổ" sheetId="2" r:id="rId2"/>""";
        var secondSheetLink = supplierDemand ? "" : """<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>""";
        if (includesMenus) secondSheet = secondSheet.Replace("Chi tiết phân bổ", "Thực đơn cho bếp");
        var firstSheetName = supplierDemand ? "Nhu cầu theo NCC" : includesMenus ? "Nhu cầu nguyên liệu" : "Chuẩn bị nguyên liệu";
        var titles = supplierDemand ? "<definedNames><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"0\">'Nhu cầu theo NCC'!$1:$4</definedName></definedNames>" : includesMenus
            ? "<definedNames><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"0\">'Nhu cầu nguyên liệu'!$1:$4</definedName><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"1\">'Thực đơn cho bếp'!$1:$3</definedName></definedNames>"
            : "<definedNames><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"0\">'Chuẩn bị nguyên liệu'!$1:$1</definedName><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"1\">'Chi tiết phân bổ'!$1:$1</definedName></definedNames>";
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteEntry(archive, "[Content_Types].xml", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>{secondSheetType}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""");
            WriteEntry(archive, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            WriteEntry(archive, "xl/workbook.xml", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="{firstSheetName}" sheetId="1" r:id="rId1"/>{secondSheet}</sheets>{titles}</workbook>""");
            WriteEntry(archive, "xl/_rels/workbook.xml.rels", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>{secondSheetLink}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""");
            WriteEntry(archive, "xl/styles.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.######"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>""");
            WriteEntry(archive, "xl/worksheets/sheet1.xml", supplierDemand || includesMenus ? BuildPreparationSheet(workbook, supplierDemand) : BuildSummarySheet(workbook));
            if (!supplierDemand)
                WriteEntry(archive, "xl/worksheets/sheet2.xml", includesMenus ? BuildMenuSheet(workbook) : BuildDetailSheet(workbook.DetailRows));

        }
        return output.ToArray();
    }

    private static string BuildSummarySheet(ReconciliationPreparationWorkbookDto workbook)
    {
        var headers = new List<string> { "Nhà cung cấp", "Mã nguyên liệu", "Tên nguyên liệu", "Đơn vị tính" };
        headers.AddRange(workbook.CustomerColumns);
        headers.Add("Tổng cộng");

        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>""");
        AppendXlsxRow(xml, 1, headers, true);

        var numericColumns = Enumerable.Range(4, headers.Count - 4).ToHashSet();
        for (var index = 0; index < workbook.SummaryRows.Count; index++)
        {
            var row = workbook.SummaryRows[index];
            var values = new List<string>
            {
                row.SupplierName,
                row.IngredientCode,
                row.IngredientName,
                row.CanonicalUnitName
            };
            foreach (var customer in workbook.CustomerColumnDefinitions)
                values.Add(Number(row.CustomerQuantities[customer.CustomerId]));
            values.Add(Number(row.TotalQuantity));

            AppendXlsxRow(xml, index + 2, values, false, numericColumns);
        }

        var totalColLetter = GetColumnLetter(headers.Count - 1);
        var autoFilterRange = $"A1:{totalColLetter}{workbook.SummaryRows.Count + 1}";
        return xml.Append($"</sheetData><autoFilter ref=\"{autoFilterRange}\"/></worksheet>").ToString();
    }

    private static string BuildDetailSheet(IReadOnlyList<ReconciliationPreparationDetailRowDto> rows)
    {
        string[] headers =
        [
            "Khách hàng",
            "Mã lô đối soát",
            "Ngày phục vụ",
            "Ca",
            "Mã nguyên liệu",
            "Tên nguyên liệu",
            "Đơn vị tính",
            "Số lượng",
            "Phân loại",
            "Trạng thái xuất",
            "Nhà cung cấp"
        ];

        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>""");
        AppendXlsxRow(xml, 1, headers, true);

        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            AppendXlsxRow(xml, index + 2,
            [
                $"{row.CustomerCode} · {row.CustomerName}",
                row.BatchId,
                row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                FormatShift(row.ShiftName),
                row.IngredientCode,
                row.IngredientName,
                row.CanonicalUnitName,
                Number(row.Quantity),
                row.Classification,
                row.IssueStatus,
                row.SupplierName
            ], false, DetailNumericColumns);
        }

        var autoFilterRange = $"A1:K{rows.Count + 1}";
        return xml.Append($"</sheetData><autoFilter ref=\"{autoFilterRange}\"/></worksheet>").ToString();
    }

    private static string ScopeLabel(ReconciliationPreparationWorkbookDto workbook)
        => workbook.ScopeStartDate is { } start && workbook.ScopeEndDate is { } end
            ? start == end ? $"Ngày {start:dd/MM/yyyy}" : $"Tuần {start:dd/MM/yyyy} – {end:dd/MM/yyyy}"
            : "Không có dữ liệu trong phạm vi chọn";

    private static string BuildMenuSheet(ReconciliationPreparationWorkbookDto workbook)
    {
        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="4" width="15" customWidth="1"/><col min="5" max="5" width="34" customWidth="1"/><col min="6" max="6" width="12" customWidth="1"/></cols><sheetData>""");
        var merges = new List<string> { "A1:F1", "A2:F2" };
        AppendXlsxRow(xml, 1, ["THỰC ĐƠN CHO BẾP"], true);
        AppendXlsxRow(xml, 2, [ScopeLabel(workbook)], false);
        AppendXlsxRow(xml, 3, ["Khách hàng", "Ngày", "Ca", "Loại thực đơn", "Món", "Số suất"], true);
        var rowNumber = 4;
        var peersByContext = workbook.MenuRows.ToLookup(row => (row.CustomerId, row.ServiceDate, row.ShiftName, row.MenuVariant, Name: row.DishName.Trim().ToUpperInvariant()));
        var customerLabels = workbook.CustomerColumnDefinitions.ToDictionary(customer => customer.CustomerId, CustomerLabel);
        foreach (var row in workbook.MenuRows.OrderBy(row => row.ServiceDate).ThenBy(row => customerLabels[row.CustomerId], StringComparer.Ordinal)
                     .ThenBy(row => row.ShiftName == "Sáng" ? 0 : 1).ThenBy(row => row.ShiftName, StringComparer.Ordinal)
                     .ThenBy(row => row.MenuVariant, StringComparer.Ordinal).ThenBy(row => row.DishName, StringComparer.Ordinal))
        {
            var peers = peersByContext[(row.CustomerId, row.ServiceDate, row.ShiftName, row.MenuVariant, row.DishName.Trim().ToUpperInvariant())];
            var name = peers.Any(peer => peer.DishCode != row.DishCode) ? $"{row.DishName} ({row.DishCode})" : row.DishName;
            if (peers.Any(peer => peer.BatchId != row.BatchId && peer.DishCode == row.DishCode))
                name += $" · lô {row.BatchId[..Math.Min(row.BatchId.Length, 8)]}";
            AppendXlsxRow(xml, rowNumber++,
                [customerLabels[row.CustomerId], row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), row.ShiftName,
                    row.MenuVariant, name, row.Servings.ToString(CultureInfo.InvariantCulture)], false, MenuNumericColumns, wrap: true, integer: true);
        }
        xml.Append($"</sheetData><autoFilter ref=\"A3:F{Math.Max(3, rowNumber - 1)}\"/><mergeCells count=\"{merges.Count}\">");
        foreach (var merge in merges) xml.Append($"<mergeCell ref=\"{merge}\"/>");
        return xml.Append("</mergeCells>" + PrintSettings + "</worksheet>").ToString();
    }

    private static int WrappedHeight(string value, int charsPerLine)
        => Math.Min(405, 15 * Math.Max(1, (value.Length + charsPerLine - 1) / charsPerLine));

    private static void AppendXlsxRow(StringBuilder xml, int rowNumber, IReadOnlyList<string> values, bool header, IReadOnlySet<int>? numericColumns = null,
        bool wrap = false, bool integer = false, int? height = null)
    {
        if (rowNumber > 1_048_576 || values.Count > 16_384)
            throw new IPCManagement.Api.Exceptions.BusinessRuleException("Phạm vi xuất vượt giới hạn hàng/cột của Excel. Hãy chọn ít khách hàng hoặc ngày hơn.");
        foreach (var value in values)
        {
            if (value.Length > 32_767)
                throw new IPCManagement.Api.Exceptions.BusinessRuleException("Nội dung ô vượt giới hạn Excel. Hãy thu hẹp phạm vi xuất.");
            try { System.Xml.XmlConvert.VerifyXmlChars(value); }
            catch (System.Xml.XmlException) { throw new IPCManagement.Api.Exceptions.BusinessRuleException("Dữ liệu chứa ký tự điều khiển không hợp lệ để xuất Excel. Hãy kiểm tra lại tên/mã nguồn."); }
        }
        xml.Append($"<row r=\"{rowNumber}\"");
        if (height is { } explicitHeight) xml.Append($" ht=\"{explicitHeight}\" customHeight=\"1\"");
        xml.Append('>');
        for (var index = 0; index < values.Count; index++)
        {
            var colLetter = GetColumnLetter(index);
            var reference = $"{colLetter}{rowNumber}";
            var style = header ? " s=\"1\"" : wrap ? " s=\"3\"" : string.Empty;
            if (numericColumns?.Contains(index) == true && values[index] != "Chưa xác định")
                xml.Append($"<c r=\"{reference}\" s=\"{(integer ? 4 : 2)}\" t=\"n\"><v>{values[index]}</v></c>");
            else
                xml.Append($"<c r=\"{reference}\" t=\"inlineStr\"{style}><is><t>{SecurityElement.Escape(values[index])}</t></is></c>");
        }
        xml.Append("</row>");
    }

    private static string GetColumnLetter(int colIndex)
    {
        var result = string.Empty;
        for (var number = colIndex + 1; number > 0; number = (number - 1) / 26)
            result = (char)('A' + (number - 1) % 26) + result;
        return result;
    }

    private static void WriteEntry(ZipArchive archive, string path, string content)
    {
        using var writer = new StreamWriter(archive.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string CustomerLabel(ReconciliationPreparationCustomerColumnDto customer) => $"{customer.CustomerCode} · {customer.CustomerName}";

    private static string FormatShift(string shiftName) => shiftName.ToUpperInvariant() switch
    {
        "MORNING" => "Sáng",
        "AFTERNOON" => "Chiều",
        _ => shiftName
    };

    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
}
