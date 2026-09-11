using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using Microsoft.VisualBasic.FileIO;

namespace IPCManagement.Api.Tests;

public class AuditCsvExporterTests
{
    [Fact]
    public void Build_WritesUtf8BomAndPreservesCsvQuoting()
    {
        var bytes = AuditCsvExporter.Build([
            Row("Người \"duyệt\", ca sáng\r\nca chiều")
        ]);

        bytes.Take(Encoding.UTF8.GetPreamble().Length)
            .Should().Equal(Encoding.UTF8.GetPreamble());
        var parsed = ParseSingleDataRow(bytes);
        parsed.Should().HaveCount(16);
        parsed[2].Should().Be("Người \"duyệt\", ca sáng\r\nca chiều");
        parsed[10].Should().Be("cid-20260803");
    }

    [Fact]
    [Trait("MXE", "MRXE-F07")]
    public void Build_NeutralizesDangerousMarkersInEveryTextColumn()
    {
        var parsed = ParseSingleDataRow(AuditCsvExporter.Build([
            new AuditChangeReportDto
            {
                AuditId = "=audit",
                ChangedAt = new DateTime(2026, 7, 28, 9, 30, 0),
                ChangedByName = "+actor",
                BusinessArea = "-area",
                EntityName = "@entity",
                EntityId = " =entity-id",
                FieldName = "\t+field",
                OldValue = "-cmd",
                NewValue = "@SUM(1,2)",
                Reason = "=reason",
                CorrelationId = "+correlation",
                SourceFamily = "-family",
                MaterialRequestId = "@request",
                MaterialRequestLineId = " =request-line",
                ReconciliationBatchId = "\t+batch",
                ReconciliationBatchLineId = "-batch-line"
            }
        ]));

        parsed.Should().Equal(
            "'=audit", "2026-07-28 09:30:00", "'+actor", "'-area", "'@entity", "' =entity-id", "'\t+field", "'-cmd",
            "'@SUM(1,2)", "'=reason", "'+correlation", "'-family", "'@request", "' =request-line", "'\t+batch", "'-batch-line");
    }

    [Theory]
    [Trait("MXE", "MRXE-F07")]
    [InlineData("=1+2", "'=1+2")]
    [InlineData("+123", "'+123")]
    [InlineData("-cmd", "'-cmd")]
    [InlineData("-1+2", "'-1+2")]
    [InlineData("@SUM(A1:A2)", "'@SUM(A1:A2)")]
    [InlineData("   =1+2", "'   =1+2")]
    [InlineData("\t@cmd", "'\t@cmd")]
    [InlineData("-1", "-1")]
    [InlineData("-1.25", "-1.25")]
    [InlineData("-123.456789", "-123.456789")]
    [InlineData("-1,25", "'-1,25")]
    [InlineData("-1,234", "'-1,234")]
    [InlineData("-1e2", "'-1e2")]
    [InlineData("ordinary text", "ordinary text")]
    [InlineData("", "")]
    [InlineData("'=already safe", "'=already safe")]
    public void Build_AppliesThePublicTextCellFormulaPolicy(string value, string expected)
    {
        var parsed = ParseSingleDataRow(AuditCsvExporter.Build([Row("actor", reason: value)]));

        parsed[9].Should().Be(expected);
    }

    [Fact]
    [Trait("MXE", "MRXE-F07")]
    public void Build_LeavesNullTextCellsEmpty()
    {
        var parsed = ParseSingleDataRow(AuditCsvExporter.Build([Row("actor", reason: null)]));

        parsed[9].Should().BeEmpty();
    }

    private static AuditChangeReportDto Row(string changedByName, string? reason = "Đủ điều kiện") => new()
    {
        AuditId = "audit-1",
        ChangedAt = new DateTime(2026, 7, 28, 9, 30, 0),
        ChangedByName = changedByName,
        BusinessArea = "Purchase",
        EntityName = "PurchaseRequest",
        EntityId = "request-1",
        FieldName = "Status",
        OldValue = "DRAFT",
        NewValue = "APPROVED",
        Reason = reason,
        CorrelationId = "cid-20260803"
    };

    private static string[] ParseSingleDataRow(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var parser = new TextFieldParser(stream, Encoding.UTF8, detectEncoding: true)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
            TrimWhiteSpace = false
        };
        parser.SetDelimiters(",");
        parser.ReadFields().Should().HaveCount(16);
        return parser.ReadFields()!;
    }
}
