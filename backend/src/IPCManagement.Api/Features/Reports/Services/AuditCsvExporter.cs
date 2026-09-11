using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public static class AuditCsvExporter
{
    public static byte[] Build(IReadOnlyList<AuditChangeReportDto> rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Mã log,Thời gian,Người thực hiện,Mảng nghiệp vụ,Tên bảng,ID thực thể,Tên cột,Giá trị cũ,Giá trị mới,Lý do,Correlation ID,sourceFamily,MaterialRequestId,MaterialRequestLineId,ReconciliationBatchId,ReconciliationBatchLineId");

        foreach (var sourceRow in rows)
        {
            var row = AuditPrivacyProjection.Project(sourceRow);
            builder.AppendLine(
                $"\"{Escape(row.AuditId)}\",\"{row.ChangedAt:yyyy-MM-dd HH:mm:ss}\",\"{Escape(row.ChangedByName)}\",\"{Escape(row.BusinessArea)}\",\"{Escape(row.EntityName)}\",\"{Escape(row.EntityId)}\",\"{Escape(row.FieldName)}\",\"{Escape(row.OldValue)}\",\"{Escape(row.NewValue)}\",\"{Escape(row.Reason)}\",\"{Escape(row.CorrelationId)}\",\"{Escape(row.SourceFamily)}\",\"{Escape(row.MaterialRequestId)}\",\"{Escape(row.MaterialRequestLineId)}\",\"{Escape(row.ReconciliationBatchId)}\",\"{Escape(row.ReconciliationBatchLineId)}\"");
        }

        return Encoding.UTF8.GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(builder.ToString()))
            .ToArray();
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        var firstMeaningful = 0;
        while (firstMeaningful < value.Length && char.IsWhiteSpace(value[firstMeaningful]))
        {
            firstMeaningful++;
        }

        var mustNeutralize = firstMeaningful < value.Length &&
            value[firstMeaningful] is '=' or '+' or '-' or '@' &&
            !IsInvariantNegativeDecimal(value);
        var safeValue = mustNeutralize ? $"'{value}" : value;
        return safeValue.Replace("\"", "\"\"");
    }

    private static bool IsInvariantNegativeDecimal(string value)
    {
        if (value.Length < 2 || value[0] != '-')
        {
            return false;
        }

        var decimalPoint = -1;
        for (var index = 1; index < value.Length; index++)
        {
            if (value[index] == '.' && decimalPoint < 0)
            {
                decimalPoint = index;
                continue;
            }

            if (!char.IsAsciiDigit(value[index]))
            {
                return false;
            }
        }

        if (decimalPoint is 1 || decimalPoint == value.Length - 1)
        {
            return false;
        }

        return decimal.TryParse(
            value,
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture,
            out _);
    }
}
