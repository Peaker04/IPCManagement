using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class AuditCsvExporterTests
{
    [Fact]
    public void Build_WritesUtf8BomAndEscapesQuotes()
    {
        var bytes = AuditCsvExporter.Build([
            new AuditChangeReportDto
            {
                AuditId = "audit-1",
                ChangedAt = new DateTime(2026, 7, 28, 9, 30, 0),
                ChangedByName = "Người \"duyệt\"",
                BusinessArea = "Purchase",
                EntityName = "PurchaseRequest",
                EntityId = "request-1",
                FieldName = "Status",
                OldValue = "DRAFT",
                NewValue = "APPROVED",
                Reason = "Đủ điều kiện"
            }
        ]);

        bytes.Take(Encoding.UTF8.GetPreamble().Length)
            .Should().Equal(Encoding.UTF8.GetPreamble());
        Encoding.UTF8.GetString(bytes)
            .Should().Contain("Người \"\"duyệt\"\"");
    }
}
