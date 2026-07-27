using System.Globalization;
using System.IO.Compression;
using System.Xml;
using System.Xml.Linq;
using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

/// <summary>
/// Nơi DUY NHẤT định nghĩa hạn mức an toàn khi đọc file XLSX, cùng các tiện ích kiểm duyệt
/// dùng chung cho mọi parser workbook của hệ thống
/// (<see cref="XlsxWorkbookReader"/> — luồng import thực đơn tuần/BOM,
/// <see cref="PurchaseHistorySourceParser"/> — luồng đối soát lịch sử mua hàng).
///
/// <para>
/// Trước đây hai parser có hai bản sao gần như y hệt của thuật toán lan giá trị vùng gộp ô,
/// nên bản vá "merged-cell bomb" chỉ đóng được một nửa bề mặt tấn công. Toàn bộ hằng số và
/// phần kiểm duyệt được gom về đây để không còn hai bản song song lệch nhau.
/// </para>
///
/// <para>
/// <b>Căn cứ ngưỡng</b> — đo lại toàn bộ workbook <c>.xlsx</c> thật của dự án (26/07/2026):
/// <list type="table">
///   <listheader><term>Chỉ số</term><description>File thật lớn nhất → ngưỡng (bội số dư)</description></listheader>
///   <item><term>Dung lượng tải lên</term><description>1,81 MB → 10 MB (5,5×)</description></item>
///   <item><term>Entry zip</term><description>110 → 1.024 (9,3×)</description></item>
///   <item><term>Tổng giải nén</term><description>12,44 MB → 128 MB (10,3×)</description></item>
///   <item><term>Part XML lớn nhất</term><description>4,19 MB → 32 MB (7,6×)</description></item>
///   <item><term>Số sheet</term><description>34 → 256 (7,5×)</description></item>
///   <item><term>Chuỗi dùng chung</term><description>1.647 → 200.000 (121×)</description></item>
///   <item><term>Ký tự một ô</term><description>100 → 32.767 (trần của đặc tả Excel)</description></item>
///   <item><term>Dòng một sheet</term><description>11.700 → 200.000 (17×)</description></item>
///   <item><term>Vùng gộp một sheet</term><description>270 → 50.000 (185×)</description></item>
///   <item><term>Ô của một vùng gộp</term><description>14 → 65.536 (4.681×)</description></item>
///   <item><term>Tổng ô gộp một sheet</term><description>1.075 → 200.000 (186×)</description></item>
/// </list>
/// File tham chiếu: <c>.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx</c> (nguồn lịch sử mua hàng,
/// 34 sheet / 11.700 dòng), <c>.docs/IPC. Định lượng 07.2026.xlsx</c>, template thực đơn tuần ANV/DAV,
/// và fixture test <c>backend/tests/IPCManagement.Api.Tests/Fixtures/*.xlsx</c>.
/// Ngưỡng chặt nhất vẫn dư 5,5× so với file nghiệp vụ lớn nhất nên không chặn nhầm đường sống
/// nghiệp vụ, nhưng chặn được file khai <c>ref="A1:XFD1048576"</c> (~17,18 tỉ ô) vốn treo worker vô hạn.
/// </para>
///
/// <para>
/// <b>Quy ước ngoại lệ</b>: vi phạm hạn mức ném <see cref="BusinessRuleException"/> (→ HTTP 400).
/// Tuyệt đối KHÔNG ném <see cref="InvalidOperationException"/> cho lỗi bảo mật vì
/// <c>SampleDataImportService.CustomMenu.cs:251</c> nuốt nó thành HTTP 200 kèm kết quả validation.
/// <see cref="InvalidDataException"/> và <see cref="XmlException"/> được giữ nguyên cho lỗi
/// "file không phải xlsx / XML hỏng" để <c>IsUnreadableWorkbookException</c> tiếp tục quy về
/// <c>FILE_READ_ERROR</c> thân thiện.
/// </para>
/// </summary>
internal static class XlsxSecurityLimits
{
    internal static readonly XNamespace SpreadsheetNs =
        "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

    /// <summary>
    /// Hạn mức dung lượng cho mọi file Excel tải lên (dùng cho <c>[RequestSizeLimit]</c> ở tầng
    /// controller và cho hàng rào đọc stream ở tầng service). Thật: 1,81 MB.
    /// </summary>
    internal const long MaxUploadBytes = 10L * 1024 * 1024;

    /// <summary>Số dòng tối đa của một sheet theo đặc tả Excel.</summary>
    internal const int ExcelMaxRowNumber = 1_048_576;

    /// <summary>Chỉ số cột tối đa theo đặc tả Excel (cột XFD).</summary>
    internal const int ExcelMaxColumnIndex = 16_384;

    /// <summary>Số ký tự chữ cái tối đa của một tên cột hợp lệ ("XFD").</summary>
    internal const int MaxColumnLetterLength = 3;

    /// <summary>Số ký tự tối đa của một ô theo đặc tả Excel (thật: tối đa 100).</summary>
    internal const int MaxCellCharacters = 32_767;

    /// <summary>Số entry tối đa trong gói zip (thật: 110).</summary>
    internal const int MaxZipEntries = 1_024;

    /// <summary>Dung lượng giải nén tối đa của một part XML (thật: 4,19 MB).</summary>
    internal const long MaxUncompressedPartBytes = 32L * 1024 * 1024;

    /// <summary>Tổng dung lượng giải nén tối đa của cả workbook (thật: 12,44 MB).</summary>
    internal const long MaxTotalUncompressedBytes = 128L * 1024 * 1024;

    /// <summary>Số sheet tối đa (thật: 34).</summary>
    internal const int MaxSheetCount = 256;

    /// <summary>Số chuỗi dùng chung tối đa (thật: 1.647).</summary>
    internal const int MaxSharedStringCount = 200_000;

    /// <summary>Số dòng tối đa đọc từ một sheet (thật: 11.700).</summary>
    internal const int MaxRowsPerSheet = 200_000;

    /// <summary>Số vùng gộp ô tối đa của một sheet (thật: 270).</summary>
    internal const int MaxMergeRegions = 50_000;

    /// <summary>Số ô tối đa của MỘT vùng gộp (thật: 14).</summary>
    internal const long MaxCellsPerMergeRegion = 65_536;

    /// <summary>Tổng số ô bị phủ bởi mọi vùng gộp trong một sheet (thật: 1.075).</summary>
    internal const long MaxMergedCellsPerSheet = 200_000;

    // =====================================================================
    // 1. Hàng rào ở tầng gói (zip) và tầng stream tải lên
    // =====================================================================

    /// <summary>
    /// Kiểm tra các chỉ số cấu trúc rẻ tiền (số entry, tổng dung lượng giải nén khai báo)
    /// trước khi đụng tới bất kỳ XML nào.
    /// </summary>
    internal static void EnsurePackageWithinLimits(ZipArchive archive)
    {
        var entries = archive.Entries;
        if (entries.Count > MaxZipEntries)
        {
            throw new BusinessRuleException(
                $"File Excel chứa {entries.Count:N0} thành phần, vượt giới hạn {MaxZipEntries:N0}. " +
                "File có thể bị hỏng hoặc được tạo để tấn công hệ thống.");
        }

        long declaredTotal = 0;
        foreach (var entry in entries)
        {
            declaredTotal += entry.Length;
            if (declaredTotal > MaxTotalUncompressedBytes)
            {
                throw new BusinessRuleException(
                    $"File Excel giải nén ra hơn {MaxTotalUncompressedBytes / (1024 * 1024):N0} MB dữ liệu, " +
                    "vượt giới hạn cho phép. Vui lòng tách bớt dữ liệu trước khi tải lên.");
            }
        }
    }

    /// <summary>
    /// Nạp toàn bộ stream tải lên vào bộ nhớ nhưng có trần cứng <see cref="MaxUploadBytes"/>.
    /// Không có trần thì một upload vài GB làm <c>MemoryStream</c> phình vô hạn (DoS bộ nhớ),
    /// và <c>ToArray()</c> còn nhân đôi mức phình đó.
    /// </summary>
    internal static async Task<byte[]> ReadAllBytesWithinLimitAsync(
        Stream source,
        string label,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(source);
        EnsureDeclaredLengthWithinLimit(source, label);

        using var buffer = new MemoryStream(EstimateCapacity(source));
        var chunk = new byte[81_920];
        long total = 0;

        while (true)
        {
            var read = await source.ReadAsync(chunk, cancellationToken).ConfigureAwait(false);
            if (read <= 0)
            {
                break;
            }

            total += read;
            EnsureUploadSizeWithinLimit(total, label);
            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }

    /// <summary>Bản đồng bộ của <see cref="ReadAllBytesWithinLimitAsync"/> cho parser chạy đồng bộ.</summary>
    internal static MemoryStream CopyToBoundedMemory(Stream source, string label)
    {
        ArgumentNullException.ThrowIfNull(source);
        EnsureDeclaredLengthWithinLimit(source, label);

        var buffer = new MemoryStream(EstimateCapacity(source));
        try
        {
            var chunk = new byte[81_920];
            long total = 0;

            while (true)
            {
                var read = source.Read(chunk, 0, chunk.Length);
                if (read <= 0)
                {
                    break;
                }

                total += read;
                EnsureUploadSizeWithinLimit(total, label);
                buffer.Write(chunk, 0, read);
            }

            buffer.Position = 0;
            return buffer;
        }
        catch
        {
            buffer.Dispose();
            throw;
        }
    }

    /// <summary>
    /// Từ chối ngay khi stream tự khai độ dài vượt trần — chặn trước khi cấp phát byte nào.
    /// </summary>
    private static void EnsureDeclaredLengthWithinLimit(Stream source, string label)
    {
        if (source.CanSeek)
        {
            EnsureUploadSizeWithinLimit(source.Length, label);
        }
    }

    private static void EnsureUploadSizeWithinLimit(long sizeBytes, string label)
    {
        if (sizeBytes > MaxUploadBytes)
        {
            throw new BusinessRuleException(
                $"{label} có dung lượng vượt quá {MaxUploadBytes / (1024 * 1024):N0} MB. " +
                "Vui lòng tách bớt dữ liệu trước khi tải lên.");
        }
    }

    private static int EstimateCapacity(Stream source)
        => source.CanSeek && source.Length > 0 && source.Length <= MaxUploadBytes
            ? (int)source.Length
            : 0;

    // =====================================================================
    // 2. Hàng rào ở tầng XML
    // =====================================================================

    /// <summary>
    /// Đọc một part XML với hai lớp chặn: kích thước khai báo trong central directory
    /// và số byte thật sự giải nén (central directory có thể khai gian).
    /// DTD bị cấm nên loại luôn XXE và "billion laughs".
    /// </summary>
    internal static XDocument LoadXmlPart(ZipArchiveEntry entry, string label)
    {
        if (entry.Length > MaxUncompressedPartBytes)
        {
            throw new BusinessRuleException(
                $"{label} trong file Excel có dung lượng {entry.Length / (1024 * 1024):N0} MB sau giải nén, " +
                $"vượt giới hạn {MaxUncompressedPartBytes / (1024 * 1024):N0} MB.");
        }

        using var rawStream = entry.Open();
        using var boundedStream = new BoundedReadStream(rawStream, MaxUncompressedPartBytes, label);
        using var xmlReader = XmlReader.Create(boundedStream, CreateSafeXmlReaderSettings());

        // XmlException được để nguyên: đó là "file hỏng", đã có đường xử lý riêng
        // trả về FILE_READ_ERROR. Chỉ vi phạm hạn mức mới ném BusinessRuleException.
        return XDocument.Load(xmlReader);
    }

    internal static XmlReaderSettings CreateSafeXmlReaderSettings() => new()
    {
        // Giữ nguyên hành vi mặc định của XDocument.Load(Stream) để không đổi kết quả parse.
        IgnoreWhitespace = true,
        DtdProcessing = DtdProcessing.Prohibit,
        XmlResolver = null,
        MaxCharactersFromEntities = 10_000_000,
        CloseInput = false
    };

    internal static void EnsureSheetCountWithinLimit(int sheetCount)
    {
        if (sheetCount > MaxSheetCount)
        {
            throw new BusinessRuleException(
                $"File Excel có {sheetCount:N0} sheet, vượt giới hạn {MaxSheetCount:N0} sheet.");
        }
    }

    internal static void EnsureSharedStringCountWithinLimit(int currentCount)
    {
        if (currentCount >= MaxSharedStringCount)
        {
            throw new BusinessRuleException(
                $"File Excel khai báo hơn {MaxSharedStringCount:N0} chuỗi dùng chung, vượt giới hạn cho phép.");
        }
    }

    internal static void EnsureCellTextWithinLimit(string text)
    {
        if (text.Length > MaxCellCharacters)
        {
            throw new BusinessRuleException(
                $"File Excel chứa chuỗi dài {text.Length:N0} ký tự, vượt giới hạn {MaxCellCharacters:N0} ký tự của một ô.");
        }
    }

    internal static void EnsureRowCountWithinLimit(int currentCount)
    {
        if (currentCount >= MaxRowsPerSheet)
        {
            throw new BusinessRuleException(
                $"Sheet chứa hơn {MaxRowsPerSheet:N0} dòng, vượt giới hạn cho phép. " +
                "Vui lòng tách nhỏ dữ liệu trước khi tải lên.");
        }
    }

    // =====================================================================
    // 3. Vùng gộp ô — chốt chặn "merged-cell bomb" dùng chung cho mọi parser
    // =====================================================================

    /// <summary>
    /// Phân tích và kiểm duyệt toàn bộ khai báo <c>mergeCell</c> của một sheet MỘT lần.
    /// Đây là chốt chặn chính cho "merged-cell bomb": một file khai
    /// <c>ref="A1:XFD1048576"</c> phủ ~17,18 tỉ ô bị từ chối tại đây thay vì
    /// làm hai vòng lặp lồng nhau chạy vô hạn ở <see cref="ApplyMergedCellValues"/>.
    /// </summary>
    internal static List<XlsxMergeRange> ReadMergeRanges(XDocument document, string sheetName)
    {
        var ranges = new List<XlsxMergeRange>();
        long totalMergedCells = 0;

        foreach (var mergeElement in document.Descendants(SpreadsheetNs + "mergeCell"))
        {
            if (ranges.Count >= MaxMergeRegions)
            {
                throw new BusinessRuleException(
                    $"Sheet '{sheetName}' khai báo hơn {MaxMergeRegions:N0} vùng gộp ô, vượt giới hạn cho phép. " +
                    "File Excel không hợp lệ.");
            }

            var reference = mergeElement.Attribute("ref")?.Value;
            if (!TryParseCellRange(reference, out var start, out var end))
            {
                continue;
            }

            var startColumn = ColumnLetterToIndex(start.Column);
            var endColumn = ColumnLetterToIndex(end.Column);
            if (startColumn <= 0 || endColumn <= 0)
            {
                continue;
            }

            var firstRow = Math.Min(start.Row, end.Row);
            var lastRow = Math.Max(start.Row, end.Row);
            var firstColumn = Math.Min(startColumn, endColumn);
            var lastColumn = Math.Max(startColumn, endColumn);

            // Nhân trên long: (16.384 x 1.048.576) tràn int nếu tính bằng int.
            var cellCount = (long)(lastRow - firstRow + 1) * (lastColumn - firstColumn + 1);
            if (cellCount > MaxCellsPerMergeRegion)
            {
                throw new BusinessRuleException(
                    $"Vùng gộp ô '{reference}' trong sheet '{sheetName}' phủ {cellCount:N0} ô, " +
                    $"vượt giới hạn {MaxCellsPerMergeRegion:N0} ô cho một vùng. File Excel không hợp lệ.");
            }

            totalMergedCells += cellCount;
            if (totalMergedCells > MaxMergedCellsPerSheet)
            {
                throw new BusinessRuleException(
                    $"Sheet '{sheetName}' có tổng cộng hơn {MaxMergedCellsPerSheet:N0} ô nằm trong vùng gộp, " +
                    "vượt giới hạn cho phép. File Excel không hợp lệ.");
            }

            ranges.Add(new XlsxMergeRange(firstRow, lastRow, firstColumn, lastColumn));
        }

        return ranges;
    }

    /// <summary>
    /// Lan giá trị ô neo ra toàn bộ vùng gộp. CHỈ được gọi với danh sách vùng đã qua
    /// <see cref="ReadMergeRanges"/> — mọi vùng ở đây đã bị chặn trần nên hai vòng lặp
    /// lồng nhau luôn kết thúc trong thời gian hữu hạn.
    /// </summary>
    internal static void ApplyMergedCellValues(
        IReadOnlyDictionary<int, Dictionary<string, string>> rowsByNumber,
        IReadOnlyList<XlsxMergeRange> mergeRanges)
    {
        if (mergeRanges.Count == 0)
        {
            return;
        }

        foreach (var range in mergeRanges)
        {
            var anchorColumn = ColumnIndexToLetter(range.FirstColumn);
            if (!rowsByNumber.TryGetValue(range.FirstRow, out var sourceRow) ||
                !sourceRow.TryGetValue(anchorColumn, out var sourceValue) ||
                string.IsNullOrWhiteSpace(sourceValue))
            {
                continue;
            }

            for (var rowNumber = range.FirstRow; rowNumber <= range.LastRow; rowNumber++)
            {
                if (!rowsByNumber.TryGetValue(rowNumber, out var targetRow))
                {
                    continue;
                }

                for (var columnIndex = range.FirstColumn; columnIndex <= range.LastColumn; columnIndex++)
                {
                    var column = ColumnIndexToLetter(columnIndex);
                    if (!targetRow.TryGetValue(column, out var currentValue) ||
                        string.IsNullOrWhiteSpace(currentValue))
                    {
                        targetRow[column] = sourceValue;
                    }
                }
            }
        }
    }

    /// <summary>
    /// Lập chỉ mục dòng theo số dòng. Dùng <see cref="Dictionary{TKey,TValue}.TryAdd"/> thay cho
    /// <c>ToDictionary</c>: file độc hại khai hai <c>&lt;row r="5"&gt;</c> trùng số dòng từng làm
    /// <c>ToDictionary</c> ném <see cref="ArgumentException"/> và trả HTTP 500. Với file hợp lệ
    /// (số dòng không trùng) kết quả không đổi.
    /// </summary>
    internal static Dictionary<int, Dictionary<string, string>> BuildRowIndex(
        IEnumerable<(int RowNumber, Dictionary<string, string> Cells)> rows)
    {
        var index = new Dictionary<int, Dictionary<string, string>>();
        foreach (var (rowNumber, cells) in rows)
        {
            index.TryAdd(rowNumber, cells);
        }

        return index;
    }

    // =====================================================================
    // 4. Quy đổi địa chỉ ô
    // =====================================================================

    internal static bool TryParseCellRange(
        string? reference,
        out XlsxCellAddress start,
        out XlsxCellAddress end)
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

    internal static bool TryParseCellAddress(string reference, out XlsxCellAddress address)
    {
        address = default;
        var column = new string(reference.TakeWhile(char.IsLetter).ToArray()).ToUpperInvariant();
        var rowText = new string(reference.SkipWhile(char.IsLetter).TakeWhile(char.IsDigit).ToArray());
        if (string.IsNullOrWhiteSpace(column) ||
            !int.TryParse(rowText, NumberStyles.Integer, CultureInfo.InvariantCulture, out var row) ||
            row <= 0 ||
            row > ExcelMaxRowNumber)
        {
            return false;
        }

        address = new XlsxCellAddress(column, row);
        return true;
    }

    /// <summary>
    /// Trả về chỉ số cột 1-based, hoặc -1 khi tên cột không hợp lệ. Giới hạn 3 chữ cái
    /// và cột XFD chặn được tên cột khai khống kiểu "AAAAAAAAAA" gây tràn số nguyên.
    /// </summary>
    internal static int ColumnLetterToIndex(string column)
    {
        if (string.IsNullOrEmpty(column) || column.Length > MaxColumnLetterLength)
        {
            return -1;
        }

        var result = 0;
        foreach (var character in column.ToUpperInvariant())
        {
            if (character is < 'A' or > 'Z')
            {
                return -1;
            }

            result = (result * 26) + character - 'A' + 1;
        }

        return result > ExcelMaxColumnIndex ? -1 : result;
    }

    internal static string ColumnIndexToLetter(int column)
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

    internal static int ParseRowNumber(string? value, int fallbackRowNumber)
        => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var rowNumber) &&
           rowNumber > 0 &&
           rowNumber <= ExcelMaxRowNumber
            ? rowNumber
            : fallbackRowNumber;

    // =====================================================================
    // 5. Stream đếm byte giải nén thật
    // =====================================================================

    /// <summary>
    /// Bọc stream giải nén và ném lỗi khi vượt hạn mức byte thật.
    /// Cần thiết vì <see cref="ZipArchiveEntry.Length"/> lấy từ central directory và
    /// file độc hại có thể khai gian kích thước để lách kiểm tra tĩnh.
    /// </summary>
    internal sealed class BoundedReadStream : Stream
    {
        private readonly Stream _inner;
        private readonly long _limitBytes;
        private readonly string _label;
        private long _bytesRead;

        public BoundedReadStream(Stream inner, long limitBytes, string label)
        {
            _inner = inner;
            _limitBytes = limitBytes;
            _label = label;
        }

        public override bool CanRead => true;

        public override bool CanSeek => false;

        public override bool CanWrite => false;

        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => _bytesRead;
            set => throw new NotSupportedException();
        }

        public override int Read(byte[] buffer, int offset, int count)
            => Track(_inner.Read(buffer, offset, count));

        public override int Read(Span<byte> buffer)
            => Track(_inner.Read(buffer));

        public override int ReadByte()
        {
            var value = _inner.ReadByte();
            if (value >= 0)
            {
                Track(1);
            }

            return value;
        }

        public override void Flush() => _inner.Flush();

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();

        public override void SetLength(long value) => throw new NotSupportedException();

        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        private int Track(int bytesRead)
        {
            _bytesRead += bytesRead;
            if (_bytesRead > _limitBytes)
            {
                throw new BusinessRuleException(
                    $"{_label} trong file Excel giải nén vượt quá {_limitBytes / (1024 * 1024):N0} MB. " +
                    "File có thể được nén để tấn công hệ thống (zip bomb).");
            }

            return bytesRead;
        }

        protected override void Dispose(bool disposing)
        {
            // Stream gốc do phía gọi sở hữu và tự đóng.
            base.Dispose(disposing);
        }
    }
}

/// <summary>Vùng gộp ô đã qua kiểm duyệt hạn mức, toạ độ 1-based đã chuẩn hoá min/max.</summary>
internal readonly record struct XlsxMergeRange(int FirstRow, int LastRow, int FirstColumn, int LastColumn);

/// <summary>Địa chỉ một ô: tên cột chữ cái (đã viết hoa) và số dòng 1-based.</summary>
internal readonly record struct XlsxCellAddress(string Column, int Row);
