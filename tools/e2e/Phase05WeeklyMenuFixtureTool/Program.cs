using System.IO.Compression;
using System.Reflection;
using System.Xml.Linq;

if (args.Length is < 1 or > 2)
{
    Console.Error.WriteLine("Usage: Phase05WeeklyMenuFixtureTool <output-directory> [week-start-yyyy-MM-dd]");
    return 2;
}

var outputDirectory = Path.GetFullPath(args[0]);
Directory.CreateDirectory(outputDirectory);
var apiAssembly = Assembly.Load("IPCManagement.Api");
var builder = apiAssembly
    .GetType("IPCManagement.Api.Features.SampleData.Services.WeeklyMenuTemplateWorkbookBuilder")?
    .GetMethod("Build", BindingFlags.Public | BindingFlags.Static)
    ?? throw new InvalidOperationException("Production weekly-menu workbook builder was not found.");
var weekStart = args.Length == 2 && DateOnly.TryParseExact(args[1], "yyyy-MM-dd", out var requestedWeek)
    ? requestedWeek
    : new DateOnly(2026, 8, 17);
if (weekStart.DayOfWeek != DayOfWeek.Monday)
{
    Console.Error.WriteLine($"Week start must be Monday: {weekStart:yyyy-MM-dd}");
    return 2;
}

CreateFixture("ANV", [
    ["Thịt heo kho sả ruốc", "Heo xào măng", "Cá hố kho", "Vịt kho gừng", "Tôm thịt rim", "Cá bạc má kho thơm"],
    ["Chả cá sốt cà", "Trứng kho nước dừa", "Heo xíu xào giá", "Đậu khuôn thịt bằm", "Chả lá lốt", "Trứng xào cà chua"],
    ["Đậu bắp hấp", "Củ cải xào", "Cà tím mỡ hành", "Rau muống xào tỏi", "Đậu ve xào", "Dưa cải xào"],
    ["Canh chua", "Bí đỏ thịt bằm", "Mồng tơi nấu tôm", "Khổ qua thịt bằm", "Canh chua trứng", "Mít non nấu tôm"],
    ["Trái cây", "Sữa chua"],
], "weekly-menu-golden-ANV.xlsx");
CreateFixture("DAV", [
    ["Cá bạc má kho thơm", "Tôm thịt rim", "Vịt kho gừng", "Cá hố kho", "Heo xào măng", "Thịt heo kho sả ruốc"],
    ["Trứng xào cà chua", "Chả lá lốt", "Đậu khuôn thịt bằm", "Heo xíu xào giá", "Trứng kho nước dừa", "Chả cá sốt cà"],
    ["Dưa cải xào", "Đậu ve xào", "Rau muống xào tỏi", "Cà tím mỡ hành", "Củ cải xào", "Đậu bắp hấp"],
    ["Mít non nấu tôm", "Canh chua trứng", "Khổ qua thịt bằm", "Mồng tơi nấu tôm", "Bí đỏ thịt bằm", "Canh chua"],
    ["Sữa chua", "Trái cây"],
], "weekly-menu-golden-DAV.xlsx");
return 0;

void CreateFixture(string customerCode, string[][] dishes, string fileName)
{
    var bytes = (byte[])builder.Invoke(null, [weekStart, customerCode])!;
    using var output = new MemoryStream();
    output.Write(bytes);
    output.Position = 0;
    using (var archive = new ZipArchive(output, ZipArchiveMode.Update, leaveOpen: true))
    {
        var workbook = XDocument.Load(archive.GetEntry("xl/workbook.xml")!.Open());
        XNamespace spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var sheetNames = workbook.Descendants(spreadsheet + "sheet")
            .Select(sheet => (string?)sheet.Attribute("name"))
            .ToArray();
        if (!sheetNames.SequenceEqual(["25k", "30k", "34k"], StringComparer.Ordinal))
        {
            throw new InvalidOperationException($"{customerCode} has non-canonical sheets: {string.Join(", ", sheetNames)}");
        }

        for (var sheetIndex = 1; sheetIndex <= 3; sheetIndex++)
        {
            var worksheetPath = $"xl/worksheets/sheet{sheetIndex}.xml";
            var entry = archive.GetEntry(worksheetPath)!;
            XDocument worksheet;
            using (var stream = entry.Open()) { worksheet = XDocument.Load(stream); }
            for (var dayIndex = 0; dayIndex < 6; dayIndex++)
            {
                var column = ((char)('D' + dayIndex)).ToString();
                for (var sectionIndex = 0; sectionIndex < 4; sectionIndex++)
                {
                    var rowOffset = new[] { 9, 15, 22, 28 }[sectionIndex];
                    var dishIndex = (dayIndex + sectionIndex) % 6;
                    for (var slotIndex = 0; slotIndex < 4; slotIndex++)
                    {
                        SetCell(worksheet, $"{column}{rowOffset + slotIndex}", dishes[slotIndex][dishIndex]);
                    }
                }
            }
            var dessertRows = new[] { 13, 19, 26, 32 };
            for (var sectionIndex = 0; sectionIndex < dessertRows.Length; sectionIndex++)
            {
                SetCell(worksheet, $"D{dessertRows[sectionIndex]}", dishes[4][sectionIndex % dishes[4].Length]);
            }
            entry.Delete();
            var replacement = archive.CreateEntry(worksheetPath, CompressionLevel.Optimal);
            using var writer = new StreamWriter(replacement.Open());
            worksheet.Save(writer, SaveOptions.DisableFormatting);
        }

        void SetCell(XDocument worksheet, string reference, string value)
        {
            var cell = worksheet.Descendants(spreadsheet + "c")
                .Single(candidate => (string?)candidate.Attribute("r") == reference);
            cell.SetAttributeValue("t", "inlineStr");
            cell.Elements(spreadsheet + "v").Remove();
            cell.Elements(spreadsheet + "is").Remove();
            cell.Add(new XElement(spreadsheet + "is", new XElement(spreadsheet + "t", value)));
        }
    }

    var path = Path.Combine(outputDirectory, fileName);
    File.WriteAllBytes(path, output.ToArray());
    Console.WriteLine($"{customerCode}: {path}");
}
