using System.IO.Compression;
using FluentAssertions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;

namespace IPCManagement.Api.Tests;

// Measure exporter latency without unrelated test collections competing for CPU.
[Collection(nameof(WorkflowGenerationPerformanceCollection))]
public sealed class MrxReportWorkbookPerformanceTests
{
    [Fact]
    public async Task MrxReportWorkbookExporter_Streams_10500_Rows_Under_2000ms_With_Valid_OpenXml_And_MultiLetter_Columns()
    {
        MrxReportWorkbookExporter.GetColumnName(0).Should().Be("A");
        MrxReportWorkbookExporter.GetColumnName(25).Should().Be("Z");
        MrxReportWorkbookExporter.GetColumnName(26).Should().Be("AA");

        var rows = Enumerable.Range(1, 10_500).Select(index => new MrxTransactionHistoryRowDto(
            index % 2 == 0 ? "INITIAL_ISSUE" : "SUPPLEMENTAL_ISSUE",
            $"DOC-{index:D6}",
            new DateOnly(2026, 10, 26),
            "00000000-0000-0000-0000-000000000001",
            "CÔNG TY CỔ PHẦN ĐẠI TÍN",
            $"ING-{index:D4}",
            $"Nguyên liệu kiểm thử hiệu năng dòng {index}",
            "kg",
            12.345678m,
            "Thủ kho kiểm thử",
            new DateTime(2026, 10, 26, 8, 30, 0, DateTimeKind.Utc),
            "Xuất kho phục vụ sản xuất"));

        var sw = System.Diagnostics.Stopwatch.StartNew();
        await using var stream = await MrxReportWorkbookExporter.TransactionsAsync(
            MrxReportWorkbookExporter.Enumerate(rows));
        sw.Stop();

        sw.ElapsedMilliseconds.Should().BeLessThan(2_000);
        stream.Length.Should().BeGreaterThan(100_000);

        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        var sheetEntry = archive.GetEntry("xl/worksheets/sheet1.xml");
        sheetEntry.Should().NotBeNull();
        using var reader = new StreamReader(sheetEntry!.Open());
        var xml = await reader.ReadToEndAsync();
        xml.Should().Contain("<row r=\"1\">");
        xml.Should().Contain("<row r=\"10501\">");
        xml.Should().Contain("<autoFilter ref=\"A1:L10501\"/>");
    }
}
