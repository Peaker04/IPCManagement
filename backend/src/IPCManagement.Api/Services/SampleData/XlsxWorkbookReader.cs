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
        var rows = document
            .Descendants(SpreadsheetNs + "row")
            .Select(row => ReadRow(row, sharedStrings))
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
        var rows = document
            .Descendants(SpreadsheetNs + "row")
            .Select(row => ReadRow(row, sharedStrings))
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

    private static Dictionary<string, string> ReadRow(XElement row, IReadOnlyList<string> sharedStrings)
    {
        var cells = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
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

        return cells;
    }
}
