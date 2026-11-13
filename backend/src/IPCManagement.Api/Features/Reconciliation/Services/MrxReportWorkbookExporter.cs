using System.Globalization;
using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Security;
using System.Text;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class MrxReportWorkbookExporter
{
    private const long MaxBytes = 64L * 1024 * 1024;
    internal const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    internal static Task<FileStream> TransactionsAsync(IAsyncEnumerable<MrxTransactionHistoryRowDto> rows, CancellationToken token = default)
        => WriteAsync("Lịch sử kho", ["Loại giao dịch", "Mã chứng từ", "Ngày", "Mã lô", "Khách hàng", "Mã nguyên liệu", "Tên nguyên liệu", "Đơn vị", "Số lượng", "Người thực hiện", "Thời gian", "Lý do"],
            Project(rows, row => [TransactionLabel(row.TransactionType), row.DocumentCode, row.Date, row.BatchId, row.CustomerName, row.IngredientCode, row.IngredientName, row.UnitName, row.Quantity, row.ActorName, row.CreatedAt, row.Reason], token), token);

    internal static Task<FileStream> AuditAsync(IAsyncEnumerable<MrxAuditTrailRowDto> rows, CancellationToken token = default)
        => WriteAsync("Nhật ký đối soát", ["Mã nhật ký", "Thời gian", "Người thực hiện", "Phân hệ", "Đối tượng", "Mã đối tượng", "Nội dung", "Giá trị cũ", "Giá trị mới", "Lý do"],
            Project(rows, row => [row.AuditId, row.ChangedAt, row.ChangedBy, row.BusinessArea, row.EntityName, row.EntityId, row.FieldName, row.OldValue, row.NewValue, row.Reason], token), token);

    internal static Task<FileStream> VariancesAsync(IAsyncEnumerable<MrxVarianceRegisterRowDto> rows, CancellationToken token = default)
        => WriteAsync("Sổ chênh lệch", ["Mã lô", "Khách hàng", "Ngày", "Ca", "Mã nguyên liệu", "Nguyên liệu", "Đơn vị", "Nhu cầu", "Thực xuất", "Chênh lệch", "Phân loại", "Xử lý", "Giải trình", "Người xử lý", "Thời gian", "Ghi chú phiếu"],
            Project(rows, row => [row.BatchId, row.CustomerName, row.ServiceDate, row.ShiftName, row.IngredientCode, row.IngredientName, row.CanonicalUnitName, row.RequiredQuantity, row.IssuedQuantity, row.Difference, VarianceTypeLabel(row.VarianceType), DispositionCategoryLabel(row.DispositionCategory), row.DispositionReason, row.DisposedBy, row.DisposedAt, string.Join("; ", row.IssueNotes)], token), token);

    internal static Task<FileStream> CompletedAsync(IAsyncEnumerable<MrxCompletedRegisterRowDto> rows, CancellationToken token = default)
        => WriteAsync("Lô đã hoàn tất", ["Mã lô", "Khách hàng", "Tuần bắt đầu", "Tuần kết thúc", "Người hoàn tất", "Thời gian hoàn tất", "Phiên bản", "Số nguyên liệu", "Tổng nhu cầu", "Tổng thực xuất", "Tổng chênh lệch", "Đơn vị của tổng"],
            Project(rows, row => [row.BatchId, row.CustomerName, row.WeekStartDate, row.WeekEndDate, row.CompletedBy, row.CompletedAt, row.Version, row.TotalIngredientsCount, row.QuantityUnitName is null ? null : row.TotalRequired, row.QuantityUnitName is null ? null : row.TotalIssued, row.QuantityUnitName is null ? null : row.TotalVariance, row.QuantityUnitName ?? "Xem chi tiết theo đơn vị"], token), token);

    internal static Task<FileStream> BatchAsync(IAsyncEnumerable<ReconciliationLineDto> rows, CancellationToken token = default)
        => WriteAsync("Đối soát nguyên liệu", ["Mã nguyên liệu", "Nguyên liệu", "Đơn vị", "Nhu cầu", "Thực xuất", "Xuất - nhu cầu", "Trạng thái", "Xử lý", "Giải trình"],
            Project(rows, row => [row.IngredientCode, row.IngredientName, row.CanonicalUnitName, row.RequiredQuantity, row.IssuedQuantity, row.IssuedRequiredDifference, LineStatusLabel(row.Status), DispositionCategoryLabel(row.Disposition?.Category), row.Disposition?.Reason], token), token);

    internal static async IAsyncEnumerable<T> Enumerate<T>(IEnumerable<T> rows, [EnumeratorCancellation] CancellationToken token = default)
    {
        foreach (var row in rows) { token.ThrowIfCancellationRequested(); yield return row; }
        await Task.CompletedTask;
    }

    private static async IAsyncEnumerable<object?[]> Project<T>(IAsyncEnumerable<T> rows, Func<T, object?[]> select, [EnumeratorCancellation] CancellationToken token)
    {
        await foreach (var row in rows.WithCancellation(token)) yield return select(row);
    }

    private static async Task<FileStream> WriteAsync(string name, string[] headers, IAsyncEnumerable<object?[]> rows, CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        var file = new FileStream(Path.Combine(Path.GetTempPath(), $"ipc-mrx-export-{Guid.NewGuid():N}.xlsx"), FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None, 65536, FileOptions.Asynchronous | FileOptions.DeleteOnClose);
        try
        {
            using (var zip = new ZipArchive(file, ZipArchiveMode.Create, leaveOpen: true))
            {
                Entry(zip, "[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
                Entry(zip, "_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
                Entry(zip, "xl/workbook.xml", $"<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"{name}\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
                Entry(zip, "xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
                await using var writer = new StreamWriter(zip.CreateEntry("xl/worksheets/sheet1.xml").Open(), new UTF8Encoding(false), 65536);
                await writer.WriteAsync("<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetViews><sheetView workbookViewId=\"0\"><pane xSplit=\"1\" ySplit=\"1\" topLeftCell=\"B2\" activePane=\"bottomRight\" state=\"frozen\"/></sheetView></sheetViews><sheetData>".AsMemory(), token);
                var rowBuffer = new StringBuilder(1024);
                WriteRow(rowBuffer, 1, headers.Cast<object?>().ToArray());
                await writer.WriteAsync(rowBuffer, token);
                var count = 1;
                await foreach (var row in rows.WithCancellation(token))
                {
                    if (++count > 1_048_576 || file.Position > MaxBytes)
                        throw new BusinessRuleException("Báo cáo vượt giới hạn Excel hoặc 64 MiB. Hãy thu hẹp phạm vi rồi tải lại.");
                    WriteRow(rowBuffer, count, row);
                    await writer.WriteAsync(rowBuffer, token);
                }
                var lastCol = GetColumnName(Math.Max(0, headers.Length - 1));
                await writer.WriteAsync($"</sheetData><autoFilter ref=\"A1:{lastCol}{count}\"/></worksheet>".AsMemory(), token);
            }
            if (file.Length > MaxBytes) throw new BusinessRuleException("Báo cáo vượt 64 MiB. Hãy thu hẹp phạm vi rồi tải lại.");
            file.Position = 0;
            return file;
        }
        catch { await file.DisposeAsync(); throw; }
    }

    internal static string GetColumnName(int colIndex)
    {
        if (colIndex < 26) return ((char)('A' + colIndex)).ToString();
        var chars = new Stack<char>(3);
        var current = colIndex;
        while (current >= 0)
        {
            chars.Push((char)('A' + (current % 26)));
            current = (current / 26) - 1;
        }
        return new string(chars.ToArray());
    }

    private static void WriteRow(StringBuilder xml, int index, object?[] values)
    {
        xml.Clear();
        xml.Append("<row r=\"").Append(index).Append("\">");
        for (var col = 0; col < values.Length; col++)
        {
            var value = values[col];
            var colName = GetColumnName(col);
            if (value is decimal or int or long)
            {
                xml.Append("<c r=\"").Append(colName).Append(index).Append("\" t=\"n\"><v>")
                   .Append(Convert.ToString(value, CultureInfo.InvariantCulture))
                   .Append("</v></c>");
            }
            else
            {
                var text = value switch { DateOnly date => date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture), DateTime time => time.ToString("dd/MM/yyyy HH:mm:ss", CultureInfo.InvariantCulture), _ => value?.ToString() ?? string.Empty };
                if (text.Length > 32767)
                    throw new BusinessRuleException($"Ô {colName}{index} vượt giới hạn 32767 ký tự của Excel. Hãy thu hẹp nội dung nguồn rồi tải lại.");
                try { System.Xml.XmlConvert.VerifyXmlChars(text); }
                catch (System.Xml.XmlException) { throw new BusinessRuleException($"Ô {colName}{index} chứa ký tự không được Excel hỗ trợ. Hãy kiểm tra nội dung nguồn."); }
                xml.Append("<c r=\"").Append(colName).Append(index).Append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                   .Append(SecurityElement.Escape(text))
                   .Append("</t></is></c>");
            }
        }
        xml.Append("</row>");
    }

    private static void Entry(ZipArchive zip, string path, string content)
    {
        using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false));
        writer.Write(content);
    }

    internal static string TransactionLabel(string? value) => value switch
    {
        "INITIAL_ISSUE" => "Xuất ban đầu",
        "SUPPLEMENTAL_ISSUE" => "Xuất bổ sung",
        "PHYSICAL_RETURN" => "Nhập trả kho",
        _ => value ?? string.Empty
    };

    internal static string VarianceTypeLabel(string? value) => value switch
    {
        "OVER_ISSUED" => "Xuất thừa",
        "UNDER_ISSUED" => "Xuất thiếu",
        _ => value ?? string.Empty
    };

    internal static string DispositionCategoryLabel(string? value) => value switch
    {
        "ACCEPTED_VARIANCE" => "Chấp nhận chênh lệch",
        "RETURNED_TO_WAREHOUSE" => "Đã hoàn trả kho",
        "VOLUME_ADJUSTMENT" => "Điều chỉnh định lượng",
        "COOKING_WASTE" => "Hao hụt chế biến",
        "SPOILAGE" => "Hư hỏng / Đổ bỏ",
        "OTHER" => "Khác",
        _ => value ?? string.Empty
    };

    internal static string LineStatusLabel(string? value) => value switch
    {
        "MATCHED" => "Khớp định mức",
        "NEEDS_REVIEW" => "Chờ giải trình",
        "RESOLVED" => "Đã giải trình",
        "INCOMPLETE" => "Chưa xuất đủ",
        _ => value ?? string.Empty
    };
}
