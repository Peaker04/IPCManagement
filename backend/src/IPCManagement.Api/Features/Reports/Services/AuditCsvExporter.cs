using System.Text;
using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public static class AuditCsvExporter
{
    public static byte[] Build(IReadOnlyList<AuditChangeReportDto> rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Mã log,Thời gian,Người thực hiện,Mảng nghiệp vụ,Tên bảng,ID thực thể,Tên cột,Giá trị cũ,Giá trị mới,Lý do,Correlation ID,sourceFamily,MaterialRequestId,MaterialRequestLineId,ReconciliationBatchId,ReconciliationBatchLineId");

        foreach (var row in rows)
        {
            builder.AppendLine(
                $"\"{row.AuditId}\",\"{row.ChangedAt:yyyy-MM-dd HH:mm:ss}\",\"{Escape(row.ChangedByName)}\",\"{Escape(row.BusinessArea)}\",\"{Escape(row.EntityName)}\",\"{Escape(row.EntityId)}\",\"{Escape(row.FieldName)}\",\"{Escape(row.OldValue)}\",\"{Escape(row.NewValue)}\",\"{Escape(row.Reason)}\",\"{Escape(row.CorrelationId)}\",\"{Escape(row.SourceFamily)}\",\"{Escape(row.MaterialRequestId)}\",\"{Escape(row.MaterialRequestLineId)}\",\"{Escape(row.ReconciliationBatchId)}\",\"{Escape(row.ReconciliationBatchLineId)}\"");
        }

        return Encoding.UTF8.GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(builder.ToString()))
            .ToArray();
    }

    private static string Escape(string? value)
        => value?.Replace("\"", "\"\"") ?? string.Empty;
}
