using System.IO.Compression;
using System.Xml.Linq;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;

namespace IPCManagement.Api.Tests;

public sealed class MrxReportWorkbookExporterTests
{
    [Fact]
    public async Task Transactions_workbook_preserves_all_streamed_rows_numeric_precision_and_literal_text()
    {
        await using var file = await MrxReportWorkbookExporter.TransactionsAsync(Rows());
        var path = file.Name;
        using (var zip = new ZipArchive(file, ZipArchiveMode.Read, leaveOpen: true))
        {
            using var entry = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
            var xml = XDocument.Load(entry);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            Assert.Equal(102, xml.Descendants(ns + "row").Count());
            Assert.Empty(xml.Descendants(ns + "f"));
            var cells = xml.Descendants(ns + "row").Skip(1).First().Elements(ns + "c").ToArray();
            Assert.Equal("inlineStr", (string?)cells[5].Attribute("t"));
            Assert.Equal("00017", cells[5].Descendants(ns + "t").Single().Value);
            Assert.Equal("=1+1", cells[4].Descendants(ns + "t").Single().Value);
            Assert.Equal("n", (string?)cells[8].Attribute("t"));
            Assert.Equal("0.123456", cells[8].Element(ns + "v")!.Value);
            Assert.Contains("Loại giao dịch", xml.ToString());
            Assert.Contains("Nhập trả kho", xml.ToString());
        }
        await file.DisposeAsync();
        Assert.False(File.Exists(path));
        await using var csv = new MemoryStream();
        await MrxReportCsvStreamWriter.WriteTransactionsAsync(csv, Rows());
        csv.Position = 0;
        using var parser = new Microsoft.VisualBasic.FileIO.TextFieldParser(csv, System.Text.Encoding.UTF8)
        { TextFieldType = Microsoft.VisualBasic.FileIO.FieldType.Delimited, HasFieldsEnclosedInQuotes = true, TrimWhiteSpace = false };
        parser.SetDelimiters(",");
        parser.ReadFields();
        Assert.Equal("'=1+1", parser.ReadFields()![4]);
    }

    [Fact]
    public async Task Cancelled_export_releases_its_stream_without_returning_a_partial_workbook()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => MrxReportWorkbookExporter.TransactionsAsync(Rows(), cancellation.Token));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Unrepresentable_cell_fails_clearly_instead_of_returning_corrupt_or_truncated_Excel(bool oversized)
    {
        var text = oversized ? new string('a', 32768) : "Nội dung\u0001không hợp lệ";
        var error = await Assert.ThrowsAsync<IPCManagement.Api.Exceptions.BusinessRuleException>(() => MrxReportWorkbookExporter.TransactionsAsync(Rows(text)));
        Assert.Contains("Excel", error.Message);
    }

    private static async IAsyncEnumerable<MrxTransactionHistoryRowDto> Rows(string customerName = "=1+1")
    {
        await Task.CompletedTask;
        for (var index = 0; index < 101; index++)
            yield return new("PHYSICAL_RETURN", $"PN-{index}", new DateOnly(2026, 9, 14), "batch", customerName, "00017", "Gạo", "kg", 0.123456m, "Thủ kho", new DateTime(2026, 9, 14), "Thừa nguyên liệu");
    }
}
