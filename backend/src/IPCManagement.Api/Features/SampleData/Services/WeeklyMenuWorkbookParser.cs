using System.Globalization;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class WeeklyMenuWorkbookParser
{
    internal static WeeklyMenuImportPlan Parse(
        XlsxWorkbookReader reader,
        string workbookPath,
        string originalFileName,
        DateOnly? weekStartFallback,
        CustomerImportMapping? mapping = null,
        decimal? priceTierAmount = null)
    {
        var sheetCandidates = reader.GetSheetNames(workbookPath)
            .Select(sheetName =>
            {
                var rawRows = reader.ReadRowsWithMetadata(workbookPath, sheetName, 240);
                var rows = rawRows.Select(row => row.Cells).ToList();
                return new SheetCandidate(sheetName, rawRows, rows, ScoreMenuSheet(sheetName, rows));
            })
            .ToList();
        var sheetsMatchingHint = string.IsNullOrWhiteSpace(mapping?.SheetNameHint)
            ? []
            : sheetCandidates
                .Where(candidate => candidate.SheetName.Contains(mapping.SheetNameHint, StringComparison.OrdinalIgnoreCase))
                .ToList();
        var sheetsMatchingPriceTier = priceTierAmount is null
            ? []
            : sheetCandidates
                .Where(candidate => SheetNameMatchesPriceTier(candidate.SheetName, priceTierAmount.Value))
                .ToList();
        var candidatePool = ResolveCandidatePool(
            sheetCandidates,
            sheetsMatchingHint,
            sheetsMatchingPriceTier,
            mapping?.SheetNameHint,
            priceTierAmount);
        var best = candidatePool.OrderByDescending(candidate => candidate.Score).FirstOrDefault();
        if (best is null || best.Score < 20)
        {
            throw new BusinessRuleException("File Excel không có bảng thực đơn tuần hợp lệ.");
        }

        var labelColumn = !string.IsNullOrWhiteSpace(mapping?.LabelColumn)
            ? mapping.LabelColumn
            : DetectLabelColumn(best.Rows);
        if (labelColumn is null)
        {
            throw new BusinessRuleException("Không xác định được cột nhãn món trong file thực đơn.");
        }

        var weekStart = WeeklyMenuWorkbookLayoutPolicy.ExtractWeekStart(best.Rows, originalFileName, weekStartFallback);
        var dayColumns = WeeklyMenuWorkbookLayoutPolicy.DetectDayColumns(
            best.Rows,
            labelColumn,
            weekStart,
            weekStartFallback);
        if (dayColumns.Count == 0)
        {
            throw new BusinessRuleException("Không xác định được cột ngày. Vui lòng nhập ngày bắt đầu tuần rồi thử lại.");
        }

        var plan = new WeeklyMenuImportPlan(
            originalFileName,
            best.SheetName,
            labelColumn,
            dayColumns.Min(item => item.ServiceDate),
            dayColumns.Max(item => item.ServiceDate),
            best.Rows.Count,
            dayColumns,
            weekStartFallback);
        ParseMenuRows(best.RawRows, labelColumn, dayColumns, plan);
        if (plan.Items.Count == 0)
        {
            if (priceTierAmount is not null)
            {
                throw new BusinessRuleException(
                    $"Sheet {best.SheetName} cho định mức {priceTierAmount / 1000m:0}k chưa có món. " +
                    "Mỗi khách hàng trong một tuần chỉ được nhập dữ liệu vào đúng sheet đơn giá đã chọn.");
            }

            throw new BusinessRuleException("File Excel không có dòng món ăn hợp lệ để import.");
        }

        WeeklyMenuImportValidationPolicy.AddDuplicateWarnings(plan);
        return plan;
    }

    private static IReadOnlyList<SheetCandidate> ResolveCandidatePool(
        IReadOnlyList<SheetCandidate> sheetCandidates,
        IReadOnlyList<SheetCandidate> sheetsMatchingHint,
        IReadOnlyList<SheetCandidate> sheetsMatchingPriceTier,
        string? sheetNameHint,
        decimal? priceTierAmount)
    {
        if (priceTierAmount is not null && !string.IsNullOrWhiteSpace(sheetNameHint))
        {
            var customerTierSheets = sheetsMatchingPriceTier
                .Where(candidate => candidate.SheetName.Contains(sheetNameHint, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (customerTierSheets.Count == 0)
            {
                throw new BusinessRuleException(
                    $"File Excel không có sheet {sheetNameHint} cho định mức {priceTierAmount / 1000m:0}k. " +
                    "Vui lòng dùng đúng file mẫu đã tải theo khách hàng.");
            }

            return customerTierSheets;
        }

        if (priceTierAmount is not null)
        {
            if (sheetsMatchingPriceTier.Count == 0)
            {
                throw new BusinessRuleException(
                    $"File Excel không có sheet cho định mức {priceTierAmount / 1000m:0}k.");
            }

            return sheetsMatchingPriceTier;
        }

        return sheetsMatchingHint.Count > 0 ? sheetsMatchingHint : sheetCandidates;
    }

    private static bool SheetNameMatchesPriceTier(string sheetName, decimal priceTierAmount)
    {
        var normalized = WeeklyMenuWorkbookSyntaxPolicy.NormalizeText(sheetName);
        var rounded = DecimalPolicy.RoundMoney(priceTierAmount);
        var tierInThousands = rounded / 1000m;
        return normalized.Contains(rounded.ToString("0", CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase) ||
               normalized.Contains($"{tierInThousands:0}K", StringComparison.OrdinalIgnoreCase);
    }

    private static int ScoreMenuSheet(
        string sheetName,
        IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        var score = WeeklyMenuWorkbookSyntaxPolicy.NormalizeText(sheetName)
            .Contains("MENU", StringComparison.OrdinalIgnoreCase) ? 8 : 0;
        foreach (var value in rows.Take(80).SelectMany(row => row.Values))
        {
            if (WeeklyMenuWorkbookSyntaxPolicy.IsSection(value))
            {
                score += 15;
            }
            else if (WeeklyMenuWorkbookSyntaxPolicy.ResolveSlot(value) is not null)
            {
                score += 3;
            }
            else if (WeeklyMenuWorkbookLayoutPolicy.ParseImportDate(value) is not null ||
                     WeeklyMenuWorkbookLayoutPolicy.ContainsWeekdayLabel(value))
            {
                score += 1;
            }
        }

        return score;
    }

    private static string? DetectLabelColumn(IReadOnlyList<IReadOnlyDictionary<string, string>> rows)
    {
        var scores = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows.Take(80))
        {
            foreach (var (column, value) in row)
            {
                var points = WeeklyMenuWorkbookSyntaxPolicy.IsSection(value) ? 20 : 0;
                if (WeeklyMenuWorkbookSyntaxPolicy.ResolveSlot(value) is not null)
                {
                    points += 8;
                }

                if (points > 0)
                {
                    scores[column] = scores.GetValueOrDefault(column) + points;
                }
            }
        }

        return scores.Count == 0
            ? null
            : scores.OrderByDescending(item => item.Value)
                .ThenBy(item => WeeklyMenuWorkbookLayoutPolicy.ColumnLetterToIndex(item.Key))
                .First()
                .Key;
    }

    private static void ParseMenuRows(
        IReadOnlyList<XlsxWorkbookReader.XlsxRowData> rows,
        string labelColumn,
        IReadOnlyList<WeeklyMenuImportDayColumn> dayColumns,
        WeeklyMenuImportPlan plan)
    {
        WeeklyMenuSection? currentSection = null;
        var sourceOrder = 0;
        foreach (var row in rows)
        {
            var label = WeeklyMenuWorkbookSyntaxPolicy.GetColumnValue(row.Cells, labelColumn);
            if (string.IsNullOrWhiteSpace(label))
            {
                plan.RowsSkipped++;
                continue;
            }

            if (WeeklyMenuWorkbookSyntaxPolicy.TryParseSection(label, out var section))
            {
                currentSection = section;
                if (!plan.Sections.Contains(section.SectionLabel, StringComparer.OrdinalIgnoreCase))
                {
                    plan.Sections.Add(section.SectionLabel);
                }

                if (!string.Equals(section.SourceShift, section.DbShiftName, StringComparison.OrdinalIgnoreCase))
                {
                    AddWarning(
                        plan,
                        $"Quy đổi ca {section.SourceShiftLabel} sang {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(section.DbShiftName)} vì DB hiện chỉ có ca sáng/chiều.");
                }

                continue;
            }

            if (currentSection is null)
            {
                plan.RowsSkipped++;
                continue;
            }

            var slot = WeeklyMenuWorkbookSyntaxPolicy.ResolveSlot(label);
            if (slot is null)
            {
                plan.RowsSkipped++;
                continue;
            }

            if (IsHorizontallyMergedLabelRow(row, labelColumn))
            {
                continue;
            }

            foreach (var dayColumn in dayColumns)
            {
                var dishName = WeeklyMenuWorkbookSyntaxPolicy.NormalizeDishCell(
                    WeeklyMenuWorkbookSyntaxPolicy.GetColumnValue(row.Cells, dayColumn.Column));
                if (string.IsNullOrWhiteSpace(dishName))
                {
                    continue;
                }

                if (WeeklyMenuWorkbookSyntaxPolicy.IsHolidayCell(dishName))
                {
                    plan.RowsSkipped++;
                    continue;
                }

                plan.Items.Add(new ParsedWeeklyMenuItem
                {
                    SourceOrder = ++sourceOrder,
                    ServiceDate = dayColumn.ServiceDate,
                    DayKey = dayColumn.DayKey,
                    SourceRowNumber = row.RowNumber,
                    SourceColumn = dayColumn.Column,
                    SectionLabel = currentSection.SectionLabel,
                    SectionKey = currentSection.SectionKey,
                    SourceShift = currentSection.SourceShift,
                    SourceShiftLabel = currentSection.SourceShiftLabel,
                    DbShiftName = currentSection.DbShiftName,
                    VariantKey = currentSection.VariantKey,
                    VariantLabel = currentSection.VariantLabel,
                    Slot = slot,
                    SlotLabel = label.Trim(),
                    DishName = dishName,
                    RowSpan = ResolveMergedRowSpan(row, dayColumn.Column),
                    IsMergedContinuation = IsMergedContinuation(row, dayColumn.Column)
                });
            }
        }
    }

    private static bool IsHorizontallyMergedLabelRow(XlsxWorkbookReader.XlsxRowData row, string labelColumn)
        => row.MergeInfo.TryGetValue(labelColumn, out var mergeInfo) &&
           mergeInfo.IsStart &&
           mergeInfo.ColumnSpan > 1;

    private static int ResolveMergedRowSpan(XlsxWorkbookReader.XlsxRowData row, string column)
        => row.MergeInfo.TryGetValue(column, out var mergeInfo) && mergeInfo.ColumnSpan == 1 && mergeInfo.IsStart
            ? mergeInfo.RowSpan
            : 1;

    private static bool IsMergedContinuation(XlsxWorkbookReader.XlsxRowData row, string column)
        => row.MergeInfo.TryGetValue(column, out var mergeInfo) &&
           mergeInfo.ColumnSpan == 1 &&
           !mergeInfo.IsStart &&
           string.Equals(mergeInfo.StartColumn, column, StringComparison.OrdinalIgnoreCase);

    private static void AddWarning(WeeklyMenuImportPlan plan, string warning)
    {
        if (!plan.Warnings.Contains(warning, StringComparer.OrdinalIgnoreCase))
        {
            plan.Warnings.Add(warning);
        }
    }

    private sealed record SheetCandidate(
        string SheetName,
        IReadOnlyList<XlsxWorkbookReader.XlsxRowData> RawRows,
        IReadOnlyList<IReadOnlyDictionary<string, string>> Rows,
        int Score);
}
