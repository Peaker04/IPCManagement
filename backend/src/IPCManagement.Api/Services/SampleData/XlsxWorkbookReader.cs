using System.Globalization;
using System.IO.Compression;
using System.Xml.Linq;

namespace IPCManagement.Api.Services.SampleData;

/// <summary>
/// Đọc workbook XLSX cho luồng import thực đơn tuần / BOM.
/// Toàn bộ hạn mức chống file độc hại (zip bomb, merged-cell bomb, XXE) và phần kiểm duyệt
/// vùng gộp ô nằm ở <see cref="XlsxSecurityLimits"/> — dùng chung với
/// <see cref="PurchaseHistorySourceParser"/> để không tồn tại hai bản vá song song lệch nhau.
/// </summary>
internal sealed class XlsxWorkbookReader
{
    private static readonly XNamespace SpreadsheetNs = XlsxSecurityLimits.SpreadsheetNs;
    private static readonly XNamespace RelationshipNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRelationshipNs = "http://schemas.openxmlformats.org/package/2006/relationships";

    public IReadOnlyList<IReadOnlyDictionary<string, string>> ReadTable(
        string workbookPath,
        string sheetName,
        IReadOnlyCollection<string> requiredHeaders,
        int? maxRows = null)
    {
        using var archive = OpenWorkbook(workbookPath);
        var sharedStrings = ReadSharedStrings(archive);
        var document = LoadSheetDocument(archive, sheetName);
        var rawRows = ReadRawRows(document, sharedStrings);
        ApplyMergedCellValues(rawRows, XlsxSecurityLimits.ReadMergeRanges(document, sheetName));
        var rows = rawRows
            .Select(row => row.Cells)
            .Where(row => row.Count > 0)
            .ToList();

        var headerIndex = rows.FindIndex(row =>
            requiredHeaders.All(header => row.Values.Any(value =>
                string.Equals(value.Trim(), header, StringComparison.OrdinalIgnoreCase))));

        if (headerIndex < 0)
        {
            throw new InvalidOperationException(
                $"Không tìm thấy header bắt buộc trong sheet '{sheetName}': {string.Join(", ", requiredHeaders)}.");
        }

        var headerRow = rows[headerIndex];
        var headersByColumn = headerRow
            .Where(item => !string.IsNullOrWhiteSpace(item.Value))
            .ToDictionary(item => item.Key, item => item.Value.Trim());

        var result = new List<IReadOnlyDictionary<string, string>>();
        foreach (var row in rows.Skip(headerIndex + 1))
        {
            if (maxRows is not null && result.Count >= maxRows.Value)
            {
                break;
            }

            var mapped = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var (column, header) in headersByColumn)
            {
                mapped[header] = row.GetValueOrDefault(column, string.Empty).Trim();
            }

            result.Add(mapped);
        }

        return result;
    }

    public IReadOnlyList<IReadOnlyDictionary<string, string>> ReadRows(
        string workbookPath,
        string sheetName,
        int? maxRows = null)
        => ReadRowsWithMetadata(workbookPath, sheetName, maxRows)
            .Select(row => (IReadOnlyDictionary<string, string>)row.Cells)
            .ToList();

    public IReadOnlyList<XlsxRowData> ReadRowsWithMetadata(
        string workbookPath,
        string sheetName,
        int? maxRows = null)
    {
        using var archive = OpenWorkbook(workbookPath);
        var sharedStrings = ReadSharedStrings(archive);
        var document = LoadSheetDocument(archive, sheetName);
        var rawRows = ReadRawRows(document, sharedStrings);
        var mergeRanges = XlsxSecurityLimits.ReadMergeRanges(document, sheetName);
        var mergeInfoByRow = BuildMergedCellInfo(mergeRanges);
        ApplyMergedCellValues(rawRows, mergeRanges);
        var rows = rawRows
            .Where(row => row.Cells.Count > 0);

        if (maxRows is not null)
        {
            rows = rows.Take(maxRows.Value);
        }

        return rows
            .Select(row => new XlsxRowData(
                row.RowNumber,
                row.Cells,
                mergeInfoByRow.TryGetValue(row.RowNumber, out var mergeInfo)
                    ? mergeInfo
                    : EmptyMergeInfo))
            .ToList();
    }

    public IReadOnlyList<string> GetSheetNames(string workbookPath)
    {
        using var archive = OpenWorkbook(workbookPath);
        var workbook = LoadPart(archive, "xl/workbook.xml", "Cấu trúc workbook (xl/workbook.xml)");
        return ReadSheetElements(workbook)
            .Select(item => item.Attribute("name")?.Value)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!)
            .ToList();
    }

    private static readonly IReadOnlyDictionary<string, XlsxMergedCellInfo> EmptyMergeInfo =
        new Dictionary<string, XlsxMergedCellInfo>(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Mở gói xlsx và kiểm tra các chỉ số cấu trúc rẻ tiền (số entry, tổng dung lượng
    /// giải nén khai báo) trước khi đụng tới bất kỳ XML nào.
    /// </summary>
    private static ZipArchive OpenWorkbook(string workbookPath)
    {
        // InvalidDataException (file không phải zip/xlsx) được giữ nguyên để
        // SampleDataImportService.IsUnreadableWorkbookException tiếp tục quy nó về
        // FILE_READ_ERROR thân thiện — đó là lỗi người dùng thường gặp, không phải tấn công.
        var archive = ZipFile.OpenRead(workbookPath);

        try
        {
            XlsxSecurityLimits.EnsurePackageWithinLimits(archive);
            return archive;
        }
        catch
        {
            archive.Dispose();
            throw;
        }
    }

    private static XDocument LoadSheetDocument(ZipArchive archive, string sheetName)
    {
        var sheetPath = ResolveSheetPath(archive, sheetName);
        var sheetEntry = archive.GetEntry(sheetPath)
            ?? throw new InvalidOperationException($"Không tìm thấy sheet '{sheetName}' trong workbook.");

        return XlsxSecurityLimits.LoadXmlPart(sheetEntry, $"Sheet '{sheetName}'");
    }

    private static XDocument LoadPart(ZipArchive archive, string entryPath, string label)
    {
        var entry = archive.GetEntry(entryPath)
            ?? throw new InvalidOperationException($"Workbook không có {entryPath}.");

        return XlsxSecurityLimits.LoadXmlPart(entry, label);
    }

    private static List<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null)
        {
            return [];
        }

        var document = XlsxSecurityLimits.LoadXmlPart(entry, "Bảng chuỗi dùng chung (xl/sharedStrings.xml)");
        var values = new List<string>();
        foreach (var item in document.Descendants(SpreadsheetNs + "si"))
        {
            XlsxSecurityLimits.EnsureSharedStringCountWithinLimit(values.Count);

            var text = string.Concat(item.Descendants(SpreadsheetNs + "t").Select(node => node.Value));
            XlsxSecurityLimits.EnsureCellTextWithinLimit(text);

            values.Add(text);
        }

        return values;
    }

    private static List<XElement> ReadSheetElements(XDocument workbook)
    {
        var sheets = workbook.Descendants(SpreadsheetNs + "sheet").ToList();
        XlsxSecurityLimits.EnsureSheetCountWithinLimit(sheets.Count);
        return sheets;
    }

    private static string ResolveSheetPath(ZipArchive archive, string sheetName)
    {
        var workbook = LoadPart(archive, "xl/workbook.xml", "Cấu trúc workbook (xl/workbook.xml)");
        var rels = LoadPart(archive, "xl/_rels/workbook.xml.rels", "Quan hệ workbook (xl/_rels/workbook.xml.rels)");

        var sheet = ReadSheetElements(workbook)
            .FirstOrDefault(item => string.Equals(
                item.Attribute("name")?.Value,
                sheetName,
                StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException($"Workbook không có sheet '{sheetName}'.");

        var relId = sheet.Attribute(RelationshipNs + "id")?.Value
            ?? throw new InvalidOperationException($"Sheet '{sheetName}' thiếu relationship id.");

        var target = rels
            .Descendants(PackageRelationshipNs + "Relationship")
            .FirstOrDefault(item => item.Attribute("Id")?.Value == relId)
            ?.Attribute("Target")
            ?.Value
            ?? throw new InvalidOperationException($"Sheet '{sheetName}' không có target path.");

        var normalized = target.Replace('\\', '/');
        return normalized.StartsWith("xl/", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"xl/{normalized.TrimStart('/')}";
    }

    private static List<RawXlsxRow> ReadRawRows(XDocument document, IReadOnlyList<string> sharedStrings)
    {
        var rows = new List<RawXlsxRow>();
        foreach (var row in document.Descendants(SpreadsheetNs + "row"))
        {
            XlsxSecurityLimits.EnsureRowCountWithinLimit(rows.Count);
            rows.Add(ReadRow(row, sharedStrings, rows.Count + 1));
        }

        return rows;
    }

    private static RawXlsxRow ReadRow(XElement row, IReadOnlyList<string> sharedStrings, int fallbackRowNumber)
    {
        var cells = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var rowNumber = XlsxSecurityLimits.ParseRowNumber(row.Attribute("r")?.Value, fallbackRowNumber);
        foreach (var cell in row.Elements(SpreadsheetNs + "c"))
        {
            var reference = cell.Attribute("r")?.Value;
            if (string.IsNullOrWhiteSpace(reference))
            {
                continue;
            }

            var column = new string(reference.TakeWhile(char.IsLetter).ToArray());
            if (string.IsNullOrWhiteSpace(column) || XlsxSecurityLimits.ColumnLetterToIndex(column) <= 0)
            {
                continue;
            }

            var type = cell.Attribute("t")?.Value;
            var rawValue = cell.Element(SpreadsheetNs + "v")?.Value ?? string.Empty;

            if (type == "s" &&
                int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var sharedIndex) &&
                sharedIndex >= 0 &&
                sharedIndex < sharedStrings.Count)
            {
                cells[column] = sharedStrings[sharedIndex];
            }
            else if (type == "inlineStr")
            {
                cells[column] = string.Concat(cell.Descendants(SpreadsheetNs + "t").Select(text => text.Value));
            }
            else
            {
                cells[column] = rawValue;
            }
        }

        return new RawXlsxRow(rowNumber, cells);
    }

    private static void ApplyMergedCellValues(
        IReadOnlyList<RawXlsxRow> rows,
        IReadOnlyList<XlsxMergeRange> mergeRanges)
        => XlsxSecurityLimits.ApplyMergedCellValues(
            XlsxSecurityLimits.BuildRowIndex(rows.Select(row => (row.RowNumber, row.Cells))),
            mergeRanges);

    /// <summary>
    /// Gom thông tin merge theo số dòng ngay từ đầu. Trước đây <c>ReadRowsWithMetadata</c>
    /// lọc lại toàn bộ bảng merge cho từng dòng (O(dòng x ô-merge)); với file nhiều merge
    /// hợp lệ thì đó cũng là một vector treo worker.
    /// </summary>
    private static Dictionary<int, IReadOnlyDictionary<string, XlsxMergedCellInfo>> BuildMergedCellInfo(
        IReadOnlyList<XlsxMergeRange> mergeRanges)
    {
        var mergeInfoByRow = new Dictionary<int, IReadOnlyDictionary<string, XlsxMergedCellInfo>>();
        foreach (var range in mergeRanges)
        {
            var anchorColumn = XlsxSecurityLimits.ColumnIndexToLetter(range.FirstColumn);
            var rowSpan = range.LastRow - range.FirstRow + 1;
            var columnSpan = range.LastColumn - range.FirstColumn + 1;

            for (var rowNumber = range.FirstRow; rowNumber <= range.LastRow; rowNumber++)
            {
                if (!mergeInfoByRow.TryGetValue(rowNumber, out var rowInfo))
                {
                    rowInfo = new Dictionary<string, XlsxMergedCellInfo>(StringComparer.OrdinalIgnoreCase);
                    mergeInfoByRow[rowNumber] = rowInfo;
                }

                var writable = (Dictionary<string, XlsxMergedCellInfo>)rowInfo;
                for (var columnIndex = range.FirstColumn; columnIndex <= range.LastColumn; columnIndex++)
                {
                    writable[XlsxSecurityLimits.ColumnIndexToLetter(columnIndex)] = new XlsxMergedCellInfo(
                        range.FirstRow,
                        anchorColumn,
                        rowSpan,
                        columnSpan,
                        rowNumber == range.FirstRow && columnIndex == range.FirstColumn);
                }
            }
        }

        return mergeInfoByRow;
    }

    private sealed record RawXlsxRow(int RowNumber, Dictionary<string, string> Cells);

    internal sealed record XlsxRowData(
        int RowNumber,
        IReadOnlyDictionary<string, string> Cells,
        IReadOnlyDictionary<string, XlsxMergedCellInfo> MergeInfo);

    internal sealed record XlsxMergedCellInfo(
        int StartRow,
        string StartColumn,
        int RowSpan,
        int ColumnSpan,
        bool IsStart);
}
