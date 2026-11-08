using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

namespace IPCManagement.Api.Features.Catalog.Services;

internal static class BomTemplateWorkbookBuilder
{
    public static readonly string[] Headers =
    [
        "DishCode", "DishName", "PriceTier", "CustomerCode", "IngredientName", "UnitCode",
        "GrossQtyPerServing", "WasteRatePercent", "EffectiveFrom", "EffectiveTo", "BomStatus", "Note"
    ];

    internal static readonly string[] DisplayHeaders =
    [
        "Tên món", "Nguyên liệu chính", "Đơn vị", "Định lượng/suất", "Hao hụt (%)", "Ghi chú",
        "Mã món", "Mức giá", "Khách hàng", "Hiệu lực từ", "Hiệu lực đến", "Trạng thái"
    ];

    private static readonly int[] DisplayOrder = [1, 4, 5, 6, 7, 11, 0, 2, 3, 8, 9, 10];
    private static readonly HashSet<int> EditableColumns = [2, 3, 4, 5, 6];

    public static byte[] Build(
        decimal priceTier,
        string scope,
        DateOnly generatedDate,
        IReadOnlyList<IReadOnlyList<string>> rows,
        IReadOnlyList<string>? ingredientNames = null,
        IReadOnlyList<string>? unitOptions = null)
    {
        ingredientNames ??= [];
        unitOptions ??= [];

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
                  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
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
                  <dc:creator>IPC System</dc:creator><cp:lastModifiedBy>IPC System</cp:lastModifiedBy>
                  <dcterms:created xsi:type="dcterms:W3CDTF">2026-07-12T00:00:00Z</dcterms:created>
                  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-12T00:00:00Z</dcterms:modified>
                </cp:coreProperties>
                """);
            AddEntry(archive, "docProps/app.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>IPC Management</Application></Properties>
                """);
            AddEntry(archive, "xl/workbook.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <sheets>
                    <sheet name="BOM" sheetId="1" r:id="rId1"/>
                    <sheet name="HUONG_DAN" sheetId="2" r:id="rId3"/>
                    <sheet name="DANH_MUC" sheetId="3" state="hidden" r:id="rId4"/>
                  </sheets>
                </workbook>
                """);
            AddEntry(archive, "xl/_rels/workbook.xml.rels", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
                  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
                </Relationships>
                """);
            AddEntry(archive, "xl/styles.xml", BuildStylesXml());
            AddEntry(archive, "xl/worksheets/sheet1.xml", BuildSheetXml(priceTier, scope, generatedDate, rows, ingredientNames.Count, unitOptions.Count));
            AddEntry(archive, "xl/worksheets/sheet2.xml", BuildInstructionsSheetXml());
            AddEntry(archive, "xl/worksheets/sheet3.xml", BuildCatalogSheetXml(ingredientNames, unitOptions));
        }

        return output.ToArray();
    }

    private static string BuildStylesXml() => """
        <?xml version="1.0" encoding="UTF-8"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <fonts count="3">
            <font><sz val="11"/><name val="Arial"/></font>
            <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font>
            <font><b/><sz val="11"/><name val="Arial"/></font>
          </fonts>
          <fills count="4">
            <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FF00A6D6"/><bgColor indexed="64"/></patternFill></fill>
            <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
          </fills>
          <borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="4">
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
            <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyProtection="1"><protection locked="0"/></xf>
            <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
          </cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/>
          <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
        </styleSheet>
        """;

    private static string BuildSheetXml(decimal priceTier, string scope, DateOnly generatedDate, IReadOnlyList<IReadOnlyList<string>> rows, int ingredientCount, int unitCount)
    {
        var builder = new StringBuilder();
        var lastRow = Math.Max(5, rows.Count + 4);
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        builder.AppendLine("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine(CultureInfo.InvariantCulture, $"  <dimension ref=\"A1:L{lastRow}\"/>");
        builder.AppendLine("""
          <sheetViews><sheetView workbookViewId="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
          <sheetFormatPr defaultRowHeight="18"/>
          <cols>
            <col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/>
            <col min="3" max="3" width="16" customWidth="1"/><col min="4" max="5" width="18" customWidth="1"/>
            <col min="6" max="6" width="28" customWidth="1"/><col min="7" max="12" width="14" hidden="1" customWidth="1"/>
          </cols><sheetData>
        """);
        AddTextRow(builder, 1, ["IPC - ĐỊNH LƯỢNG NGUYÊN LIỆU THEO SUẤT"], styleIndex: 3);
        AddTextRow(builder, 2, ["Mức giá", priceTier.ToString("0", CultureInfo.InvariantCulture), "Phạm vi", scope, "Ngày tạo", generatedDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)]);
        AddTextRow(builder, 3, ["Ô màu vàng là vùng nhập liệu. Chọn nguyên liệu và đơn vị từ danh sách để hạn chế sai lệch."]);
        AddTextRow(builder, 4, DisplayHeaders, styleIndex: 1);
        var rowNumber = 5;
        foreach (var row in rows)
        {
            var displayed = DisplayOrder.Select(index => row[index]).ToArray();
            AddTextRow(builder, rowNumber++, displayed, editableColumns: EditableColumns);
        }
        builder.AppendLine("  </sheetData>");
        builder.AppendLine("  <sheetProtection sheet=\"1\" objects=\"1\" scenarios=\"1\" autoFilter=\"0\" sort=\"0\"/>");
        builder.AppendLine(CultureInfo.InvariantCulture, $"  <autoFilter ref=\"A4:F{lastRow}\"/>");
        builder.AppendLine("  <dataValidations count=\"4\">");
        var ingredientEnd = Math.Max(2, ingredientCount + 1);
        var unitEnd = Math.Max(2, unitCount + 1);
        builder.AppendLine(CultureInfo.InvariantCulture, $"    <dataValidation type=\"list\" allowBlank=\"1\" showInputMessage=\"1\" showErrorMessage=\"0\" promptTitle=\"Chọn nguyên liệu\" prompt=\"Chọn từ danh mục hoặc nhập tên mới.\" sqref=\"B5:B{lastRow}\"><formula1>'DANH_MUC'!$A$2:$A${ingredientEnd}</formula1></dataValidation>");
        builder.AppendLine(CultureInfo.InvariantCulture, $"    <dataValidation type=\"list\" allowBlank=\"1\" showInputMessage=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"Đơn vị không hợp lệ\" error=\"Vui lòng chọn đơn vị trong danh sách.\" sqref=\"C5:C{lastRow}\"><formula1>'DANH_MUC'!$B$2:$B${unitEnd}</formula1></dataValidation>");
        builder.AppendLine(CultureInfo.InvariantCulture, $"    <dataValidation type=\"decimal\" operator=\"greaterThan\" allowBlank=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"Định lượng không hợp lệ\" error=\"Định lượng phải lớn hơn 0.\" sqref=\"D5:D{lastRow}\"><formula1>0</formula1></dataValidation>");
        builder.AppendLine(CultureInfo.InvariantCulture, $"    <dataValidation type=\"decimal\" operator=\"between\" allowBlank=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"Hao hụt không hợp lệ\" error=\"Hao hụt phải từ 0 đến 100%.\" sqref=\"E5:E{lastRow}\"><formula1>0</formula1><formula2>100</formula2></dataValidation>");
        builder.AppendLine("  </dataValidations></worksheet>");
        return builder.ToString();
    }

    private static string BuildInstructionsSheetXml()
    {
        var builder = new StringBuilder();
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:C14"/><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/><col min="3" max="3" width="38" customWidth="1"/></cols><sheetData>""");
        AddTextRow(builder, 1, ["HƯỚNG DẪN NHẬP ĐỊNH LƯỢNG"], styleIndex: 3);
        AddTextRow(builder, 3, ["Cột", "Yêu cầu", "Cách nhập"], styleIndex: 1);
        AddTextRow(builder, 4, ["Tên món", "Hệ thống khóa", "Dùng để xác định món đang khai báo"]);
        AddTextRow(builder, 5, ["Nguyên liệu chính", "Bắt buộc", "Ưu tiên chọn từ danh sách; có thể nhập tên mới"]);
        AddTextRow(builder, 6, ["Đơn vị", "Bắt buộc", "Chọn trong danh sách"]);
        AddTextRow(builder, 7, ["Định lượng/suất", "Bắt buộc", "Số dương, theo đúng đơn vị đã chọn"]);
        AddTextRow(builder, 8, ["Hao hụt (%)", "Tùy chọn", "Từ 0 đến 100; để trống được hiểu là 0"]);
        AddTextRow(builder, 9, ["Ghi chú", "Tùy chọn", "Ghi cách sơ chế hoặc yêu cầu riêng"]);
        AddTextRow(builder, 11, ["Quy trình", "1. Chọn danh mục", "2. Nhập định lượng → 3. Tải lên → 4. Kiểm tra file"]);
        AddTextRow(builder, 13, ["Lưu ý", "Không sửa cột ẩn", "Hệ thống quản lý mức giá, phạm vi, ngày hiệu lực và trạng thái"]);
        builder.AppendLine("</sheetData></worksheet>");
        return builder.ToString();
    }

    private static string BuildCatalogSheetXml(IReadOnlyList<string> ingredients, IReadOnlyList<string> units)
    {
        var builder = new StringBuilder();
        var lastRow = Math.Max(2, Math.Max(ingredients.Count, units.Count) + 1);
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine(CultureInfo.InvariantCulture, $"<dimension ref=\"A1:B{lastRow}\"/><sheetData>");
        AddTextRow(builder, 1, ["Nguyên liệu", "Đơn vị"], styleIndex: 1);
        for (var index = 0; index < lastRow - 1; index++)
        {
            AddTextRow(builder, index + 2, [ingredients.ElementAtOrDefault(index) ?? string.Empty, units.ElementAtOrDefault(index) ?? string.Empty]);
        }
        builder.AppendLine("</sheetData></worksheet>");
        return builder.ToString();
    }

    private static void AddTextRow(StringBuilder builder, int rowNumber, IReadOnlyList<string> cells, int styleIndex = 0, IReadOnlySet<int>? editableColumns = null)
    {
        builder.Append(CultureInfo.InvariantCulture, $"<row r=\"{rowNumber}\">");
        for (var index = 0; index < cells.Count; index++)
        {
            var resolvedStyle = editableColumns?.Contains(index + 1) == true ? 2 : styleIndex;
            var style = resolvedStyle > 0 ? $" s=\"{resolvedStyle}\"" : string.Empty;
            builder.Append(CultureInfo.InvariantCulture, $"<c r=\"{ColumnIndexToLetter(index + 1)}{rowNumber}\" t=\"inlineStr\"{style}><is><t>{Escape(cells[index])}</t></is></c>");
        }
        builder.AppendLine("</row>");
    }

    private static string ColumnIndexToLetter(int column)
    {
        var result = string.Empty;
        while (column > 0) { column--; result = (char)('A' + column % 26) + result; column /= 26; }
        return result;
    }

    private static string Escape(string value) => SecurityElement.Escape(value) ?? string.Empty;
    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }
}
