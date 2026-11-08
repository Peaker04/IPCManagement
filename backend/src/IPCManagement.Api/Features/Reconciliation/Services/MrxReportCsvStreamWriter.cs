using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class MrxReportCsvStreamWriter
{
    internal static async Task WriteTransactionsAsync(
        Stream destination,
        IAsyncEnumerable<MrxTransactionHistoryRowDto> rows,
        CancellationToken token = default)
    {
        await using var writer = new StreamWriter(destination, new UTF8Encoding(true), 4096, leaveOpen: true);
        await writer.WriteAsync("LoaiGiaoDich,MaChungTu,Ngay,MaLo,KhachHang,MaNguyenLieu,TenNguyenLieu,DVT,SoLuong,NguoiThucHien,ThoiGian,LyDo\r\n".AsMemory(), token);
        await foreach (var row in rows.WithCancellation(token))
        {
            var line = string.Join(',',
                Csv(MrxReportWorkbookExporter.TransactionLabel(row.TransactionType)),
                Csv(row.DocumentCode),
                row.Date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                Csv(row.BatchId),
                Csv(row.CustomerName),
                Csv(row.IngredientCode),
                Csv(row.IngredientName),
                Csv(row.UnitName),
                Number(row.Quantity),
                Csv(row.ActorName),
                row.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                Csv(row.Reason));
            await writer.WriteAsync((line + "\r\n").AsMemory(), token);
        }
        await writer.FlushAsync(token);
    }

    internal static async Task WriteAuditAsync(
        Stream destination,
        IAsyncEnumerable<MrxAuditTrailRowDto> rows,
        CancellationToken token = default)
    {
        await using var writer = new StreamWriter(destination, new UTF8Encoding(true), 4096, leaveOpen: true);
        await writer.WriteAsync("AuditId,ThoiGian,NguoiThucHien,PhanHe,ThucThe,EntityId,TruongDuLieu,GiaTriCu,GiaTriMoi,LyDo\r\n".AsMemory(), token);
        await foreach (var row in rows.WithCancellation(token))
        {
            var line = string.Join(',',
                Csv(row.AuditId),
                row.ChangedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                Csv(row.ChangedBy),
                Csv(row.BusinessArea),
                Csv(row.EntityName),
                Csv(row.EntityId),
                Csv(row.FieldName),
                Csv(row.OldValue),
                Csv(row.NewValue),
                Csv(row.Reason));
            await writer.WriteAsync((line + "\r\n").AsMemory(), token);
        }
        await writer.FlushAsync(token);
    }

    internal static string Csv(string? value)
    {
        value ??= string.Empty;
        var meaningful = value.AsSpan().TrimStart();
        if (!meaningful.IsEmpty && meaningful[0] is '=' or '+' or '-' or '@') value = "'" + value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);
}
