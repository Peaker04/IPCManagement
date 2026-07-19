using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

namespace IPCManagement.Api.Services;

internal static class BomTemplateWorkbookBuilder
{
    public static readonly string[] Headers =
    [
        "DishCode",
        "DishName",
        "PriceTier",
        "CustomerCode",
        "IngredientName",
        "UnitCode",
        "GrossQtyPerServing",
        "WasteRatePercent",
        "EffectiveFrom",
        "EffectiveTo",
        "BomStatus",
        "Note"
    ];

    public static byte[] Build(
        decimal priceTier,
        string scope,
        DateOnly generatedDate,
        IReadOnlyList<IReadOnlyList<string>> rows)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddEntry(archive, "[Content_Types].xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                  <Default Extension="xml" ContentType="application/xml"/>
                  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
                  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
                  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                </Types>
                """);
            AddEntry(archive, "_rels/.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
                  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
                </Relationships>
                """);
            AddEntry(archive, "docProps/core.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                  <dc:creator>IPC System</dc:creator>
                  <cp:lastModifiedBy>IPC System</cp:lastModifiedBy>
                  <dcterms:created xsi:type="dcterms:W3CDTF">2026-07-12T00:00:00Z</dcterms:created>
                  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-12T00:00:00Z</dcterms:modified>
                </cp:coreProperties>
                """);
            AddEntry(archive, "docProps/app.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
                  <Application>IPC Management</Application>
                </Properties>
                """);
            AddEntry(archive, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="BOM" sheetId="1" r:id="rId1"/>
                  </sheets>
                </workbook>
                """);
            AddEntry(archive, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                </Relationships>
                """);
            AddEntry(archive, "xl/styles.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="2">
                    <font><sz val="11"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><name val="Calibri"/></font>
                  </fonts>
                  <fills count="2">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                  </fills>
                  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="2">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
                  </cellXfs>
                  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                  <dxfs count="0"/>
                  <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
                </styleSheet>
                """);
            AddEntry(archive, "xl/worksheets/sheet1.xml", BuildSheetXml(priceTier, scope, generatedDate, rows));
        }

        return output.ToArray();
    }

    private static string BuildSheetXml(
        decimal priceTier,
        string scope,
        DateOnly generatedDate,
        IReadOnlyList<IReadOnlyList<string>> rows)
    {
        var builder = new StringBuilder();
        var lastRow = Math.Max(5, rows.Count + 4);
        var lastColumn = ColumnIndexToLetter(Headers.Length);
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        builder.AppendLine("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine(CultureInfo.InvariantCulture, $"  <dimension ref=\"A1:{lastColumn}{lastRow}\"/>");
        builder.AppendLine("""
          <sheetViews>
            <sheetView workbookViewId="0">
              <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
            </sheetView>
          </sheetViews>
          <sheetFormatPr defaultRowHeight="15"/>
          <cols>
            <col min="1" max="1" width="18" customWidth="1"/>
            <col min="2" max="2" width="28" customWidth="1"/>
            <col min="3" max="4" width="14" customWidth="1"/>
            <col min="5" max="5" width="28" customWidth="1"/>
            <col min="6" max="8" width="18" customWidth="1"/>
            <col min="9" max="10" width="14" customWidth="1"/>
            <col min="11" max="12" width="16" customWidth="1"/>
          </cols>
          <sheetData>
        """);
        AddTextRow(builder, 1, ["BOM IPC - nhập định lượng nguyên liệu"], styleIndex: 1);
        AddTextRow(builder, 2, [
            "Đơn giá",
            priceTier.ToString("0", CultureInfo.InvariantCulture),
            "Phạm vi",
            scope,
            "Ngày tạo",
            generatedDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
        ]);
        AddTextRow(builder, 4, Headers, styleIndex: 1);

        var rowNumber = 5;
        foreach (var row in rows)
        {
            AddTextRow(builder, rowNumber, row);
            rowNumber++;
        }

        builder.AppendLine("  </sheetData>");
        builder.AppendLine("</worksheet>");
        return builder.ToString();
    }

    private static void AddTextRow(StringBuilder builder, int rowNumber, IReadOnlyList<string> cells, int styleIndex = 0)
    {
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\">");
        for (var index = 0; index < cells.Count; index++)
        {
            var column = ColumnIndexToLetter(index + 1);
            var style = styleIndex > 0 ? $" s=\"{styleIndex}\"" : string.Empty;
            builder.Append(CultureInfo.InvariantCulture, $"<c r=\"{column}{rowNumber}\" t=\"inlineStr\"{style}><is><t>{Escape(cells[index])}</t></is></c>");
        }

        builder.AppendLine("</row>");
    }

    private static string ColumnIndexToLetter(int column)
    {
        var result = string.Empty;
        while (column > 0)
        {
            column--;
            result = (char)('A' + column % 26) + result;
            column /= 26;
        }

        return result;
    }

    private static string Escape(string value)
        => SecurityElement.Escape(value) ?? string.Empty;

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        writer.Write(content);
    }
}
