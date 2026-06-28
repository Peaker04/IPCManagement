using System.Globalization;
using System.IO.Compression;
using System.Xml.Linq;

namespace IPCManagement.Api.Services.SampleData;

internal sealed class XlsxWorkbookReader
{
    private static readonly XNamespace SpreadsheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace RelationshipNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRelationshipNs = "http://schemas.openxmlformats.org/package/2006/relationships";

    public IReadOnlyList<IReadOnlyDictionary<string, string>> ReadTable(
        string workbookPath,
        string sheetName,
        IReadOnlyCollection<string> requiredHeaders,
        int? maxRows = null)
    {
        using var archive = ZipFile.OpenRead(workbookPath);
        var sharedStrings = ReadSharedStrings(archive);
        var sheetPath = ResolveSheetPath(archive, sheetName);
        var sheetEntry = archive.GetEntry(sheetPath)
            ?? throw new InvalidOperationException($"Không tìm thấy sheet '{sheetName}' trong workbook.");

        using var sheetStream = sheetEntry.Open();
        var document = XDocument.Load(sheetStream);
        var rawRows = document
            .Descendants(SpreadsheetNs + "row")
            .Select((row, index) => ReadRow(row, sharedStrings, index + 1))
            .ToList();
        ApplyMergedCellValues(rawRows, document);
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
    {
        using var archive = ZipFile.OpenRead(workbookPath);
        var sharedStrings = ReadSharedStrings(archive);
        var sheetPath = ResolveSheetPath(archive, sheetName);
        var sheetEntry = archive.GetEntry(sheetPath)
            ?? throw new InvalidOperationException($"Không tìm thấy sheet '{sheetName}' trong workbook.");

        using var sheetStream = sheetEntry.Open();
        var document = XDocument.Load(sheetStream);
        var rawRows = document
            .Descendants(SpreadsheetNs + "row")
            .Select((row, index) => ReadRow(row, sharedStrings, index + 1))
            .ToList();
        ApplyMergedCellValues(rawRows, document);
        var rows = rawRows
            .Select(row => row.Cells)
            .Where(row => row.Count > 0);

        if (maxRows is not null)
        {
            rows = rows.Take(maxRows.Value);
        }

        return rows
            .Select(row => (IReadOnlyDictionary<string, string>)row)
            .ToList();
    }

    public IReadOnlyList<string> GetSheetNames(string workbookPath)
    {
        using var archive = ZipFile.OpenRead(workbookPath);
        var workbookEntry = archive.GetEntry("xl/workbook.xml")
            ?? throw new InvalidOperationException("Workbook không có xl/workbook.xml.");

        using var workbookStream = workbookEntry.Open();
        var workbook = XDocument.Load(workbookStream);
        return workbook
            .Descendants(SpreadsheetNs + "sheet")
            .Select(item => item.Attribute("name")?.Value)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Select(name => name!)
            .ToList();
    }

    private static List<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null)
        {
            return [];
        }

        using var stream = entry.Open();
        var document = XDocument.Load(stream);
        return document
            .Descendants(SpreadsheetNs + "si")
            .Select(item => string.Concat(item.Descendants(SpreadsheetNs + "t").Select(text => text.Value)))
            .ToList();
    }

    private static string ResolveSheetPath(ZipArchive archive, string sheetName)
    {
        var workbookEntry = archive.GetEntry("xl/workbook.xml")
            ?? throw new InvalidOperationException("Workbook không có xl/workbook.xml.");
        var relsEntry = archive.GetEntry("xl/_rels/workbook.xml.rels")
            ?? throw new InvalidOperationException("Workbook không có xl/_rels/workbook.xml.rels.");

        using var workbookStream = workbookEntry.Open();
        using var relsStream = relsEntry.Open();
        var workbook = XDocument.Load(workbookStream);
        var rels = XDocument.Load(relsStream);

        var sheet = workbook
            .Descendants(SpreadsheetNs + "sheet")
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

    private static RawXlsxRow ReadRow(XElement row, IReadOnlyList<string> sharedStrings, int fallbackRowNumber)
    {
        var cells = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var rowNumber = ParseRowNumber(row.Attribute("r")?.Value, fallbackRowNumber);
        foreach (var cell in row.Elements(SpreadsheetNs + "c"))
        {
            var reference = cell.Attribute("r")?.Value;
            if (string.IsNullOrWhiteSpace(reference))
            {
                continue;
            }

            var column = new string(reference.TakeWhile(char.IsLetter).ToArray());
            if (string.IsNullOrWhiteSpace(column))
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
        XDocument document)
    {
        var rowsByNumber = rows.ToDictionary(row => row.RowNumber);
        foreach (var mergeRange in document.Descendants(SpreadsheetNs + "mergeCell"))
        {
            var reference = mergeRange.Attribute("ref")?.Value;
            if (!TryParseCellRange(reference, out var start, out var end))
            {
                continue;
            }

            if (!rowsByNumber.TryGetValue(start.Row, out var sourceRow) ||
                !sourceRow.Cells.TryGetValue(start.Column, out var sourceValue) ||
                string.IsNullOrWhiteSpace(sourceValue))
            {
                continue;
            }

            var startColumn = ColumnLetterToIndex(start.Column);
            var endColumn = ColumnLetterToIndex(end.Column);
            for (var rowNumber = start.Row; rowNumber <= end.Row; rowNumber++)
            {
                if (!rowsByNumber.TryGetValue(rowNumber, out var targetRow))
                {
                    continue;
                }

                for (var columnIndex = startColumn; columnIndex <= endColumn; columnIndex++)
                {
                    var column = ColumnIndexToLetter(columnIndex);
                    if (!targetRow.Cells.TryGetValue(column, out var currentValue) ||
                        string.IsNullOrWhiteSpace(currentValue))
                    {
                        targetRow.Cells[column] = sourceValue;
                    }
                }
            }
        }
    }

    private static bool TryParseCellRange(
        string? reference,
        out CellAddress start,
        out CellAddress end)
    {
        start = default;
        end = default;
        if (string.IsNullOrWhiteSpace(reference))
        {
            return false;
        }

        var parts = reference.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 1)
        {
            return TryParseCellAddress(parts[0], out start) && TryParseCellAddress(parts[0], out end);
        }

        return parts.Length == 2 &&
               TryParseCellAddress(parts[0], out start) &&
               TryParseCellAddress(parts[1], out end);
    }

    private static bool TryParseCellAddress(string reference, out CellAddress address)
    {
        address = default;
        var column = new string(reference.TakeWhile(char.IsLetter).ToArray()).ToUpperInvariant();
        var rowText = new string(reference.SkipWhile(char.IsLetter).TakeWhile(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(column) ||
            !int.TryParse(rowText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var row) ||
            row <= 0)
        {
            return false;
        }

        address = new CellAddress(column, row);
        return true;
    }

    private static int ParseRowNumber(string? value, int fallbackRowNumber)
        => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var rowNumber) && rowNumber > 0
            ? rowNumber
            : fallbackRowNumber;

    private static int ColumnLetterToIndex(string column)
    {
        var result = 0;
        foreach (var character in column.ToUpperInvariant())
        {
            result = (result * 26) + character - 'A' + 1;
        }

        return result;
    }

    private static string ColumnIndexToLetter(int column)
    {
        var result = string.Empty;
        while (column > 0)
        {
            column--;
            result = (char)('A' + column % 26) + result;
            column /= 26;
        }

        return result;
    }

    private sealed record RawXlsxRow(int RowNumber, Dictionary<string, string> Cells);

    private readonly record struct CellAddress(string Column, int Row);
}
