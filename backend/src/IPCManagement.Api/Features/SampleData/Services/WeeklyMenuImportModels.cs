namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed record WeeklyMenuImportDayColumn(
    string Column,
    DateOnly ServiceDate,
    string DayKey,
    string Label,
    int? RowNumber);

internal sealed record WeeklyMenuSection(
    string SectionLabel,
    string SectionKey,
    string SourceShift,
    string SourceShiftLabel,
    string DbShiftName,
    string VariantKey,
    string VariantLabel);

internal sealed class WeeklyMenuImportPlan
{
    internal WeeklyMenuImportPlan(
        string fileName,
        string sheetName,
        string labelColumn,
        DateOnly weekStartDate,
        DateOnly weekEndDate,
        int rowsScanned,
        IReadOnlyList<WeeklyMenuImportDayColumn> dayColumns,
        DateOnly? requestedWeekStartDate)
    {
        FileName = fileName;
        SheetName = sheetName;
        LabelColumn = labelColumn;
        WeekStartDate = weekStartDate;
        WeekEndDate = weekEndDate;
        RowsScanned = rowsScanned;
        DayColumns = dayColumns;
        RequestedWeekStartDate = requestedWeekStartDate;
    }

    public string FileName { get; }
    public string SheetName { get; }
    public string LabelColumn { get; }
    public DateOnly WeekStartDate { get; }
    public DateOnly WeekEndDate { get; }
    public DateOnly? RequestedWeekStartDate { get; }
    public int RowsScanned { get; }
    public int RowsSkipped { get; set; }
    public string? SourceChecksum { get; set; }
    public IReadOnlyList<WeeklyMenuImportDayColumn> DayColumns { get; }
    public List<string> Sections { get; } = [];
    public List<string> Warnings { get; } = [];
    public List<ParsedWeeklyMenuItem> Items { get; } = [];
}

internal sealed class ParsedWeeklyMenuItem
{
    public int SourceOrder { get; set; }
    public DateOnly ServiceDate { get; set; }
    public string DayKey { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public string SourceColumn { get; set; } = string.Empty;
    public string SectionLabel { get; set; } = string.Empty;
    public string SectionKey { get; set; } = string.Empty;
    public string SourceShift { get; set; } = string.Empty;
    public string SourceShiftLabel { get; set; } = string.Empty;
    public string DbShiftName { get; set; } = string.Empty;
    public string VariantKey { get; set; } = string.Empty;
    public string VariantLabel { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public string SlotLabel { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public int RowSpan { get; set; } = 1;
    public bool IsMergedContinuation { get; set; }
    public string? DishId { get; set; }
    public bool ExistingDish { get; set; }
}
