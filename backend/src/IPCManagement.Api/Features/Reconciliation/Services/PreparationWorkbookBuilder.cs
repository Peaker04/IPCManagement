using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class PreparationWorkbookBuilder
{
    private static readonly HashSet<int> MenuNumericColumns = [6];
    private static readonly HashSet<int> DetailNumericColumns = [7];
    public static byte[] BuildXlsx(ReconciliationPreparationWorkbookDto workbook)
    {
        var customerIds = workbook.CustomerColumnDefinitions.Select(customer => customer.CustomerId).ToHashSet(StringComparer.Ordinal);
        if (customerIds.Count != workbook.CustomerColumnDefinitions.Count || customerIds.Any(string.IsNullOrWhiteSpace)
            || !workbook.CustomerColumns.SequenceEqual(workbook.CustomerColumnDefinitions.Select(CustomerLabel), StringComparer.Ordinal)
            || workbook.SummaryRows.Any(row => row.CustomerQuantities.Count != customerIds.Count || row.CustomerQuantities.Keys.Any(key => !customerIds.Contains(key)))
            || workbook.MenuRows.Any(row => !customerIds.Contains(row.CustomerId)))
            throw new InvalidOperationException("Thiếu hoặc không khớp định danh khách hàng trong bảng chuẩn bị.");
        var includesMenus = workbook.MenuRows.Count > 0;
        var firstSheetName = includesMenus ? "Chuẩn bị nguyên liệu" : "Tổng hợp chuẩn bị";
        var secondSheetType = includesMenus ? "" : """<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>""";
        var secondSheet = includesMenus ? "" : """<sheet name="Chi tiết phân bổ" sheetId="2" r:id="rId2"/>""";
        var secondSheetLink = includesMenus ? "" : """<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>""";
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteEntry(archive, "[Content_Types].xml", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>{secondSheetType}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""");
            WriteEntry(archive, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            WriteEntry(archive, "xl/workbook.xml", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="{firstSheetName}" sheetId="1" r:id="rId1"/>{secondSheet}</sheets></workbook>""");
            WriteEntry(archive, "xl/_rels/workbook.xml.rels", $"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>{secondSheetLink}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""");
            WriteEntry(archive, "xl/styles.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>""");
            WriteEntry(archive, "xl/worksheets/sheet1.xml", includesMenus ? BuildPreparationSheet(workbook) : BuildSummarySheet(workbook));
            if (!includesMenus) WriteEntry(archive, "xl/worksheets/sheet2.xml", BuildDetailSheet(workbook.DetailRows));
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
                row.ShiftName,
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

    private static string BuildPreparationSheet(ReconciliationPreparationWorkbookDto workbook)
    {
        var width = Math.Max(7, workbook.CustomerColumns.Count + 4);
        var lastColumn = GetColumnLetter(width - 1);
        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="7" width="18" customWidth="1"/></cols><sheetData>""");
        var merges = new List<string> { $"A1:{lastColumn}1", $"A2:{lastColumn}2" };
        AppendXlsxRow(xml, 1, ["CHUẨN BỊ NGUYÊN LIỆU ĐA KHÁCH HÀNG"], true);
        var scopeLabel = workbook.ScopeStartDate is { } start && workbook.ScopeEndDate is { } end
            ? start == end ? $"Ngày {start:dd/MM/yyyy}" : $"Tuần {start:dd/MM/yyyy} – {end:dd/MM/yyyy}"
            : "Danh sách món theo ngày phục vụ";
        AppendXlsxRow(xml, 2, [scopeLabel], false);
        AppendXlsxRow(xml, 3, ["Khách hàng", "Ngày phục vụ", "Ca", "Thực đơn", "Mã món", "Tên món", "Số suất"], true);
        var rowNumber = 4;
        foreach (var row in workbook.MenuRows)
            AppendXlsxRow(xml, rowNumber++,
                [CustomerLabel(workbook.CustomerColumnDefinitions.Single(customer => customer.CustomerId == row.CustomerId)), row.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), row.ShiftName,
                    row.MenuVariant, row.DishCode, row.DishName, row.Servings.ToString(CultureInfo.InvariantCulture)], false, MenuNumericColumns);
        rowNumber++;
        AppendXlsxRow(xml, rowNumber, ["NGUYÊN LIỆU THEO NHÀ CUNG CẤP"], true);
        merges.Add($"A{rowNumber}:{lastColumn}{rowNumber}");
        rowNumber++;
        var headers = new List<string> { "Mã nguyên liệu", "Tên nguyên liệu", "Đơn vị tính" };
        headers.AddRange(workbook.CustomerColumns);
        headers.Add("Tổng cộng");
        var numericColumns = Enumerable.Range(3, headers.Count - 3).ToHashSet();
        foreach (var supplier in workbook.SummaryRows.GroupBy(row => row.SupplierName, StringComparer.OrdinalIgnoreCase))
        {
            AppendXlsxRow(xml, rowNumber, [$"Nhà cung cấp: {supplier.Key}"], true);
            merges.Add($"A{rowNumber}:{lastColumn}{rowNumber}");
            rowNumber++;
            AppendXlsxRow(xml, rowNumber++, headers, true);
            foreach (var row in supplier)
            {
                var values = new List<string> { row.IngredientCode, row.IngredientName, row.CanonicalUnitName };
                values.AddRange(workbook.CustomerColumnDefinitions.Select(customer => Number(row.CustomerQuantities[customer.CustomerId])));
                values.Add(Number(row.TotalQuantity));
                AppendXlsxRow(xml, rowNumber++, values, false, numericColumns);
            }
            rowNumber++;
        }
        xml.Append($"</sheetData><mergeCells count=\"{merges.Count}\">");
        foreach (var merge in merges) xml.Append($"<mergeCell ref=\"{merge}\"/>");
        return xml.Append("</mergeCells></worksheet>").ToString();
    }

    private static void AppendXlsxRow(StringBuilder xml, int rowNumber, IReadOnlyList<string> values, bool header, IReadOnlySet<int>? numericColumns = null)
    {
        xml.Append($"<row r=\"{rowNumber}\">");
        for (var index = 0; index < values.Count; index++)
        {
            var colLetter = GetColumnLetter(index);
            var reference = $"{colLetter}{rowNumber}";
            var style = header ? " s=\"1\"" : string.Empty;
            if (numericColumns?.Contains(index) == true)
                xml.Append($"<c r=\"{reference}\" t=\"n\"><v>{values[index]}</v></c>");
            else
                xml.Append($"<c r=\"{reference}\" t=\"inlineStr\"{style}><is><t>{SecurityElement.Escape(values[index])}</t></is></c>");
        }
        xml.Append("</row>");
    }

    private static string GetColumnLetter(int colIndex)
    {
        var div = colIndex / 26;
        var rem = colIndex % 26;
        if (div == 0) return ((char)('A' + rem)).ToString();
        return $"{(char)('A' + div - 1)}{(char)('A' + rem)}";
    }

    private static void WriteEntry(ZipArchive archive, string path, string content)
    {
        using var writer = new StreamWriter(archive.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string CustomerLabel(ReconciliationPreparationCustomerColumnDto customer) => $"{customer.CustomerCode} · {customer.CustomerName}";

    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
}
