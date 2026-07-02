using System.Collections;
using System.IO.Compression;
using System.Reflection;
using System.Security;
using FluentAssertions;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.SampleData;

namespace IPCManagement.Api.Tests;

public class WeeklyMenuImportParserTests
{
    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Parse_StandardSixDayMenu()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "MENU", [
                ["", "", "THỰC ĐƠN AMANN"],
                [],
                [],
                [],
                ["", "", "", "15/06/2026", "16/06/2026", "17/06/2026", "18/06/2026", "19/06/2026", "20/06/2026"],
                [],
                [],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Cá kho", "Gà kho", "Thịt ram", "Bún bò", "Cá chiên", "Mì quảng"],
                ["", "", "Rau", "Rau lang", "Rau muống", "Cải thìa", "Bầu luộc", "Đậu bắp", "Su luộc"],
                ["", "", "MENU CHAY- CA SÁNG"],
                ["", "", "Món chay chính", "Đậu sốt", "Gà chay", "Mì chay", "Nấm kho", "Bò lát", "Bún chay"],
                ["", "", "MENU MẶN - CA CHIỀU"],
                ["", "", "Món mặn chính", "Cá nục", "Thịt kho", "Gà xào", "Tôm rang", "Cá rim", "Bún thịt"],
                ["", "", "MENU CHAY- CA CHIỀU"],
                ["", "", "Món chay chính", "Đậu hũ", "Rau củ", "Sườn chay", "Nấm xào", "Chả chay", "Mít non"],
            ]);

            var plan = InvokeParse(tempFile, "standard.xlsx", null);

            GetProperty<string>(plan, "SheetName").Should().Be("MENU");
            GetProperty<string>(plan, "LabelColumn").Should().Be("C");
            GetEnumerable(plan, "DayColumns").Should().HaveCount(6);
            GetEnumerable(plan, "Sections").Should().HaveCount(4);
            GetEnumerable(plan, "Items").Should().HaveCount(30);
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Warn_When_ImportedSlotRowsAreDuplicated()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "MENU", [
                ["", "", "THỰC ĐƠN AMANN"],
                [],
                [],
                [],
                ["", "", "", "15/06/2026"],
                [],
                [],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Cá kho"],
                ["", "", "Món mặn chính", "Gà kho"],
            ]);

            var plan = InvokeParse(tempFile, "duplicate-slot.xlsx", null);
            var warnings = GetStrings(plan, "Warnings");

            GetEnumerable(plan, "Items").Should().HaveCount(2);
            warnings.Should().ContainSingle(item =>
                item.Contains("dòng trùng", StringComparison.OrdinalIgnoreCase) &&
                item.Contains("2026-06-15", StringComparison.OrdinalIgnoreCase) &&
                item.Contains("Món mặn chính", StringComparison.OrdinalIgnoreCase),
                $"warnings were: {string.Join(" | ", warnings)}");

            var validation = InvokeValidation(plan, [
                new WeeklyMenuImportRowDto
                {
                    ServiceDate = new DateOnly(2026, 6, 15),
                    SourceRowNumber = 9,
                    SourceColumn = "D",
                    DbShiftName = "MORNING",
                    Variant = "Mặn",
                    Slot = "main",
                    SlotLabel = "Món mặn chính",
                    DishName = "Cá kho",
                    ExistingDish = true
                },
                new WeeklyMenuImportRowDto
                {
                    ServiceDate = new DateOnly(2026, 6, 15),
                    SourceRowNumber = 10,
                    SourceColumn = "D",
                    DbShiftName = "MORNING",
                    Variant = "Mặn",
                    Slot = "main",
                    SlotLabel = "Món mặn chính",
                    DishName = "Gà kho",
                    ExistingDish = true
                }
            ]);

            validation.HasCriticalErrors.Should().BeTrue();
            validation.Issues.Should().ContainSingle(issue =>
                issue.Code == "DUPLICATE_SLOT" &&
                issue.RowNumber == 9 &&
                issue.Column == "D" &&
                issue.Cell == "D9");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_UseFallbackWeekStart_WhenOnlyWeekdayHeadersExist()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "SUẤT ĂN CHÍNH", [
                ["", "", "MENU SUẤT ĂN CHÍNH"],
                [],
                [],
                [],
                ["", "", "", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ7"],
                ["", "", "MENU MẶN - CA TRƯA"],
                ["", "", "Món mặn chính", "Cá kho", "Gà kho", "Thịt ram", "Bún bò", "Cá chiên", "Mì quảng"],
                ["", "", "MENU CHAY- CA TRƯA"],
                ["", "", "Món chay chính", "Đậu sốt", "Gà chay", "Mì chay", "Nấm kho", "Bò lát", "Bún chay"],
            ]);

            var plan = InvokeParse(tempFile, "template.xlsx", new DateOnly(2026, 6, 15));

            GetProperty<DateOnly>(plan, "WeekStartDate").Should().Be(new DateOnly(2026, 6, 15));
            GetEnumerable(plan, "DayColumns").Should().HaveCount(6);
            GetEnumerable(plan, "Items").Should().HaveCount(12);
            GetStrings(plan, "Warnings").Should().Contain(item => item.Contains("Ca trưa", StringComparison.OrdinalIgnoreCase));
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Parse_OneDayMenu()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "01.09", [
                ["", "", "THỰC ĐƠN AMANN"],
                [],
                [],
                ["", "", "Từ ngày 01/09/2024"],
                [],
                ["", "", "", "Chủ Nhật"],
                ["", "", "", "01/09/2024"],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Cá mối kho nghệ"],
                ["", "", "Phụ", "Tôm thịt rim"],
                ["", "", "MENU MẶN - CA CHIỀU"],
                ["", "", "Món mặn chính", "Cá sòng kho thơm"],
            ]);

            var plan = InvokeParse(tempFile, "one-day.xlsx", null);

            GetEnumerable(plan, "DayColumns").Should().HaveCount(1);
            GetEnumerable(plan, "Sections").Should().HaveCount(2);
            GetEnumerable(plan, "Items").Should().HaveCount(3);
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Fill_VerticalMergedDishCells()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "MENU", [
                ["", "", "THỰC ĐƠN DRAXLMAIER"],
                [],
                [],
                [],
                ["", "", "", "15/06/2026"],
                [],
                [],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "BÚN GIÒ"],
                ["", "", "Phụ 1"],
                ["", "", "Phụ 2"],
                ["", "", "Rau"],
                ["", "", "Canh"],
                ["", "", "Trái cây", "TRÁI CÂY"],
            ], ["D9:D13"]);

            var plan = InvokeParse(tempFile, "merged.xlsx", null);
            var items = GetEnumerable(plan, "Items");

            items.Should().HaveCount(6);
            items
                .Select(item => GetProperty<string>(item, "DishName"))
                .Should()
                .ContainInOrder("BÚN GIÒ", "BÚN GIÒ", "BÚN GIÒ", "BÚN GIÒ", "BÚN GIÒ", "TRÁI CÂY");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Rebase_DateRow_When_WeekdayHeadersMismatch()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "MENU", [
                ["", "", "THỰC ĐƠN DAV"],
                [],
                [],
                ["", "", "Từ ngày 15/06/2026 đến ngày 20/06/2026"],
                [],
                ["", "", "", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"],
                ["", "", "", "45823", "45824", "45825", "45826", "45827", "45828"],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Mỳ quảng", "Cá ngừ", "Cơm gà", "Cá kho", "Bún giò", "Tôm rim"],
            ], ["C4:H4", "C8:I8"]);

            var plan = InvokeParse(tempFile, "title-range.xlsx", null);
            var dayColumns = GetEnumerable(plan, "DayColumns");
            var items = GetEnumerable(plan, "Items");

            dayColumns
                .Select(item => GetProperty<DateOnly>(item, "ServiceDate"))
                .Should()
                .Equal(
                    new DateOnly(2026, 6, 15),
                    new DateOnly(2026, 6, 16),
                    new DateOnly(2026, 6, 17),
                    new DateOnly(2026, 6, 18),
                    new DateOnly(2026, 6, 19),
                    new DateOnly(2026, 6, 20));
            dayColumns
                .Select(item => GetProperty<string>(item, "DayKey"))
                .Should()
                .Equal("t2", "t3", "t4", "t5", "t6", "t7");
            items
                .Select(item => GetProperty<string>(item, "DishName"))
                .Should()
                .ContainInOrder("Mỳ quảng", "Cá ngừ", "Cơm gà", "Cá kho", "Bún giò", "Tôm rim");
            items
                .Select(item => GetProperty<string>(item, "DayKey"))
                .Should()
                .ContainInOrder("t2", "t3", "t4", "t5", "t6", "t7");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_Reject_NonMenuWorkbook()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "Sheet1", [
                ["", "", "Mâm lễ cúng rằm tháng 7"],
                ["", "", "1", "2 bó lớn hoa tươi", "100"],
                ["", "", "2", "2 dĩa trái cây ngũ quả", "200"],
            ]);

            var action = () => InvokeParse(tempFile, "mam-le-cung.xlsx", null);

            action.Should().Throw<TargetInvocationException>()
                .WithInnerException<InvalidOperationException>()
                .WithMessage("*không có bảng thực đơn tuần*");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_PreferSheetNameHint_FromCustomerMapping()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            // "Sheet1" is a decoy that outscores the real menu sheet (many repeated section
            // headers) but has no coherent day columns, so parsing it fails outright.
            var decoyRows = Enumerable.Range(0, 10)
                .Select(_ => new List<string> { "", "", "MENU MẶN - CA SÁNG" })
                .ToList();

            IReadOnlyList<IReadOnlyList<string>> realMenuRows = [
                ["", "", "", "15/06/2026"],
                [],
                [],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Cá mối kho nghệ"],
            ];

            CreateMultiSheetWorkbook(tempFile, [
                ("Sheet1", decoyRows, null),
                ("MENU", realMenuRows, null),
            ]);

            var actionWithoutHint = () => InvokeParse(tempFile, "customer-file.xlsx", null, null);
            actionWithoutHint.Should().Throw<TargetInvocationException>();

            var mapping = new Customerimportmapping { SheetNameHint = "MENU" };
            var plan = InvokeParse(tempFile, "customer-file.xlsx", null, mapping);

            GetProperty<string>(plan, "SheetName").Should().Be("MENU");
            GetEnumerable(plan, "Items")
                .Select(item => GetProperty<string>(item, "DishName"))
                .Should()
                .Contain("Cá mối kho nghệ");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    [Fact]
    public void ParseWeeklyMenuWorkbook_Should_UseLabelColumn_FromCustomerMapping()
    {
        var tempFile = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        try
        {
            CreateWorkbook(tempFile, "01.09", [
                ["", "", "THỰC ĐƠN AMANN"],
                [],
                [],
                ["", "", "Từ ngày 01/09/2024"],
                [],
                ["", "", "", "Chủ Nhật"],
                ["", "", "", "01/09/2024"],
                ["", "", "MENU MẶN - CA SÁNG"],
                ["", "", "Món mặn chính", "Cá mối kho nghệ"],
                ["", "", "Phụ", "Tôm thịt rim"],
            ]);

            var mapping = new Customerimportmapping { LabelColumn = "c" };
            var plan = InvokeParse(tempFile, "override.xlsx", null, mapping);

            GetProperty<string>(plan, "LabelColumn").Should().Be("c");
        }
        finally
        {
            DeleteTemp(tempFile);
        }
    }

    private static object InvokeParse(
        string workbookPath,
        string fileName,
        DateOnly? weekStartDate,
        Customerimportmapping? mapping = null)
    {
        var service = new SampleDataImportService(null!, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "ParseWeeklyMenuWorkbook",
            BindingFlags.NonPublic | BindingFlags.Instance);

        method.Should().NotBeNull();
        return method!.Invoke(service, [workbookPath, fileName, weekStartDate, mapping])!;
    }

    private static T GetProperty<T>(object source, string propertyName)
    {
        var value = source.GetType().GetProperty(propertyName)!.GetValue(source);
        return (T)value!;
    }

    private static IReadOnlyList<object> GetEnumerable(object source, string propertyName)
        => ((IEnumerable)source.GetType().GetProperty(propertyName)!.GetValue(source)!)
            .Cast<object>()
            .ToList();

    private static IReadOnlyList<string> GetStrings(object source, string propertyName)
        => GetEnumerable(source, propertyName).Cast<string>().ToList();

    private static WeeklyMenuImportValidationDto InvokeValidation(
        object plan,
        IReadOnlyList<WeeklyMenuImportRowDto> rows)
    {
        var method = typeof(SampleDataImportService).GetMethod(
            "BuildWeeklyMenuImportValidation",
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();
        return (WeeklyMenuImportValidationDto)method!.Invoke(null, [plan, rows])!;
    }

    private static void CreateWorkbook(
        string path,
        string sheetName,
        IReadOnlyList<IReadOnlyList<string>> rows,
        IReadOnlyList<string>? mergedRanges = null)
    {
        using var archive = ZipFile.Open(path, ZipArchiveMode.Create);
        AddEntry(archive, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
            </Types>
            """);
        AddEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/workbook.xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                <sheet name="{SecurityElement.Escape(sheetName)}" sheetId="1" r:id="rId1"/>
              </sheets>
            </workbook>
            """);
        AddEntry(archive, "xl/_rels/workbook.xml.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/worksheets/sheet1.xml", BuildSheet(rows, mergedRanges ?? []));
    }

    private static void CreateMultiSheetWorkbook(
        string path,
        IReadOnlyList<(string SheetName, IReadOnlyList<IReadOnlyList<string>> Rows, IReadOnlyList<string>? MergedRanges)> sheets)
    {
        using var archive = ZipFile.Open(path, ZipArchiveMode.Create);
        var sheetParts = sheets
            .Select((sheet, index) => new { sheet.SheetName, sheet.Rows, sheet.MergedRanges, PartIndex = index + 1 })
            .ToList();

        AddEntry(archive, "[Content_Types].xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
              {string.Concat(sheetParts.Select(part => $"""<Override PartName="/xl/worksheets/sheet{part.PartIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>"""))}
            </Types>
            """);
        AddEntry(archive, "_rels/.rels", """
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
            </Relationships>
            """);
        AddEntry(archive, "xl/workbook.xml", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                {string.Concat(sheetParts.Select(part => $"""<sheet name="{SecurityElement.Escape(part.SheetName)}" sheetId="{part.PartIndex}" r:id="rId{part.PartIndex}"/>"""))}
              </sheets>
            </workbook>
            """);
        AddEntry(archive, "xl/_rels/workbook.xml.rels", $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              {string.Concat(sheetParts.Select(part => $"""<Relationship Id="rId{part.PartIndex}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{part.PartIndex}.xml"/>"""))}
            </Relationships>
            """);

        foreach (var part in sheetParts)
        {
            AddEntry(archive, $"xl/worksheets/sheet{part.PartIndex}.xml", BuildSheet(part.Rows, part.MergedRanges ?? []));
        }
    }

    private static string BuildSheet(
        IReadOnlyList<IReadOnlyList<string>> rows,
        IReadOnlyList<string> mergedRanges)
    {
        var xmlRows = rows.Select((row, rowIndex) =>
        {
            var cells = row.Select((value, columnIndex) =>
            {
                if (string.IsNullOrWhiteSpace(value))
                {
                    return string.Empty;
                }

                var reference = $"{ColumnLetter(columnIndex + 1)}{rowIndex + 1}";
                return $"""<c r="{reference}" t="inlineStr"><is><t>{SecurityElement.Escape(value)}</t></is></c>""";
            });

            return $"""<row r="{rowIndex + 1}">{string.Concat(cells)}</row>""";
        });

        var mergeCellsXml = mergedRanges.Count == 0
            ? string.Empty
            : $"""
                <mergeCells count="{mergedRanges.Count}">
                  {string.Concat(mergedRanges.Select(range => $"""<mergeCell ref="{SecurityElement.Escape(range)}"/>"""))}
                </mergeCells>
                """;

        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
              <sheetData>
                {string.Concat(xmlRows)}
              </sheetData>
              {mergeCellsXml}
            </worksheet>
            """;
    }

    private static string ColumnLetter(int column)
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

    private static void AddEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open());
        writer.Write(content);
    }

    private static void DeleteTemp(string path)
    {
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }
}
