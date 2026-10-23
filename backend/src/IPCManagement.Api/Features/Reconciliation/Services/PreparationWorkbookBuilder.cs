using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class PreparationWorkbookBuilder
{
    public static byte[] BuildXlsx(ReconciliationPreparationWorkbookDto workbook)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            WriteEntry(archive, "[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>""");
            WriteEntry(archive, "_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>""");
            WriteEntry(archive, "xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tổng hợp chuẩn bị" sheetId="1" r:id="rId1"/><sheet name="Chi tiết phân bổ" sheetId="2" r:id="rId2"/></sheets></workbook>""");
            WriteEntry(archive, "xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>""");
            WriteEntry(archive, "xl/styles.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs></styleSheet>""");
            WriteEntry(archive, "xl/worksheets/sheet1.xml", BuildSummarySheet(workbook));
            WriteEntry(archive, "xl/worksheets/sheet2.xml", BuildDetailSheet(workbook.DetailRows));
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
            foreach (var col in workbook.CustomerColumns)
            {
                var qty = row.CustomerQuantities.TryGetValue(col, out var val) ? val : 0m;
                values.Add(qty > 0 ? Number(qty) : "-");
            }
            values.Add(Number(row.TotalQuantity));

            AppendXlsxRow(xml, index + 2, values, false);
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
                row.CustomerName,
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
            ], false);
        }

        var autoFilterRange = $"A1:K{rows.Count + 1}";
        return xml.Append($"</sheetData><autoFilter ref=\"{autoFilterRange}\"/></worksheet>").ToString();
    }

    private static void AppendXlsxRow(StringBuilder xml, int rowNumber, IReadOnlyList<string> values, bool header)
    {
        xml.Append($"<row r=\"{rowNumber}\">");
        for (var index = 0; index < values.Count; index++)
        {
            var colLetter = GetColumnLetter(index);
            var reference = $"{colLetter}{rowNumber}";
            var style = header ? " s=\"1\"" : string.Empty;
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

    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
}
