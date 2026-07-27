using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Application.Tests;

/// <summary>
/// Kiểm chứng các chốt chặn file XLSX độc hại của <see cref="XlsxWorkbookReader"/> (P1.8).
/// Nguyên tắc: file độc hại phải bị từ chối bằng <see cref="BusinessRuleException"/> (→ HTTP 400)
/// trong thời gian hữu hạn, còn file hợp lệ phải parse ra kết quả y hệt trước khi vá.
/// Mỗi test dựng một workbook tối thiểu trong thư mục tạm rồi xóa sau khi chạy.
/// </summary>
public class XlsxWorkbookReaderHardeningTests
{
    /// <summary>Ngân sách thời gian chứng minh parser "từ chối" chứ không "treo".</summary>
    private static readonly TimeSpan RejectionBudget = TimeSpan.FromSeconds(5);

    private const string DefaultSheetsXml = "<sheet name=\"DATA\" sheetId=\"1\" r:id=\"rId1\"/>";

    // -----------------------------------------------------------------
    // 1. Merged-cell bomb — vector chính của P1.8
    // -----------------------------------------------------------------

    [Fact]
    public void ReadRows_Should_Reject_MergedCellBomb_CoveringWholeSheet()
    {
        // ref="A1:XFD1048576" = 16.384 x 1.048.576 ~ 17,18 tỉ ô.
        // Trước khi vá, hai vòng lặp lồng nhau trong ApplyMergedCellValues chạy vô hạn.
        RunWithWorkbook(
            BuildSheetXml("""<mergeCell ref="A1:XFD1048576"/>"""),
            path =>
            {
                var reader = new XlsxWorkbookReader();
                var stopwatch = Stopwatch.StartNew();

                var act = () => reader.ReadRows(path, "DATA");

                act.Should().Throw<BusinessRuleException>().WithMessage("*A1:XFD1048576*");
                stopwatch.Elapsed.Should().BeLessThan(
                    RejectionBudget,
                    "parser phải từ chối ngay thay vì duyệt hết 17 tỉ ô");
            });
    }

    [Fact]
    public void ReadTable_Should_Reject_MergedCellBomb_CoveringWholeSheet()
    {
        RunWithWorkbook(
            BuildSheetXml("""<mergeCell ref="A1:XFD1048576"/>"""),
            path =>
            {
                var reader = new XlsxWorkbookReader();
                var stopwatch = Stopwatch.StartNew();

                var act = () => reader.ReadTable(path, "DATA", ["Món", "Nguyên liệu"]);

                act.Should().Throw<BusinessRuleException>().WithMessage("*A1:XFD1048576*");
                stopwatch.Elapsed.Should().BeLessThan(RejectionBudget);
            });
    }

    [Theory]
    // Vùng phủ toàn bộ chiều ngang của Excel.
    [InlineData("A1:XFD10")]
    // Vùng phủ toàn bộ chiều dọc của Excel.
    [InlineData("A1:B1048576")]
    public void ReadRows_Should_Reject_OversizedSingleMergeRegion(string reference)
    {
        RunWithWorkbook(
            BuildSheetXml($"""<mergeCell ref="{reference}"/>"""),
            path =>
            {
                var reader = new XlsxWorkbookReader();
                var stopwatch = Stopwatch.StartNew();

                var act = () => reader.ReadRows(path, "DATA");

                act.Should().Throw<BusinessRuleException>().WithMessage($"*{reference}*");
                stopwatch.Elapsed.Should().BeLessThan(RejectionBudget);
            });
    }

    [Fact]
    public void ReadRows_Should_Reject_TooManyMergeRegions()
    {
        // 60.000 vùng nhỏ: từng vùng hợp lệ nhưng tổng số vùng vượt trần 50.000.
        var merges = new StringBuilder();
        for (var i = 1; i <= 60_000; i++)
        {
            merges.Append($"""<mergeCell ref="A{i}:B{i}"/>""");
        }

        RunWithWorkbook(
            BuildSheetXml(merges.ToString()),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var act = () => reader.ReadRows(path, "DATA");

                act.Should().Throw<BusinessRuleException>().WithMessage("*vùng gộp ô*");
            });
    }

    [Fact]
    public void ReadRows_Should_Reject_TotalMergedCellBudget_Overflow()
    {
        // 4.000 vùng x 64 ô = 256.000 ô merge, vượt trần 200.000 ô/sheet
        // trong khi từng vùng riêng lẻ vẫn rất nhỏ.
        var merges = new StringBuilder();
        for (var i = 0; i < 4_000; i++)
        {
            var firstRow = (i * 8) + 1;
            merges.Append($"""<mergeCell ref="A{firstRow}:H{firstRow + 7}"/>""");
        }

        RunWithWorkbook(
            BuildSheetXml(merges.ToString()),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var act = () => reader.ReadRows(path, "DATA");

                act.Should().Throw<BusinessRuleException>().WithMessage("*vùng gộp*");
            });
    }

    // -----------------------------------------------------------------
    // 2. Các vector phình dữ liệu khác trong cùng parser
    // -----------------------------------------------------------------

    [Fact]
    public void ReadRows_Should_Reject_ZipBomb_OversizedSheetPart()
    {
        // Sheet XML ~34 MB sau giải nén (nội dung lặp nên nén lại chỉ vài chục KB),
        // vượt trần 32 MB cho một part.
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbookWithOversizedSheet(tempFile, targetBytes: 34L * 1024 * 1024);

            var reader = new XlsxWorkbookReader();

            var act = () => reader.ReadRows(tempFile, "DATA");

            act.Should().Throw<BusinessRuleException>();
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
    public void GetSheetNames_Should_Reject_TooManySheets()
    {
        var sheets = new StringBuilder();
        for (var i = 1; i <= 300; i++)
        {
            sheets.Append($"""<sheet name="S{i}" sheetId="{i}" r:id="rId{i}"/>""");
        }

        RunWithWorkbook(
            BuildSheetXml(),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var act = () => reader.GetSheetNames(path);

                act.Should().Throw<BusinessRuleException>().WithMessage("*sheet*");
            },
            sheetsXml: sheets.ToString());
    }

    [Fact]
    public void ReadRows_Should_Reject_SharedStringLongerThanExcelCellLimit()
    {
        var hugeText = new string('x', 40_000);
        var sharedStrings = $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <si><t>{hugeText}</t></si>
            </sst>
            """;

        RunWithWorkbook(
            BuildSheetXml(),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var act = () => reader.ReadRows(path, "DATA");

                act.Should().Throw<BusinessRuleException>().WithMessage("*ký tự*");
            },
            sharedStringsXml: sharedStrings);
    }

    [Fact]
    public void ReadRows_Should_Keep_InvalidDataException_ForNonXlsxPayload()
    {
        // Hồi quy có chủ đích: file không phải xlsx vẫn phải ném InvalidDataException
        // để SampleDataImportService.IsUnreadableWorkbookException quy về FILE_READ_ERROR.
        // Nếu đổi sang BusinessRuleException thì luồng báo lỗi thân thiện cho người dùng bị vỡ.
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            File.WriteAllText(tempFile, "day khong phai file excel");

            var reader = new XlsxWorkbookReader();

            var act = () => reader.ReadRows(tempFile, "DATA");

            act.Should().Throw<InvalidDataException>();
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }

    // -----------------------------------------------------------------
    // 3. Chống chặn nhầm: file hợp lệ vẫn phải parse y như cũ
    // -----------------------------------------------------------------

    [Fact]
    public void ReadRowsWithMetadata_Should_StillParse_RealisticMergedTemplate()
    {
        // Hình dạng merge giống template thực đơn tuần ANV thật đang dùng
        // (10 vùng, vùng lớn nhất 14 ô). Giới hạn mới không được chặn nhầm file này.
        var merges = new StringBuilder();
        merges.Append("""<mergeCell ref="B2:H2"/>""");
        merges.Append("""<mergeCell ref="B3:C4"/>""");

        RunWithWorkbook(
            BuildSheetXml(merges.ToString()),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var rows = reader.ReadRowsWithMetadata(path, "DATA");

                rows.Should().NotBeEmpty();

                // Giá trị ô neo B2 lan sang toàn vùng gộp B2:H2 (trừ ô đã có dữ liệu).
                var headerRow = rows.Single(row => row.RowNumber == 2);
                headerRow.Cells["C"].Should().Be("Nguyên liệu", "ô đã có dữ liệu không bị ghi đè");
                headerRow.Cells["H"].Should().Be("Món");
                headerRow.MergeInfo.Should().ContainKey("H");
                headerRow.MergeInfo["H"].StartRow.Should().Be(2);
                headerRow.MergeInfo["H"].StartColumn.Should().Be("B");
                headerRow.MergeInfo["H"].ColumnSpan.Should().Be(7);
                headerRow.MergeInfo["H"].RowSpan.Should().Be(1);
                headerRow.MergeInfo["H"].IsStart.Should().BeFalse();
                headerRow.MergeInfo["B"].IsStart.Should().BeTrue();

                // Vùng gộp dọc B3:C4 chép giá trị neo xuống dòng 4.
                var continuationRow = rows.Single(row => row.RowNumber == 4);
                continuationRow.Cells["B"].Should().Be("Bún mọc");
                continuationRow.MergeInfo["B"].RowSpan.Should().Be(2);
                continuationRow.MergeInfo["B"].IsStart.Should().BeFalse();
            });
    }

    [Fact]
    public void ReadTable_Should_StillMapRows_ForValidWorkbook()
    {
        RunWithWorkbook(
            BuildSheetXml(),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var rows = reader.ReadTable(path, "DATA", ["Món", "Nguyên liệu"]);

                rows.Should().HaveCount(3);
                rows[0]["Món"].Should().Be("Bún mọc");
                rows[0]["Nguyên liệu"].Should().Be("Heo đùi mông");
                rows[1]["Món"].Should().BeEmpty();
                rows[1]["Nguyên liệu"].Should().Be("Gà ta");
                rows[2]["Món"].Should().Be("Cơm gà");
                rows[2]["Nguyên liệu"].Should().Be("Gà ta");
            });
    }

    [Fact]
    public void ReadRows_Should_Ignore_MergeRangeWithInvalidColumnName()
    {
        // Tên cột 10 chữ cái làm tràn số nguyên trong phép quy đổi cột trước khi vá.
        RunWithWorkbook(
            BuildSheetXml("""<mergeCell ref="AAAAAAAAAA1:AAAAAAAAAA9"/>"""),
            path =>
            {
                var reader = new XlsxWorkbookReader();

                var rows = reader.ReadRows(path, "DATA");

                rows.Should().NotBeEmpty("vùng gộp không hợp lệ bị bỏ qua, không làm hỏng cả file");
            });
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private static void RunWithWorkbook(
        string sheetXml,
        Action<string> assert,
        string? sharedStringsXml = null,
        string? sheetsXml = null)
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            using (var archive = ZipFile.Open(tempFile, ZipArchiveMode.Create))
            {
                AddPackageParts(archive, sharedStringsXml, sheetsXml);
                AddEntry(archive, "xl/worksheets/sheet1.xml", sheetXml);
            }

            assert(tempFile);
        }
        finally
        {
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }

    private static void CreateWorkbookWithOversizedSheet(string path, long targetBytes)
    {
        using var archive = ZipFile.Open(path, ZipArchiveMode.Create);
        AddPackageParts(archive, sharedStringsXml: null, sheetsXml: null);

        var entry = archive.CreateEntry("xl/worksheets/sheet1.xml", CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        writer.Write("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");

        const string filler = "<row r=\"9\"><c r=\"A9\" t=\"inlineStr\"><is><t>0000000000000000000000000000000000000000</t></is></c></row>";
        long written = 0;
        while (written < targetBytes)
        {
            writer.Write(filler);
            written += filler.Length;
        }

        writer.Write("</sheetData></worksheet>");
    }

    private static void AddPackageParts(ZipArchive archive, string? sharedStringsXml, string? sheetsXml)
    {
        AddEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
            </Types>
            """);

        AddEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);

        var sheets = sheetsXml ?? DefaultSheetsXml;
        AddEntry(archive, "xl/workbook.xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>{sheets}</sheets>
            </workbook>
            """);

        AddEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            </Relationships>
            """);

        AddEntry(archive, "xl/sharedStrings.xml", sharedStringsXml ?? """
            <?xml version="1.0" encoding="UTF-8"?>
            <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <si><t>Món</t></si>
              <si><t>Nguyên liệu</t></si>
              <si><t>Bún mọc</t></si>
              <si><t>Heo đùi mông</t></si>
              <si><t>Cơm gà</t></si>
              <si><t>Gà ta</t></si>
            </sst>
            """);
    }

    /// <summary>
    /// Sheet mẫu 4 dòng: dòng 2 là header, dòng 3-5 là dữ liệu.
    /// Dòng 4 cố tình thiếu ô cột B để kiểm chứng hành vi lan giá trị của vùng gộp.
    /// </summary>
    private static string BuildSheetXml(string mergeCells = "")
    {
        var mergeSection = string.IsNullOrEmpty(mergeCells)
            ? string.Empty
            : $"<mergeCells>{mergeCells}</mergeCells>";

        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                <row r="2">
                  <c r="B2" t="s"><v>0</v></c>
                  <c r="C2" t="s"><v>1</v></c>
                </row>
                <row r="3">
                  <c r="B3" t="s"><v>2</v></c>
                  <c r="C3" t="s"><v>3</v></c>
                </row>
                <row r="4">
                  <c r="C4" t="s"><v>5</v></c>
                </row>
                <row r="5">
                  <c r="B5" t="s"><v>4</v></c>
                  <c r="C5" t="s"><v>5</v></c>
                </row>
              </sheetData>
              {mergeSection}
            </worksheet>
            """;
    }

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }
}
