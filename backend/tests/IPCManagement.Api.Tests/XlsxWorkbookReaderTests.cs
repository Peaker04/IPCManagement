using System.IO.Compression;
using FluentAssertions;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Api.Tests;

public class XlsxWorkbookReaderTests
{
    [Fact]
    public void ReadTable_Should_MapRows_ByDetectedHeader()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateMinimalWorkbook(tempFile);

            var reader = new XlsxWorkbookReader();
            var rows = reader.ReadTable(
                tempFile,
                "DATA",
                ["Món", "Nguyên liệu chính", "Định lượng (gram) / khay"]);

            rows.Should().HaveCount(2);
            rows[0]["Món"].Should().Be("Bún mọc");
            rows[0]["Nguyên liệu chính"].Should().Be("Heo đùi mông");
            rows[0]["Định lượng (gram) / khay"].Should().Be("0.0245");
            rows[1]["Món"].Should().Be("Cơm gà");
            rows[1]["Nguyên liệu chính"].Should().Be("Gà ta");
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }

    [Fact]
    public void ReadRows_Should_ReturnColumnMappedRows_AndSheetNames()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateMinimalWorkbook(tempFile);

            var reader = new XlsxWorkbookReader();
            var sheetNames = reader.GetSheetNames(tempFile);
            var rows = reader.ReadRows(tempFile, "DATA");

            sheetNames.Should().Equal("DATA");
            rows.Should().HaveCount(4);
            rows[1]["B"].Should().Be("Món");
            rows[2]["C"].Should().Be("Heo đùi mông");
            rows[3]["D"].Should().Be("0.0300");
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }

    private static void CreateMinimalWorkbook(string path)
    {
        using var archive = ZipFile.Open(path, ZipArchiveMode.Create);
        AddEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
              <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
            </Types>
            """);
        AddEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/workbook.xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                <sheet name="DATA" sheetId="1" r:id="rId1"/>
              </sheets>
            </workbook>
            """);
        AddEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/sharedStrings.xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="11" uniqueCount="11">
              <si><t>Supplier</t></si>
              <si><t>Món</t></si>
              <si><t>Nguyên liệu chính</t></si>
              <si><t>Định lượng (gram) / khay</t></si>
              <si><t>NCC rau</t></si>
              <si><t>Bún mọc</t></si>
              <si><t>Heo đùi mông</t></si>
              <si><t>NCC thịt</t></si>
              <si><t>Cơm gà</t></si>
              <si><t>Gà ta</t></si>
              <si><t>0.0300</t></si>
            </sst>
            """);
        AddEntry(archive, "xl/worksheets/sheet1.xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                <row r="1"><c r="A1" t="s"><v>0</v></c></row>
                <row r="2">
                  <c r="A2" t="s"><v>0</v></c>
                  <c r="B2" t="s"><v>1</v></c>
                  <c r="C2" t="s"><v>2</v></c>
                  <c r="D2" t="s"><v>3</v></c>
                </row>
                <row r="3">
                  <c r="A3" t="s"><v>4</v></c>
                  <c r="B3" t="s"><v>5</v></c>
                  <c r="C3" t="s"><v>6</v></c>
                  <c r="D3"><v>0.0245</v></c>
                </row>
                <row r="4">
                  <c r="A4" t="s"><v>7</v></c>
                  <c r="B4" t="s"><v>8</v></c>
                  <c r="C4" t="s"><v>9</v></c>
                  <c r="D4" t="s"><v>10</v></c>
                </row>
              </sheetData>
            </worksheet>
            """);
    }

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open());
        writer.Write(content);
    }
}
