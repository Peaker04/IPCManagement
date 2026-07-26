using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace IPCManagement.Api.Services.SampleData;

/// <summary>
/// Đọc workbook nguồn lịch sử mua hàng.
/// Mọi hạn mức chống file XLSX độc hại (zip bomb, merged-cell bomb, XXE, dimension khai khống)
/// dùng chung với <see cref="XlsxWorkbookReader"/> qua <see cref="XlsxSecurityLimits"/> —
/// không còn hai bản sao của thuật toán lan giá trị vùng gộp ô như trước.
/// </summary>
internal sealed class PurchaseHistorySourceParser
{
    /// <summary>Nhãn dùng trong thông báo lỗi khi từ chối nguồn quá cỡ.</summary>
    private const string SourceLabel = "File nguồn lịch sử mua hàng";

    private static readonly XNamespace SpreadsheetNs = XlsxSecurityLimits.SpreadsheetNs;
    private static readonly XNamespace RelationshipNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRelationshipNs = "http://schemas.openxmlformats.org/package/2006/relationships";

    private static readonly string[] RequiredHeaders =
    [
        "Ngày Giao hàng",
        "Tên hàng",
        "Đơn vị tính",
        "Số lượng",
        "Đơn giá"
    ];

    private readonly PurchaseHistoryNormalizationPolicy _normalizationPolicy;

    public PurchaseHistorySourceParser(PurchaseHistoryNormalizationPolicy? normalizationPolicy = null)
    {
        _normalizationPolicy = normalizationPolicy ?? new PurchaseHistoryNormalizationPolicy([]);
    }

    public PurchaseHistoryParseResult Parse(Stream source, DateOnly asOfDate, int? maxRowsPerSheet = null)
    {
        ArgumentNullException.ThrowIfNull(source);
        if (!source.CanRead)
        {
            throw new ArgumentException("Workbook stream must be readable.", nameof(source));
        }

        // Trần dung lượng đặt ngay tại đây: trước kia CopyToMemory nạp không giới hạn nên một
        // stream vài GB làm phình MemoryStream tới khi OutOfMemory.
        using var workbook = XlsxSecurityLimits.CopyToBoundedMemory(source, SourceLabel);
        var workbookSha256 = Convert.ToHexString(SHA256.HashData(workbook));
        workbook.Position = 0;

        using var archive = new ZipArchive(workbook, ZipArchiveMode.Read, leaveOpen: true);
        XlsxSecurityLimits.EnsurePackageWithinLimits(archive);
        var sharedStrings = ReadSharedStrings(archive);
        var sheets = ReadSheets(archive);
        var supplierPolicies = ReadSupplierPolicies(archive, sheets, sharedStrings);
        var normalizationPolicy = _normalizationPolicy.WithCanonicalSuppliers(
            supplierPolicies.Values.Append("Vịt a Việt"));
        var candidates = new List<PurchaseHistorySourceCandidate>();
        var recognizedDataSheetCount = 0;

        foreach (var sheet in sheets)
        {
            if (string.Equals(sheet.Name, "SUMMARY", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(sheet.Name, "NGUỒN", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var rows = ReadRows(archive, sheet, sharedStrings);
            var headerIndex = rows.FindIndex(row => RequiredHeaders.All(header =>
                row.Cells.Values.Any(value => string.Equals(value.Trim(), header, StringComparison.OrdinalIgnoreCase))));
            if (headerIndex < 0)
            {
                continue;
            }

            recognizedDataSheetCount++;
            var headersByColumn = rows[headerIndex].Cells
                .Where(cell => !string.IsNullOrWhiteSpace(cell.Value))
                .ToDictionary(cell => cell.Key, cell => cell.Value.Trim(), StringComparer.OrdinalIgnoreCase);
            var supplierName = ResolveSupplierName(sheet.Name, supplierPolicies);
            var mappedRows = 0;

            foreach (var row in rows.Skip(headerIndex + 1))
            {
                if (maxRowsPerSheet is not null && mappedRows >= maxRowsPerSheet.Value)
                {
                    break;
                }

                var rawCells = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                foreach (var header in headersByColumn)
                {
                    rawCells[header.Value] = row.Cells.GetValueOrDefault(header.Key, string.Empty).Trim();
                }
                if (!HasSourceEvidence(rawCells))
                {
                    continue;
                }

                mappedRows++;
                candidates.Add(CreateCandidate(
                    workbookSha256,
                    sheet.Name,
                    row.RowNumber,
                    supplierName,
                    rawCells,
                    normalizationPolicy,
                    asOfDate));
            }
        }

        return new PurchaseHistoryParseResult(
            workbookSha256,
            asOfDate,
            sheets.Count,
            supplierPolicies.Count,
            recognizedDataSheetCount,
            candidates);
    }

    public static IReadOnlyList<PurchaseHistorySourceCandidate> Supersede(
        IReadOnlyList<PurchaseHistorySourceCandidate> legacy,
        IReadOnlyList<PurchaseHistorySourceCandidate> current)
    {
        var importable = legacy
            .Where(candidate => candidate.IsImportable)
            .Concat(current.Where(candidate => candidate.IsImportable))
            .GroupBy(candidate => candidate.BusinessKey!, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToList();
        var unresolved = legacy
            .Where(candidate => !candidate.IsImportable)
            .Concat(current.Where(candidate => !candidate.IsImportable));

        return importable
            .Concat(unresolved)
            .OrderBy(candidate => candidate.SourceKey, StringComparer.Ordinal)
            .ToList();
    }

    private static PurchaseHistorySourceCandidate CreateCandidate(
        string workbookSha256,
        string sourceSheet,
        int sourceRow,
        string supplierName,
        IReadOnlyDictionary<string, string> rawCells,
        PurchaseHistoryNormalizationPolicy normalizationPolicy,
        DateOnly asOfDate)
    {
        var rawDate = Get(rawCells, "Ngày Giao hàng");
        var rawIngredient = Get(rawCells, "Tên hàng");
        var rawUnit = Get(rawCells, "Đơn vị tính");
        var deliveryDate = ParseDate(rawDate);
        var quantity = ParseDecimal(Get(rawCells, "Số lượng"));
        var unitPrice = ParseDecimal(Get(rawCells, "Đơn giá"));
        var normalizedIngredient = NormalizeIngredientKey(rawIngredient);
        var businessKey = deliveryDate is not null && !string.IsNullOrWhiteSpace(normalizedIngredient)
            ? $"{deliveryDate:yyyy-MM-dd}|{normalizedIngredient}"
            : null;
        var rowEvidence = string.Join(
            "\n",
            rawCells.OrderBy(cell => cell.Key, StringComparer.Ordinal)
                .Select(cell => $"{cell.Key}={cell.Value}"));
        var rowHash = Hash($"{sourceSheet}|{sourceRow}|{rowEvidence}");
        var sourceKey = Hash($"{workbookSha256}|{sourceSheet}|{sourceRow}");

        var candidate = new PurchaseHistorySourceCandidate(
            workbookSha256,
            supplierName,
            rawIngredient,
            rawUnit,
            deliveryDate,
            quantity,
            unitPrice,
            sourceKey,
            businessKey,
            rowHash,
            new PurchaseHistorySourceTrace(sourceSheet, sourceRow, rawCells));
        return candidate with
        {
            Normalization = normalizationPolicy.Normalize(candidate, asOfDate)
        };
    }

    private static Dictionary<string, string> ReadSupplierPolicies(
        ZipArchive archive,
        IReadOnlyList<WorkbookSheet> sheets,
        IReadOnlyList<string> sharedStrings)
    {
        var summary = sheets.Single(sheet =>
            string.Equals(sheet.Name, "SUMMARY", StringComparison.OrdinalIgnoreCase));
        var policies = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in ReadRows(archive, summary, sharedStrings))
        {
            var sheetCode = row.Cells.GetValueOrDefault("C", string.Empty).Trim();
            var supplierName = row.Cells.GetValueOrDefault("D", string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(sheetCode) ||
                string.IsNullOrWhiteSpace(supplierName) ||
                string.Equals(sheetCode, "No.", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(supplierName, "Nhà Cung Cấp", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            policies[NormalizeSheetKey(sheetCode)] = supplierName;
        }

        return policies;
    }

    private static string ResolveSupplierName(string sheetName, IReadOnlyDictionary<string, string> policies)
    {
        if (policies.TryGetValue(NormalizeSheetKey(sheetName), out var supplierName))
        {
            return supplierName;
        }

        return Regex.Replace(sheetName.Trim(), @"^\d+\.\s*", string.Empty).Trim();
    }

    private static List<WorkbookSheet> ReadSheets(ZipArchive archive)
    {
        var workbook = LoadDocument(archive, "xl/workbook.xml");
        var relationships = LoadDocument(archive, "xl/_rels/workbook.xml.rels");

        // TryAdd thay cho ToDictionary: file khai hai Relationship trùng Id từng làm
        // ToDictionary ném ArgumentException và trả HTTP 500. File hợp lệ không đổi kết quả.
        var targetsById = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var item in relationships.Descendants(PackageRelationshipNs + "Relationship"))
        {
            var id = item.Attribute("Id")?.Value;
            var target = item.Attribute("Target")?.Value;
            if (id is null || target is null)
            {
                continue;
            }

            targetsById.TryAdd(id, NormalizeSheetPath(target));
        }

        var sheetElements = workbook.Descendants(SpreadsheetNs + "sheet").ToList();
        XlsxSecurityLimits.EnsureSheetCountWithinLimit(sheetElements.Count);

        return sheetElements
            .Select(sheet => new
            {
                Name = sheet.Attribute("name")?.Value,
                RelationshipId = sheet.Attribute(RelationshipNs + "id")?.Value
            })
            .Where(sheet => !string.IsNullOrWhiteSpace(sheet.Name) &&
                            !string.IsNullOrWhiteSpace(sheet.RelationshipId) &&
                            targetsById.ContainsKey(sheet.RelationshipId!))
            .Select(sheet => new WorkbookSheet(sheet.Name!, targetsById[sheet.RelationshipId!]))
            .ToList();
    }

    private static List<WorkbookRow> ReadRows(
        ZipArchive archive,
        WorkbookSheet sheet,
        IReadOnlyList<string> sharedStrings)
    {
        var document = LoadDocument(archive, sheet.Path);

        var rows = new List<WorkbookRow>();
        foreach (var row in document.Descendants(SpreadsheetNs + "row"))
        {
            XlsxSecurityLimits.EnsureRowCountWithinLimit(rows.Count);
            rows.Add(ReadRow(row, sharedStrings, rows.Count + 1));
        }

        // Vùng gộp ô được kiểm duyệt hạn mức MỘT lần trước khi vào vòng lặp lan giá trị.
        // Đây chính là lỗ hổng "merged-cell bomb" trước đây còn nguyên ở parser này:
        // hai vòng lặp lồng nhau chạy theo ref do file khai, nên ref="A1:XFD1048576"
        // (~17,18 tỉ ô) treo worker vô hạn.
        XlsxSecurityLimits.ApplyMergedCellValues(
            XlsxSecurityLimits.BuildRowIndex(rows.Select(item => (item.RowNumber, item.Cells))),
            XlsxSecurityLimits.ReadMergeRanges(document, sheet.Name));

        return rows;
    }

    private static WorkbookRow ReadRow(
        XElement row,
        IReadOnlyList<string> sharedStrings,
        int fallbackRowNumber)
    {
        var cells = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in row.Elements(SpreadsheetNs + "c"))
        {
            var reference = cell.Attribute("r")?.Value;
            if (string.IsNullOrWhiteSpace(reference))
            {
                continue;
            }

            // Tên cột phải hợp lệ theo đặc tả Excel (tối đa 3 chữ cái, không quá cột XFD).
            // Tên khai khống kiểu "AAAAAAAAAA" từng làm phép quy đổi cột tràn số nguyên.
            var column = new string(reference.TakeWhile(char.IsLetter).ToArray());
            if (string.IsNullOrWhiteSpace(column) || XlsxSecurityLimits.ColumnLetterToIndex(column) <= 0)
            {
                continue;
            }

            // Gán bằng indexer (ô cuối thắng) thay cho ToDictionary: file khai hai ô cùng
            // địa chỉ từng làm ToDictionary ném ArgumentException và trả HTTP 500.
            cells[column] = ReadCellValue(cell, sharedStrings);
        }

        return new WorkbookRow(
            XlsxSecurityLimits.ParseRowNumber(row.Attribute("r")?.Value, fallbackRowNumber),
            cells);
    }

    private static IReadOnlyList<string> ReadSharedStrings(ZipArchive archive)
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

    private static string ReadCellValue(XElement cell, IReadOnlyList<string> sharedStrings)
    {
        var type = cell.Attribute("t")?.Value;
        var rawValue = cell.Element(SpreadsheetNs + "v")?.Value ?? string.Empty;
        if (type == "s" &&
            int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var sharedIndex) &&
            sharedIndex >= 0 &&
            sharedIndex < sharedStrings.Count)
        {
            return sharedStrings[sharedIndex];
        }

        var value = type == "inlineStr"
            ? string.Concat(cell.Descendants(SpreadsheetNs + "t").Select(text => text.Value))
            : rawValue;

        // Chuỗi dùng chung đã chặn ở ReadSharedStrings; chốt nốt đường inlineStr và giá trị thô.
        XlsxSecurityLimits.EnsureCellTextWithinLimit(value);
        return value;
    }

    private static XDocument LoadDocument(ZipArchive archive, string path)
    {
        var entry = archive.GetEntry(path)
            ?? throw new InvalidOperationException($"Workbook is missing '{path}'.");

        return XlsxSecurityLimits.LoadXmlPart(entry, $"Thành phần '{path}'");
    }

    private static bool HasSourceEvidence(IReadOnlyDictionary<string, string> row)
        => RequiredHeaders.Any(header => !string.IsNullOrWhiteSpace(Get(row, header)));

    private static string Get(IReadOnlyDictionary<string, string> row, string key)
        => row.TryGetValue(key, out var value) ? value.Trim() : string.Empty;

    private static decimal? ParseDecimal(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().Replace(",", ".", StringComparison.Ordinal);
        return decimal.TryParse(
            normalized,
            NumberStyles.Number | NumberStyles.AllowExponent,
            CultureInfo.InvariantCulture,
            out var parsed)
            ? parsed
            : null;
    }

    private static DateOnly? ParseDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (double.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial) &&
            serial > 30000 &&
            serial < 60000)
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out var parsed) ||
            DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed))
        {
            return DateOnly.FromDateTime(parsed);
        }

        var match = Regex.Match(value, @"(\d{1,2})/(\d{1,2})/(\d{4})");
        if (match.Success)
        {
            return new DateOnly(
                int.Parse(match.Groups[3].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture),
                int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture));
        }

        return null;
    }

    private static string NormalizeIngredientKey(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string NormalizeSheetKey(string value)
        => Regex.Replace(RemoveDiacritics(value).Trim().ToUpperInvariant(), @"\s+", string.Empty);

    private static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string NormalizeSheetPath(string target)
    {
        var normalized = target.Replace('\\', '/');
        return normalized.StartsWith("xl/", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : $"xl/{normalized.TrimStart('/')}";
    }

    private static string Hash(string value)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private sealed record WorkbookSheet(string Name, string Path);
    private sealed record WorkbookRow(int RowNumber, Dictionary<string, string> Cells);
}

internal sealed record PurchaseHistorySourceCandidate(
    string WorkbookSha256,
    string SupplierName,
    string RawIngredient,
    string RawUnit,
    DateOnly? DeliveryDate,
    decimal? Quantity,
    decimal? UnitPrice,
    string SourceKey,
    string? BusinessKey,
    string RowHash,
    PurchaseHistorySourceTrace Trace)
{
    public PurchaseHistoryNormalizationResult? Normalization { get; init; }

    public bool IsImportable => DeliveryDate is not null &&
                                !string.IsNullOrWhiteSpace(RawIngredient) &&
                                Quantity > 0 &&
                                UnitPrice > 0;
}

internal sealed record PurchaseHistorySourceTrace(
    string SourceSheet,
    int SourceRow,
    IReadOnlyDictionary<string, string> RawCells);

internal sealed record PurchaseHistoryParseResult(
    string WorkbookSha256,
    DateOnly AsOfDate,
    int SheetCount,
    int SupplierPolicyCount,
    int RecognizedDataSheetCount,
    IReadOnlyList<PurchaseHistorySourceCandidate> Candidates)
{
    public IReadOnlyList<string> ImportableBusinessKeys { get; } = Candidates
        .Where(candidate => candidate.IsImportable)
        .Select(candidate => candidate.BusinessKey!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(key => key, StringComparer.OrdinalIgnoreCase)
        .ToList();
}
