using System.Globalization;
using System.IO.Compression;
using System.Security;
using System.Text;

namespace IPCManagement.Api.Services.SampleData;

internal static class WeeklyMenuTemplateWorkbookBuilder
{
    private static readonly decimal[] PriceTiers = [25000m, 30000m, 34000m];

    private static readonly string[] DayLabels =
    [
        "Thứ 2",
        "Thứ 3",
        "Thứ 4",
        "Thứ 5",
        "Thứ 6",
        "Thứ 7"
    ];

    private sealed record CustomerTemplateProfile(
        string CustomerCode,
        string Title,
        IReadOnlyList<string> SavorySlots,
        IReadOnlyList<string> VegetarianSlots);

    public static byte[] Build(DateOnly weekStartDate, string? customerCode)
    {
        var profile = ResolveProfile(customerCode);
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            AddEntry(archive, "[Content_Types].xml", BuildContentTypesXml());
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
                  <dcterms:created xsi:type="dcterms:W3CDTF">2026-07-17T00:00:00Z</dcterms:created>
                  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-07-17T00:00:00Z</dcterms:modified>
                </cp:coreProperties>
                """);
            AddEntry(archive, "docProps/app.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
                  <Application>IPC Management</Application>
                </Properties>
                """);
            AddEntry(archive, "xl/workbook.xml", BuildWorkbookXml(profile));
            AddEntry(archive, "xl/_rels/workbook.xml.rels", BuildWorkbookRelationshipsXml());
            AddEntry(archive, "xl/styles.xml", BuildStylesXml());

            for (var index = 0; index < PriceTiers.Length; index++)
            {
                AddEntry(
                    archive,
                    $"xl/worksheets/sheet{index + 1}.xml",
                    BuildSheetXml(profile, PriceTiers[index], weekStartDate));
            }
        }

        return output.ToArray();
    }

    private static CustomerTemplateProfile ResolveProfile(string? customerCode)
    {
        var normalized = NormalizeCustomerCode(customerCode);
        var davSavorySlots = new[] { "Món mặn chính", "Phụ 1", "Phụ 2", "Rau", "Canh", "Trái cây" };
        var davVegetarianSlots = new[] { "Món chay chính", "Phụ 1", "Phụ 2", "Rau", "Canh", "Trái cây" };
        var anvSavorySlots = new[] { "Món mặn chính", "Phụ", "Rau", "Canh", "Trái cây", "Sữa chua" };
        var anvVegetarianSlots = new[] { "Món chay chính", "Phụ", "Rau", "Canh", "Trái cây", "Sữa chua" };

        return normalized switch
        {
            "ANV" => new CustomerTemplateProfile("ANV", "THỰC ĐƠN AMANN", anvSavorySlots, anvVegetarianSlots),
            "DAV" => new CustomerTemplateProfile("DAV", "THỰC ĐƠN DAV", davSavorySlots, davVegetarianSlots),
            _ => new CustomerTemplateProfile(normalized, $"THỰC ĐƠN {normalized}", davSavorySlots, davVegetarianSlots)
        };
    }

    private static string BuildContentTypesXml()
    {
        var worksheetOverrides = string.Concat(Enumerable.Range(1, PriceTiers.Length)
            .Select(index => FormattableString.Invariant($"""
                <Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                """)));

        return $$"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
              <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
              {{worksheetOverrides}}
            </Types>
            """;
    }

    private static string BuildWorkbookXml(CustomerTemplateProfile profile)
    {
        var sheets = string.Concat(PriceTiers.Select((priceTier, index) => FormattableString.Invariant($"""
            <sheet name="{Escape(BuildSheetName(profile.CustomerCode, priceTier))}" sheetId="{index + 1}" r:id="rId{index + 1}"/>
            """)));

        return $$"""
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                {{sheets}}
              </sheets>
            </workbook>
            """;
    }

    private static string BuildWorkbookRelationshipsXml()
    {
        var worksheetRelationships = string.Concat(Enumerable.Range(1, PriceTiers.Length)
            .Select(index => FormattableString.Invariant($"""
                <Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>
                """)));

        return $$"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              {{worksheetRelationships}}
              <Relationship Id="rId{{PriceTiers.Length + 1}}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
            </Relationships>
            """;
    }

    private static string BuildStylesXml()
        => """
            <?xml version="1.0" encoding="UTF-8"?>
            <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <fonts count="7">
                <font><sz val="12"/><name val="Times New Roman"/></font>
                <font><b/><sz val="14"/><name val="Times New Roman"/></font>
                <font><b/><sz val="28"/><name val="Times New Roman"/></font>
                <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Times New Roman"/></font>
                <font><b/><sz val="14"/><name val="Times New Roman"/></font>
                <font><sz val="12"/><name val="Times New Roman"/></font>
                <font><b/><i/><sz val="10"/><name val="Times New Roman"/></font>
              </fonts>
              <fills count="6">
                <fill><patternFill patternType="none"/></fill>
                <fill><patternFill patternType="gray125"/></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FF76933C"/><bgColor indexed="64"/></patternFill></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/><bgColor indexed="64"/></patternFill></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FFE4DFEC"/><bgColor indexed="64"/></patternFill></fill>
                <fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>
              </fills>
              <borders count="2">
                <border><left/><right/><top/><bottom/><diagonal/></border>
                <border>
                  <left style="thin"><color rgb="FF000000"/></left>
                  <right style="thin"><color rgb="FF000000"/></right>
                  <top style="thin"><color rgb="FF000000"/></top>
                  <bottom style="thin"><color rgb="FF000000"/></bottom>
                  <diagonal/>
                </border>
              </borders>
              <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
              <cellXfs count="10">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                <xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
                <xf numFmtId="0" fontId="3" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
                <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
              </cellXfs>
              <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
              <dxfs count="0"/>
              <tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
            </styleSheet>
            """;

    private static string BuildSheetXml(CustomerTemplateProfile profile, decimal priceTier, DateOnly weekStartDate)
    {
        var builder = new StringBuilder();
        var mergedRanges = new List<string> { "C2:I3", "C4:I4" };
        builder.AppendLine("""<?xml version="1.0" encoding="UTF-8"?>""");
        builder.AppendLine("""<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">""");
        builder.AppendLine("""  <dimension ref="A1:I35"/>""");
        builder.AppendLine("""
          <sheetViews>
            <sheetView workbookViewId="0" zoomScale="55" zoomScaleNormal="55">
              <pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/>
            </sheetView>
          </sheetViews>
          <sheetFormatPr defaultRowHeight="19.5"/>
          <cols>
            <col min="1" max="1" width="2.875" customWidth="1"/>
            <col min="2" max="2" width="13" customWidth="1"/>
            <col min="3" max="3" width="22.125" customWidth="1"/>
            <col min="4" max="4" width="35" customWidth="1"/>
            <col min="5" max="5" width="38.25" customWidth="1"/>
            <col min="6" max="6" width="35" customWidth="1"/>
            <col min="7" max="7" width="40.5" customWidth="1"/>
            <col min="8" max="8" width="38.25" customWidth="1"/>
            <col min="9" max="9" width="41.5" customWidth="1"/>
          </cols>
          <sheetData>
        """);

        AddTextCellRow(builder, 2, "C", profile.Title, 2, height: 19.5);
        AddTextCellRow(builder, 4, "C", $"Từ ngày {weekStartDate:dd/MM/yyyy} đến ngày {weekStartDate.AddDays(5):dd/MM/yyyy}", 1, height: 19.5);
        AddDayNameRow(builder, 6);
        AddDateRow(builder, 7, weekStartDate);

        var rowNumber = 8;
        rowNumber = AddMenuSection(builder, mergedRanges, rowNumber, "MENU MẶN - CA SÁNG", profile.SavorySlots);
        rowNumber = AddMenuSection(builder, mergedRanges, rowNumber, "MENU CHAY- CA SÁNG", profile.VegetarianSlots);
        rowNumber = AddMenuSection(builder, mergedRanges, rowNumber, "MENU MẶN - CA CHIỀU", profile.SavorySlots);
        _ = AddMenuSection(builder, mergedRanges, rowNumber, "MENU CHAY- CA CHIỀU", profile.VegetarianSlots);

        builder.AppendLine("  </sheetData>");
        builder.AppendLine(CultureInfo.InvariantCulture, $"  <mergeCells count=\"{mergedRanges.Count}\">");
        foreach (var range in mergedRanges)
        {
            builder.AppendLine(CultureInfo.InvariantCulture, $"    <mergeCell ref=\"{range}\"/>");
        }

        builder.AppendLine("  </mergeCells>");
        builder.AppendLine("</worksheet>");
        return builder.ToString();
    }

    private static int AddMenuSection(
        StringBuilder builder,
        List<string> mergedRanges,
        int startRow,
        string sectionTitle,
        IReadOnlyList<string> slots)
    {
        AddSectionRow(builder, startRow, sectionTitle);
        mergedRanges.Add($"C{startRow}:I{startRow}");
        var rowNumber = startRow + 1;
        foreach (var slot in slots)
        {
            AddMenuSlotRow(builder, rowNumber, slot);
            rowNumber++;
        }

        return rowNumber;
    }

    private static void AddDayNameRow(StringBuilder builder, int rowNumber)
    {
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\" ht=\"24.75\" customHeight=\"1\">");
        AddCell(builder, "C", rowNumber, string.Empty, 3);
        for (var index = 0; index < DayLabels.Length; index++)
        {
            AddCell(builder, ColumnIndexToLetter(index + 4), rowNumber, DayLabels[index], 3);
        }

        builder.AppendLine("</row>");
    }

    private static void AddDateRow(StringBuilder builder, int rowNumber, DateOnly weekStartDate)
    {
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\" ht=\"24.75\" customHeight=\"1\">");
        AddCell(builder, "C", rowNumber, string.Empty, 3);
        for (var index = 0; index < DayLabels.Length; index++)
        {
            AddCell(builder, ColumnIndexToLetter(index + 4), rowNumber, weekStartDate.AddDays(index).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), 3);
        }

        builder.AppendLine("</row>");
    }

    private static void AddSectionRow(StringBuilder builder, int rowNumber, string title)
    {
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\" ht=\"24.75\" customHeight=\"1\">");
        AddCell(builder, "C", rowNumber, title, 4);
        builder.AppendLine("</row>");
    }

    private static void AddMenuSlotRow(StringBuilder builder, int rowNumber, string slotLabel)
    {
        var height = slotLabel.Contains("chính", StringComparison.OrdinalIgnoreCase) ? "37.5" : "24.75";
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\" ht=\"{height}\" customHeight=\"1\">");
        AddCell(builder, "C", rowNumber, slotLabel, 5);
        for (var column = 4; column <= 9; column++)
        {
            AddCell(builder, ColumnIndexToLetter(column), rowNumber, string.Empty, 6);
        }

        builder.AppendLine("</row>");
    }

    private static void AddTextCellRow(
        StringBuilder builder,
        int rowNumber,
        string column,
        string value,
        int styleIndex,
        double? height = null)
    {
        var heightAttribute = height.HasValue
            ? FormattableString.Invariant($" ht=\"{height.Value}\" customHeight=\"1\"")
            : string.Empty;
        builder.Append(CultureInfo.InvariantCulture, $"    <row r=\"{rowNumber}\"{heightAttribute}>");
        AddCell(builder, column, rowNumber, value, styleIndex);
        builder.AppendLine("</row>");
    }

    private static void AddCell(StringBuilder builder, string column, int rowNumber, string value, int styleIndex)
    {
        var style = styleIndex > 0 ? $" s=\"{styleIndex}\"" : string.Empty;
        builder.Append(CultureInfo.InvariantCulture, $"<c r=\"{column}{rowNumber}\" t=\"inlineStr\"{style}><is><t>{Escape(value)}</t></is></c>");
    }

    private static string FormatPriceTier(decimal priceTier)
        => $"{priceTier / 1000m:0}k";

    private static string BuildSheetName(string customerCode, decimal priceTier)
    {
        var name = $"{customerCode} {FormatPriceTier(priceTier)}";
        return name.Length <= 31 ? name : name[..31];
    }

    private static string NormalizeCustomerCode(string? customerCode)
    {
        var normalized = new string((customerCode ?? "IPC")
            .Trim()
            .ToUpperInvariant()
            .Where(character => char.IsLetterOrDigit(character) || character is '-' or '_')
            .ToArray());
        return string.IsNullOrWhiteSpace(normalized) ? "IPC" : normalized;
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
