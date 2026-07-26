using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Xml;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Application.Tests;

/// <summary>
/// Kiểm chứng các chốt chặn file XLSX độc hại của <see cref="PurchaseHistorySourceParser"/> (P1.8 — lane F).
///
/// <para>
/// Bối cảnh: bản vá trước chỉ đóng lỗ hổng ở <see cref="XlsxWorkbookReader"/>, trong khi parser này
/// giữ một bản sao gần như y hệt của thuật toán lan giá trị vùng gộp ô — nghĩa là "merged-cell bomb"
/// vẫn còn nguyên ở đây. Sau khi gom về <see cref="XlsxSecurityLimits"/>, cả hai parser dùng chung
/// một bộ hạn mức; bộ test này chứng minh chốt chặn thật sự có hiệu lực trên đường thứ hai.
/// </para>
///
/// <para>
/// Nguyên tắc: file độc hại bị từ chối bằng <see cref="BusinessRuleException"/> (→ HTTP 400) trong
/// thời gian hữu hạn; file hợp lệ vẫn parse ra kết quả nghiệp vụ y như trước.
/// Workbook được dựng thẳng trong bộ nhớ vì <c>Parse</c> nhận <see cref="Stream"/>, không cần file tạm.
/// </para>
/// </summary>
public class PurchaseHistorySourceParserHardeningTests
{
    /// <summary>Ngân sách thời gian chứng minh parser "từ chối" chứ không "treo".</summary>
    private static readonly TimeSpan RejectionBudget = TimeSpan.FromSeconds(5);

    private static readonly DateOnly AsOfDate = new(2026, 7, 20);

    // -----------------------------------------------------------------
    // 1. Merged-cell bomb — lỗ hổng chính lane F phải đóng
    // -----------------------------------------------------------------

    [Fact]
    public void Parse_Should_Reject_MergedCellBomb_CoveringWholeSheet()
    {
        // ref="A1:XFD1048576" = 16.384 x 1.048.576 ~ 17,18 tỉ ô.
        // Trước khi vá, hai vòng lặp lồng nhau trong ApplyMergedCellValues chạy gần như vô hạn.
        using var workbook = BuildWorkbook(
            dataSheetXml: BuildDataSheetXml("""<mergeCell ref="A1:XFD1048576"/>"""));
        var parser = new PurchaseHistorySourceParser();
        var stopwatch = Stopwatch.StartNew();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*A1:XFD1048576*");
        stopwatch.Elapsed.Should().BeLessThan(
            RejectionBudget,
            "parser phải từ chối ngay thay vì duyệt hết 17 tỉ ô");
    }

    [Fact]
    public void Parse_Should_Reject_MergedCellBomb_OnSummarySheet()
    {
        // Sheet SUMMARY được đọc trước cả vòng lặp sheet dữ liệu (ReadSupplierPolicies),
        // nên nó là một đường vào độc lập của cùng lỗ hổng.
        using var workbook = BuildWorkbook(
            summarySheetXml: BuildSummarySheetXml("""<mergeCell ref="A1:XFD1048576"/>"""));
        var parser = new PurchaseHistorySourceParser();
        var stopwatch = Stopwatch.StartNew();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*SUMMARY*");
        stopwatch.Elapsed.Should().BeLessThan(RejectionBudget);
    }

    [Theory]
    // Vùng phủ toàn bộ chiều ngang của Excel.
    [InlineData("A1:XFD10")]
    // Vùng phủ toàn bộ chiều dọc của Excel.
    [InlineData("A1:B1048576")]
    public void Parse_Should_Reject_OversizedSingleMergeRegion(string reference)
    {
        using var workbook = BuildWorkbook(
            dataSheetXml: BuildDataSheetXml($"""<mergeCell ref="{reference}"/>"""));
        var parser = new PurchaseHistorySourceParser();
        var stopwatch = Stopwatch.StartNew();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage($"*{reference}*");
        stopwatch.Elapsed.Should().BeLessThan(RejectionBudget);
    }

    [Fact]
    public void Parse_Should_Reject_TooManyMergeRegions()
    {
        // 60.000 vùng nhỏ: từng vùng hợp lệ nhưng tổng số vùng vượt trần 50.000.
        var merges = new StringBuilder();
        for (var i = 1; i <= 60_000; i++)
        {
            merges.Append($"""<mergeCell ref="A{i}:B{i}"/>""");
        }

        using var workbook = BuildWorkbook(dataSheetXml: BuildDataSheetXml(merges.ToString()));
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*vùng gộp ô*");
    }

    [Fact]
    public void Parse_Should_Reject_TotalMergedCellBudget_Overflow()
    {
        // 4.000 vùng x 64 ô = 256.000 ô merge, vượt trần 200.000 ô/sheet
        // trong khi từng vùng riêng lẻ vẫn rất nhỏ.
        var merges = new StringBuilder();
        for (var i = 0; i < 4_000; i++)
        {
            var firstRow = (i * 8) + 1;
            merges.Append($"""<mergeCell ref="A{firstRow}:H{firstRow + 7}"/>""");
        }

        using var workbook = BuildWorkbook(dataSheetXml: BuildDataSheetXml(merges.ToString()));
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*vùng gộp*");
    }

    // -----------------------------------------------------------------
    // 2. DoS bộ nhớ ở tầng stream tải lên
    // -----------------------------------------------------------------

    [Fact]
    public void Parse_Should_Reject_SeekableStreamLargerThanUploadLimit()
    {
        // Stream tự khai độ dài 11 MB > trần 10 MB: phải từ chối trước khi cấp phát byte nào.
        using var oversized = new MemoryStream(new byte[(11L * 1024 * 1024)]);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(oversized, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*10 MB*");
    }

    [Fact]
    public void Parse_Should_Reject_NonSeekableStreamLargerThanUploadLimit()
    {
        // Stream không seek được (upload chunked) không khai độ dài, nên phải chặn bằng
        // bộ đếm byte trong lúc đọc — nếu không thì MemoryStream phình tới OutOfMemory.
        using var inner = new MemoryStream(new byte[(11L * 1024 * 1024)]);
        using var oversized = new NonSeekableStream(inner);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(oversized, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*10 MB*");
    }

    // -----------------------------------------------------------------
    // 3. Các vector phình dữ liệu / XXE khác trong cùng parser
    // -----------------------------------------------------------------

    [Fact]
    public void Parse_Should_Reject_ZipBomb_OversizedSheetPart()
    {
        // Sheet XML ~34 MB sau giải nén (nội dung lặp nên nén lại chỉ vài chục KB),
        // vượt trần 32 MB cho một part. Trước khi vá, LoadDocument nạp thẳng không giới hạn.
        using var workbook = BuildWorkbook(oversizedDataSheetBytes: 34L * 1024 * 1024);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void Parse_Should_Reject_TooManyZipEntries()
    {
        using var workbook = BuildWorkbook(extraZipEntries: 1_200);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*thành phần*");
    }

    [Fact]
    public void Parse_Should_Reject_TooManySheets()
    {
        var sheets = new StringBuilder();
        for (var i = 1; i <= 300; i++)
        {
            sheets.Append($"""<sheet name="S{i}" sheetId="{i}" r:id="rId{i}"/>""");
        }

        using var workbook = BuildWorkbook(sheetsXml: sheets.ToString());
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*sheet*");
    }

    [Fact]
    public void Parse_Should_Reject_TooManyRowsInOneSheet()
    {
        var rows = new StringBuilder();
        for (var i = 0; i < 200_005; i++)
        {
            rows.Append("<row/>");
        }

        using var workbook = BuildWorkbook(
            dataSheetXml: $"""
                <?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetData>{rows}</sheetData>
                </worksheet>
                """);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*dòng*");
    }

    [Fact]
    public void Parse_Should_Reject_SharedStringLongerThanExcelCellLimit()
    {
        var hugeText = new string('x', 40_000);
        using var workbook = BuildWorkbook(sharedStringsXml: $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <si><t>{hugeText}</t></si>
            </sst>
            """);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<BusinessRuleException>().WithMessage("*ký tự*");
    }

    [Fact]
    public void Parse_Should_Reject_DtdDeclaration_ClosingXxeAndBillionLaughs()
    {
        // DtdProcessing.Prohibit chặn cả XXE (đọc file cục bộ) lẫn "billion laughs".
        // Đây là lỗi "XML hỏng" nên vẫn là XmlException — đúng quy ước lane D đã chốt,
        // để IsUnreadableWorkbookException quy về FILE_READ_ERROR thân thiện.
        using var workbook = BuildWorkbook(dataSheetXml: """
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE worksheet [ <!ENTITY xxe SYSTEM "file:///c:/windows/win.ini"> ]>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                <row r="1"><c r="A1" t="inlineStr"><is><t>&xxe;</t></is></c></row>
              </sheetData>
            </worksheet>
            """);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().Throw<XmlException>();
    }

    [Fact]
    public void Parse_Should_Keep_InvalidDataException_ForNonXlsxPayload()
    {
        // Hồi quy có chủ đích: payload không phải xlsx vẫn phải ném InvalidDataException,
        // KHÔNG được đổi thành BusinessRuleException — luồng báo lỗi thân thiện dựa vào nó.
        using var garbage = new MemoryStream(Encoding.UTF8.GetBytes("day khong phai file excel"));
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(garbage, AsOfDate);

        act.Should().Throw<InvalidDataException>();
    }

    [Fact]
    public void Parse_Should_Never_Throw_InvalidOperationException_ForSecurityViolations()
    {
        // Cạm bẫy đã biết: SampleDataImportService.CustomMenu.cs:251 bắt InvalidOperationException
        // và trả HTTP 200 kèm kết quả validation. Lỗi bảo mật mà ném nhầm loại này sẽ bị nuốt.
        using var workbook = BuildWorkbook(
            dataSheetXml: BuildDataSheetXml("""<mergeCell ref="A1:XFD1048576"/>"""));
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().NotThrow<InvalidOperationException>();
    }

    // -----------------------------------------------------------------
    // 4. Chống chặn nhầm: file nghiệp vụ hợp lệ vẫn parse y như cũ
    // -----------------------------------------------------------------

    [Fact]
    public void Parse_Should_StillMapCandidates_AndPropagateMergedAnchorValue()
    {
        // Hình dạng merge giống workbook lịch sử mua hàng thật (vùng lớn nhất 14 ô,
        // 270 vùng/sheet). Giới hạn mới không được chặn nhầm file này.
        using var workbook = BuildWorkbook(
            dataSheetXml: BuildDataSheetXml("""<mergeCell ref="B2:B3"/>"""));
        var parser = new PurchaseHistorySourceParser();

        var result = parser.Parse(workbook, AsOfDate);

        result.SheetCount.Should().Be(2);
        result.SupplierPolicyCount.Should().Be(1);
        result.RecognizedDataSheetCount.Should().Be(1);
        result.Candidates.Should().HaveCount(2);
        result.Candidates.Should().OnlyContain(candidate => candidate.SupplierName == "Rau");

        // Dòng 3 cố tình thiếu ô B; giá trị ô neo B2 phải lan xuống theo vùng gộp B2:B3.
        result.Candidates.Should().OnlyContain(candidate => candidate.RawIngredient == "Rau muống");
        result.Candidates.Should().OnlyContain(candidate => candidate.IsImportable);
        result.ImportableBusinessKeys.Should().HaveCount(2);
    }

    [Fact]
    public void Parse_Should_StillMapCandidates_WhenSheetHasNoMergeAtAll()
    {
        using var workbook = BuildWorkbook();
        var parser = new PurchaseHistorySourceParser();

        var result = parser.Parse(workbook, AsOfDate);

        result.Candidates.Should().HaveCount(2);
        result.Candidates[0].Quantity.Should().Be(10m);
        result.Candidates[0].UnitPrice.Should().Be(25_000m);
        result.Candidates[0].DeliveryDate.Should().Be(new DateOnly(2026, 7, 20));
        result.Candidates[0].RawUnit.Should().Be("KG");
    }

    [Fact]
    public void Parse_Should_Ignore_MergeRangeWithInvalidColumnName()
    {
        // Tên cột 10 chữ cái làm tràn số nguyên trong phép quy đổi cột trước khi vá.
        using var workbook = BuildWorkbook(
            dataSheetXml: BuildDataSheetXml("""<mergeCell ref="AAAAAAAAAA1:AAAAAAAAAA9"/>"""));
        var parser = new PurchaseHistorySourceParser();

        var result = parser.Parse(workbook, AsOfDate);

        result.Candidates.Should().HaveCount(
            2,
            "vùng gộp không hợp lệ bị bỏ qua, không làm hỏng cả file");
    }

    [Fact]
    public void Parse_Should_Not_Crash_On_DuplicateRowAndCellReferences()
    {
        // Trước khi vá, ToDictionary trên số dòng / tên cột trùng ném ArgumentException,
        // rơi ra ExceptionMiddleware thành HTTP 500 — một vector gây lỗi rẻ tiền.
        using var workbook = BuildWorkbook(dataSheetXml: """
            <?xml version="1.0" encoding="UTF-8"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                <row r="1">
                  <c r="A1" t="inlineStr"><is><t>Ngày Giao hàng</t></is></c>
                  <c r="B1" t="inlineStr"><is><t>Tên hàng</t></is></c>
                  <c r="C1" t="inlineStr"><is><t>Đơn vị tính</t></is></c>
                  <c r="D1" t="inlineStr"><is><t>Số lượng</t></is></c>
                  <c r="E1" t="inlineStr"><is><t>Đơn giá</t></is></c>
                </row>
                <row r="2">
                  <c r="A2" t="inlineStr"><is><t>20/07/2026</t></is></c>
                  <c r="A2" t="inlineStr"><is><t>20/07/2026</t></is></c>
                  <c r="B2" t="inlineStr"><is><t>Rau muống</t></is></c>
                </row>
                <row r="2">
                  <c r="B2" t="inlineStr"><is><t>Rau muống</t></is></c>
                </row>
              </sheetData>
            </worksheet>
            """);
        var parser = new PurchaseHistorySourceParser();

        var act = () => parser.Parse(workbook, AsOfDate);

        act.Should().NotThrow();
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// <summary>
    /// Dựng một gói xlsx tối thiểu nhưng đủ để <c>Parse</c> chạy hết đường nghiệp vụ:
    /// sheet "SUMMARY" khai chính sách nhà cung cấp + sheet dữ liệu "1.Rau" có đủ header bắt buộc.
    /// </summary>
    private static MemoryStream BuildWorkbook(
        string? dataSheetXml = null,
        string? summarySheetXml = null,
        string? sharedStringsXml = null,
        string? sheetsXml = null,
        int extraZipEntries = 0,
        long oversizedDataSheetBytes = 0)
    {
        var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
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

            var sheets = sheetsXml ??
                """<sheet name="SUMMARY" sheetId="1" r:id="rId1"/><sheet name="1.Rau" sheetId="2" r:id="rId2"/>""";
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
                  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
                </Relationships>
                """);

            AddEntry(archive, "xl/sharedStrings.xml", sharedStringsXml ?? """
                <?xml version="1.0" encoding="UTF-8"?>
                <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <si><t>Rau</t></si>
                </sst>
                """);

            AddEntry(archive, "xl/worksheets/sheet1.xml", summarySheetXml ?? BuildSummarySheetXml());

            if (oversizedDataSheetBytes > 0)
            {
                AddOversizedSheet(archive, "xl/worksheets/sheet2.xml", oversizedDataSheetBytes);
            }
            else
            {
                AddEntry(archive, "xl/worksheets/sheet2.xml", dataSheetXml ?? BuildDataSheetXml());
            }

            for (var i = 0; i < extraZipEntries; i++)
            {
                AddEntry(archive, $"xl/filler/part{i}.xml", "<r/>");
            }
        }

        buffer.Position = 0;
        return buffer;
    }

    /// <summary>Sheet SUMMARY: cột C là mã sheet, cột D là tên nhà cung cấp.</summary>
    private static string BuildSummarySheetXml(string mergeCells = "") => $"""
        <?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="C1" t="inlineStr"><is><t>No.</t></is></c>
              <c r="D1" t="inlineStr"><is><t>Nhà Cung Cấp</t></is></c>
            </row>
            <row r="2">
              <c r="C2" t="inlineStr"><is><t>1.Rau</t></is></c>
              <c r="D2" t="inlineStr"><is><t>Rau</t></is></c>
            </row>
          </sheetData>
          {WrapMerges(mergeCells)}
        </worksheet>
        """;

    /// <summary>
    /// Sheet dữ liệu: dòng 1 là header bắt buộc, dòng 2-3 là dữ liệu.
    /// Dòng 3 cố tình thiếu ô cột B để kiểm chứng hành vi lan giá trị của vùng gộp B2:B3.
    /// </summary>
    private static string BuildDataSheetXml(string mergeCells = "") => $"""
        <?xml version="1.0" encoding="UTF-8"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="inlineStr"><is><t>Ngày Giao hàng</t></is></c>
              <c r="B1" t="inlineStr"><is><t>Tên hàng</t></is></c>
              <c r="C1" t="inlineStr"><is><t>Đơn vị tính</t></is></c>
              <c r="D1" t="inlineStr"><is><t>Số lượng</t></is></c>
              <c r="E1" t="inlineStr"><is><t>Đơn giá</t></is></c>
            </row>
            <row r="2">
              <c r="A2" t="inlineStr"><is><t>20/07/2026</t></is></c>
              <c r="B2" t="inlineStr"><is><t>Rau muống</t></is></c>
              <c r="C2" t="inlineStr"><is><t>KG</t></is></c>
              <c r="D2"><v>10</v></c>
              <c r="E2"><v>25000</v></c>
            </row>
            <row r="3">
              <c r="A3" t="inlineStr"><is><t>21/07/2026</t></is></c>
              <c r="C3" t="inlineStr"><is><t>KG</t></is></c>
              <c r="D3"><v>12</v></c>
              <c r="E3"><v>27000</v></c>
            </row>
          </sheetData>
          {WrapMerges(mergeCells)}
        </worksheet>
        """;

    private static string WrapMerges(string mergeCells)
        => string.IsNullOrEmpty(mergeCells) ? string.Empty : $"<mergeCells>{mergeCells}</mergeCells>";

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    private static void AddOversizedSheet(ZipArchive archive, string path, long targetBytes)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
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

    /// <summary>Mô phỏng upload chunked: đọc được nhưng không seek được, không khai độ dài.</summary>
    private sealed class NonSeekableStream : Stream
    {
        private readonly Stream _inner;

        public NonSeekableStream(Stream inner) => _inner = inner;

        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);

        public override void Flush() => _inner.Flush();

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
