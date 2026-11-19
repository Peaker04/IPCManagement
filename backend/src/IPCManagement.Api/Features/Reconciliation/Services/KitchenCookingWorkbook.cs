using System.Globalization;
using System.Security;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class KitchenCookingWorkbook
{
    internal sealed record Batch(string CustomerId, string CustomerCode, ReconciliationKitchenCookingExportDto Document);

    private sealed record Dish(Batch Batch, ReconciliationKitchenCookingRowDto[] Ingredients)
    {
        internal ReconciliationKitchenCookingRowDto First => Ingredients[0];
        internal bool Comparable => Ingredients.All(row => row.CanCompareRecipeLine)
            && Ingredients.Select(row => (row.IngredientIdentity, row.CanonicalUnitIdentity)).Distinct().Count() == Ingredients.Length;
    }

    private sealed record Recipe(Dish[] Dishes, bool DuplicateCustomer = false)
    {
        internal ReconciliationKitchenCookingRowDto First => Dishes[0].First;
    }

    private const int CustomerColumnsPerPrintWidth = 6;
    private const int AllocationStartColumn = 5;
    // At 80%, this leaves space on A4 for both repeated column headings and the page header/footer.
    private const int PrintBodyHeight = 540;
    private const int DefaultCustomerHeaderHeight = 28;
    private const int SectionHeight = 24;
    private const int DayHeight = 30;
    private const int SectionStyle = 10;
    private const int DayStyle = 11;

    internal static string BuildWorksheet(IReadOnlyList<Batch> batches, DateOnly weekStart, DateOnly? date, string shiftLabel, bool allShifts)
    {
        var dishes = batches.SelectMany(batch => batch.Document.Rows
            .Where(row => (date is null || row.ServiceDate == date) && (allShifts || row.ShiftName == shiftLabel))
            .GroupBy(row => (row.ServiceDate, row.ShiftName, row.MenuVariant, row.FrozenDishIdentity, row.DishCode, row.DishName))
            .Select(group => new Dish(batch, group.OrderBy(row => row.IngredientIdentity, StringComparer.Ordinal)
                .ThenBy(row => row.CanonicalUnitIdentity, StringComparer.Ordinal).ToArray())))
            .ToArray();
        if (dishes.Length == 0)
            throw new ArgumentException("Không có món trong ngày và ca đã chọn.");
        if (dishes.Any(dish => dish.Ingredients.Any(row => row.Servings != dish.First.Servings)))
            throw new InvalidOperationException("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS: Số suất giữa các nguyên liệu của cùng món không khớp.");

        var customerColumns = dishes.Select(dish => dish.Batch).DistinctBy(batch => batch.Document.BatchId)
            .OrderBy(batch => batch.CustomerCode, StringComparer.Ordinal)
            .GroupBy(batch => batch.CustomerId)
            .SelectMany(customer => customer.Select((batch, index) => (
                batch.Document.BatchId, Label: customer.Count() == 1 ? batch.CustomerCode : $"{batch.CustomerCode} · Lô {index + 1}")))
            .ToArray();
        var vertical = customerColumns.Length > CustomerColumnsPerPrintWidth;
        var allocationWidth = vertical ? 1 : customerColumns.Length;
        var allocationColumnWidth = vertical ? 23 : allocationWidth <= 3 ? 12 : 9;
        var noteCol = AllocationStartColumn + allocationWidth;
        var lastCol = Col(noteCol);
        var columnByBatch = customerColumns.Select((customer, index) => (customer.BatchId, index))
            .ToDictionary(customer => customer.BatchId, customer => customer.index, StringComparer.Ordinal);
        var allocationLabels = customerColumns.Select(column => column.Label).ToArray();

        var xml = new StringBuilder("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>""");
        int[] widths = [26, 10, 30, 15, 11, .. Enumerable.Repeat(allocationColumnWidth, allocationWidth), 27];
        for (var index = 0; index < widths.Length; index++)
            xml.Append($"<col min=\"{index + 1}\" max=\"{index + 1}\" width=\"{widths[index]}\" customWidth=\"1\"/>");
        xml.Append("</cols><sheetData>");

        string?[] titles = ["Món", "Tổng suất", "Nguyên liệu · ĐVT", "Định lượng / suất", "Tổng cần",
            "Số suất theo khách", .. new string?[allocationWidth - 1], "Ghi chú"];
        string?[] labels = new string?[titles.Length];
        if (vertical) labels[AllocationStartColumn] = "Khách / lô · Suất";
        else for (var index = 0; index < customerColumns.Length; index++)
            labels[AllocationStartColumn + index] = customerColumns[index].Label;
        WriteRow(xml, 1, titles, 1, 26);
        var customerHeaderHeight = vertical ? DefaultCustomerHeaderHeight : Math.Max(DefaultCustomerHeaderHeight,
            allocationLabels.Max(label => WrappedHeight(label, allocationColumnWidth - 2)));
        WriteRow(xml, 2, labels, 1, customerHeaderHeight);
        var printBodyHeight = PrintBodyHeight - (customerHeaderHeight - DefaultCustomerHeaderHeight);
        var merges = Enumerable.Range(0, AllocationStartColumn).Select(i => $"{Col(i)}1:{Col(i)}2").ToList();
        merges.Add($"{lastCol}1:{lastCol}2");
        if (allocationWidth > 1) merges.Add($"F1:{Col(noteCol - 1)}1");

        var rowNumber = 3;
        var bodyHeight = 0;
        var pageBreaks = new List<int>();
        DateOnly? currentDay = null;
        var sections = dishes.GroupBy(dish => (dish.First.ServiceDate, dish.First.ShiftName, dish.First.MenuVariant))
            .OrderBy(section => section.Key.ServiceDate)
            .ThenBy(section => section.Key.ShiftName switch { "Ca sáng" => 0, "Ca chiều" => 1, _ => 2 })
            .ThenBy(section => section.Key.ShiftName, StringComparer.Ordinal)
            .ThenBy(section => section.Key.MenuVariant, StringComparer.Ordinal).ToArray();
        foreach (var section in sections)
        {
            var dayPending = currentDay != section.Key.ServiceDate;
            currentDay = section.Key.ServiceDate;
            var sectionPending = true;

            void WriteHeading(string text, int style, int height)
            {
                var cells = new string?[titles.Length];
                cells[0] = text;
                WriteRow(xml, rowNumber, cells, style, height);
                merges.Add($"A{rowNumber}:{lastCol}{rowNumber}");
                rowNumber++;
            }

            void ReserveBlock(int height)
            {
                var headingHeight = (dayPending ? DayHeight : 0) + (sectionPending ? SectionHeight : 0);
                if (bodyHeight > 0 && bodyHeight + height + headingHeight > printBodyHeight)
                {
                    pageBreaks.Add(rowNumber - 1);
                    bodyHeight = 0;
                }
                if (dayPending)
                {
                    WriteHeading(FormattableString.Invariant($"{section.First().First.Weekday} · {section.Key.ServiceDate:dd/MM/yyyy}"), DayStyle, DayHeight);
                    dayPending = false;
                }
                if (sectionPending)
                {
                    WriteHeading($"{section.Key.ShiftName} · {section.Key.MenuVariant}", SectionStyle, SectionHeight);
                    sectionPending = false;
                }
                bodyHeight += height + headingHeight;
            }

            var recipes = section.GroupBy(dish => (dish.First.FrozenDishIdentity, dish.First.DishName, Signature(dish)))
                .SelectMany(SplitOverlappingLots)
                .OrderBy(recipe => recipe.First.DishName, StringComparer.Ordinal)
                .ThenBy(recipe => recipe.Dishes.Min(dish => columnByBatch[dish.Batch.Document.BatchId]))
                .ThenBy(recipe => recipe.First.FrozenDishIdentity, StringComparer.Ordinal)
                .ThenBy(recipe => recipe.First.DishCode, StringComparer.Ordinal)
                .ToArray();
            var shaded = false;
            foreach (var recipe in recipes)
            {
                WriteRecipe(xml, merges, recipe, columnByBatch, allocationLabels,
                    vertical, noteCol, shaded, ReserveBlock, ref rowNumber);
                shaded = !shaded;
            }
        }

        xml.Append($"</sheetData><mergeCells count=\"{merges.Count}\">");
        foreach (var merge in merges) xml.Append($"<mergeCell ref=\"{merge}\"/>");
        var scope = date is { } selectedDate ? FormattableString.Invariant($"{selectedDate:dd/MM/yyyy}")
            : FormattableString.Invariant($"Tuần {weekStart:dd/MM/yyyy} – {weekStart.AddDays(6):dd/MM/yyyy}");
        xml.Append($"""</mergeCells><pageMargins left="0.25" right="0.25" top="0.65" bottom="0.55" header="0.25" footer="0.25"/><pageSetup paperSize="9" orientation="landscape" scale="80"/><headerFooter scaleWithDoc="0"><oddHeader>&amp;L&amp;BPHIẾU NẤU&amp;B&amp;R{scope} · {shiftLabel}</oddHeader><oddFooter>&amp;RTrang &amp;P / &amp;N</oddFooter></headerFooter>""");
        if (pageBreaks.Count > 0)
        {
            if (pageBreaks.Count > 1026)
                throw new ArgumentException("Phiếu nấu vượt giới hạn ngắt trang Excel. Hãy chọn ít ngày hoặc lô hơn.");
            xml.Append($"<rowBreaks count=\"{pageBreaks.Count}\" manualBreakCount=\"{pageBreaks.Count}\">");
            foreach (var pageBreak in pageBreaks)
                xml.Append($"<brk id=\"{pageBreak}\" min=\"0\" max=\"16383\" man=\"1\"/>");
            xml.Append("</rowBreaks>");
        }
        return xml.Append("</worksheet>").ToString();
    }

    private static string Signature(Dish dish) => dish.Comparable
        ? string.Join('|', dish.Ingredients.Select(row => FormattableString.Invariant(
            $"{row.IngredientIdentity}:{row.CanonicalUnitIdentity}:{row.BomQuantityPerServing:G29}:{row.WasteRatePercent:G29}")))
        : dish.Batch.Document.BatchId;

    private static IEnumerable<Recipe> SplitOverlappingLots(IEnumerable<Dish> dishes)
    {
        var shared = new List<Dish>();
        foreach (var customer in dishes.GroupBy(dish => dish.Batch.CustomerId))
        {
            var lots = customer.ToArray();
            if (lots.Length == 1)
                shared.Add(lots[0]);
            else
                foreach (var lot in lots)
                    yield return new Recipe([lot], DuplicateCustomer: true);
        }
        if (shared.Count > 0) yield return new Recipe(shared.ToArray());
    }

    private static void WriteRecipe(StringBuilder xml, List<string> merges, Recipe recipe,
        IReadOnlyDictionary<string, int> columnByBatch, string[] labels, bool vertical, int noteCol, bool shaded,
        Action<int> reserveBlock, ref int rowNumber)
    {
        var name = recipe.First.DishName;
        var ingredients = recipe.Dishes[0].Ingredients;
        var ingredientOrder = Enumerable.Range(0, ingredients.Length)
            .OrderBy(index => ingredients[index].IngredientName, StringComparer.Ordinal).ToArray();
        var allocations = recipe.Dishes.OrderBy(dish => columnByBatch[dish.Batch.Document.BatchId]).ToArray();
        var rowCount = vertical ? Math.Max(ingredients.Length, allocations.Length) : ingredients.Length;
        var note = recipe.DuplicateCustomer ? "Đối chiếu các lô cùng khách trước khi nấu."
            : !recipe.Dishes[0].Comparable ? "Giữ riêng · Cần kiểm tra định lượng hoặc dòng nguồn." : "–";
        var mergedHeight = Math.Max(WrappedHeight(name, 21), WrappedHeight(note, 23));
        var rows = new List<(string?[] Values, int Height)>(rowCount);
        for (var index = 0; index < rowCount; index++)
        {
            var values = new string?[noteCol + 1];
            if (index == 0)
            {
                values[0] = name;
                values[1] = recipe.Dishes.Sum(dish => (long)dish.First.Servings).ToString(CultureInfo.InvariantCulture);
                values[noteCol] = note;
                if (!vertical)
                {
                    Array.Fill(values, "–", AllocationStartColumn, labels.Length);
                    foreach (var dish in allocations)
                        values[AllocationStartColumn + columnByBatch[dish.Batch.Document.BatchId]] = dish.First.Servings.ToString(CultureInfo.InvariantCulture);
                }
            }
            if (index < ingredients.Length)
            {
                var ingredientIndex = ingredientOrder[index];
                var line = ingredients[ingredientIndex];
                values[2] = $"{line.IngredientName} ({(string.IsNullOrWhiteSpace(line.UnitName) ? "Chưa rõ ĐVT" : line.UnitName)})";
                values[3] = line.BomQuantityPerServing?.ToString("0.############################", CultureInfo.InvariantCulture) ?? "Chưa đủ dữ liệu";
                var total = recipe.Dishes.Sum(dish => dish.Ingredients[ingredientIndex].TotalRequiredQuantity);
                values[4] = total.ToString("0.######", CultureInfo.InvariantCulture);
            }
            if (vertical && index < allocations.Length)
            {
                var dish = allocations[index];
                values[AllocationStartColumn] = $"{labels[columnByBatch[dish.Batch.Document.BatchId]]} · {dish.First.Servings}";
            }
            var height = index == 0 ? Math.Max(25, mergedHeight - 24 * (rowCount - 1)) : 24;
            if (values[2] is { } ingredient) height = Math.Max(height, WrappedHeight(ingredient, 26));
            if (vertical && values[AllocationStartColumn] is { } allocation) height = Math.Max(height, WrappedHeight(allocation, 19));
            rows.Add((values, height));
        }
        reserveBlock(rows.Sum(row => row.Height));
        var firstRow = rowNumber;
        for (var index = 0; index < rows.Count; index++)
            WriteRow(xml, rowNumber++, rows[index].Values, (shaded ? 4 : 2) + (index == 0 ? 1 : 0),
                rows[index].Height, centerCustomerColumns: !vertical);
        if (rows.Count > 1)
            foreach (var column in Enumerable.Range(0, noteCol + 1).Where(i => i is 0 or 1 || i == noteCol || !vertical && i >= AllocationStartColumn))
                merges.Add($"{Col(column)}{firstRow}:{Col(column)}{rowNumber - 1}");
    }

    private static int WrappedHeight(string text, int charactersPerLine) =>
        Math.Min(409, 6 + 15 * text.Split('\n').Sum(line => Math.Max(1, (line.Length + charactersPerLine - 1) / charactersPerLine)));

    private static void WriteRow(StringBuilder xml, int row, string?[] values, int style, int height, bool centerCustomerColumns = false)
    {
        if (row > 1_048_576) throw new ArgumentException("Phiếu nấu vượt giới hạn số dòng Excel. Hãy thu hẹp phạm vi xuất.");
        xml.Append($"<row r=\"{row}\" ht=\"{height}\" customHeight=\"1\">");
        var isDish = style is >= 2 and <= 5;
        for (var index = 0; index < values.Length; index++)
        {
            var reference = $"{Col(index)}{row}";
            var value = values[index] ?? "";
            var cellStyle = isDish && (index is 0 or 1 || centerCustomerColumns && index >= AllocationStartColumn && index < values.Length - 1)
                ? style + 4 : style;
            if (isDish && index is not (0 or 2) && index != values.Length - 1
                && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out _))
                xml.Append($"<c r=\"{reference}\" t=\"n\" s=\"{cellStyle}\"><v>{value}</v></c>");
            else
                xml.Append($"<c r=\"{reference}\" t=\"inlineStr\" s=\"{cellStyle}\"><is><t>{SecurityElement.Escape(value)}</t></is></c>");
        }
        xml.Append("</row>");
    }

    private static char Col(int index) => (char)('A' + index);
}
