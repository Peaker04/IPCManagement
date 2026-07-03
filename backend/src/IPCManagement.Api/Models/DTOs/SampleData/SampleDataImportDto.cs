namespace IPCManagement.Api.Models.DTOs.SampleData;

public class SampleDataImportRequestDto
{
    public string? SourceDirectory { get; set; }
    public bool DryRun { get; set; } = true;
    public int? MaxRows { get; set; }
}

public class SampleDataImportResultDto
{
    public bool DryRun { get; set; }
    public string SourceDirectory { get; set; } = string.Empty;
    public List<SampleDataFileResultDto> Files { get; set; } = [];
    public SampleDataImportCountsDto Counts { get; set; } = new();
    public List<string> Warnings { get; set; } = [];
    public Dictionary<string, ImportedDayMenuDto> ImportedWeeklyMenu { get; set; } = new();
}

public class CoordinationCustomerOptionDto
{
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
}

public class WeeklyMenuImportResultDto
{
    public bool Committed { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly? WeekStartDate { get; set; }
    public DateOnly? WeekEndDate { get; set; }
    public string? MenuVersionId { get; set; }
    public int? MenuVersionNo { get; set; }
    public string? MenuVersionStatus { get; set; }
    public string? PublishedBy { get; set; }
    public string? PublishedAt { get; set; }
    public string? SourceImportBatch { get; set; }
    public WeeklyMenuImportLayoutDto DetectedLayout { get; set; } = new();
    public SampleDataImportCountsDto Counts { get; set; } = new();
    public List<string> Warnings { get; set; } = [];
    public WeeklyMenuImportValidationDto Validation { get; set; } = new();
    public List<WeeklyMenuImportRowDto> Rows { get; set; } = [];
    public WeeklyMenuImportDiffDto PreviewDiff { get; set; } = new();
    public Dictionary<string, ImportedDayMenuDto> ImportedWeeklyMenu { get; set; } = new();
}

public class WeeklyMenuImportValidationDto
{
    public bool IsValid { get; set; } = true;
    public bool HasCriticalErrors { get; set; }
    public int ErrorCount { get; set; }
    public int WarningCount { get; set; }
    public List<WeeklyMenuImportValidationIssueDto> Issues { get; set; } = [];
}

public class WeeklyMenuImportValidationIssueDto
{
    public string Severity { get; set; } = "info";
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? SheetName { get; set; }
    public int? RowNumber { get; set; }
    public string? Column { get; set; }
    public string? Cell { get; set; }
    public string? Field { get; set; }
}

public class WeeklyMenuImportLayoutDto
{
    public string SheetName { get; set; } = string.Empty;
    public string LabelColumn { get; set; } = string.Empty;
    public List<WeeklyMenuImportColumnDto> DayColumns { get; set; } = [];
    public List<string> Sections { get; set; } = [];
    public int RowsScanned { get; set; }
    public int RowsImported { get; set; }
    public int RowsSkipped { get; set; }
}

public class WeeklyMenuImportColumnDto
{
    public string Column { get; set; } = string.Empty;
    public DateOnly ServiceDate { get; set; }
    public string Label { get; set; } = string.Empty;
}

public class WeeklyMenuImportRowDto
{
    public DateOnly ServiceDate { get; set; }
    public string DayKey { get; set; } = string.Empty;
    public int SourceRowNumber { get; set; }
    public string SourceColumn { get; set; } = string.Empty;
    public string SourceSection { get; set; } = string.Empty;
    public string SourceShift { get; set; } = string.Empty;
    public string DbShiftName { get; set; } = string.Empty;
    public string Variant { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public string SlotLabel { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public int RowSpan { get; set; } = 1;
    public bool IsMergedContinuation { get; set; }
    public string? DishId { get; set; }
    public bool ExistingDish { get; set; }
}

public class WeeklyMenuImportDiffDto
{
    public int AddedSlots { get; set; }
    public int ChangedSlots { get; set; }
    public int RemovedSlots { get; set; }
    public int UnchangedSlots { get; set; }
    public List<WeeklyMenuImportDiffRowDto> Rows { get; set; } = [];
}

public class WeeklyMenuImportDiffRowDto
{
    public string ServiceDate { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string Variant { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public string? CurrentDishName { get; set; }
    public string? ImportedDishName { get; set; }
    public string ChangeType { get; set; } = string.Empty;
}

public class ImportedDayMenuDto
{
    public ImportedMenuSlotDto MorningSavory { get; set; } = new();
    public ImportedMenuSlotDto MorningVegetarian { get; set; } = new();
    public ImportedMenuSlotDto AfternoonSavory { get; set; } = new();
    public ImportedMenuSlotDto AfternoonVegetarian { get; set; } = new();
}

public class ImportedCustomComponentsDto
{
    public string? Main { get; set; }
    public string? Sub1 { get; set; }
    public string? Sub2 { get; set; }
    public string? Rau { get; set; }
    public string? Canh { get; set; }
    public string? Fruit { get; set; }
    public string? Dessert { get; set; }
}

public class ImportedMenuSlotDto
{
    public string DishId { get; set; } = string.Empty;
    public int Portions { get; set; }
    public ImportedCustomComponentsDto CustomComponents { get; set; } = new();
}

public class SampleDataFileResultDto
{
    public string FileName { get; set; } = string.Empty;
    public string Domain { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int RowsScanned { get; set; }
    public int RowsImported { get; set; }
    public int RowsSkipped { get; set; }
}

public class SampleDataImportCountsDto
{
    public int RolesCreated { get; set; }
    public int UsersCreated { get; set; }
    public int CustomersCreated { get; set; }
    public int CustomersUpdated { get; set; }
    public int SuppliersCreated { get; set; }
    public int SuppliersUpdated { get; set; }
    public int WarehousesCreated { get; set; }
    public int UnitsCreated { get; set; }
    public int IngredientsCreated { get; set; }
    public int IngredientsUpdated { get; set; }
    public int DishesCreated { get; set; }
    public int DishesUpdated { get; set; }
    public int BomLinesCreated { get; set; }
    public int BomLinesUpdated { get; set; }
    public int MenusCreated { get; set; }
    public int MenusUpdated { get; set; }
    public int MenuItemsCreated { get; set; }
    public int MenuItemsUpdated { get; set; }
    public int MenuSchedulesCreated { get; set; }
    public int MenuSchedulesUpdated { get; set; }
    public int QuantityImportBatchesCreated { get; set; }
    public int MealQuantityPlansCreated { get; set; }
    public int MealQuantityPlansUpdated { get; set; }
    public int MealQuantityPlanLinesCreated { get; set; }
    public int MealQuantityPlanLinesUpdated { get; set; }
    public int InventoryReceiptsCreated { get; set; }
    public int InventoryReceiptsUpdated { get; set; }
    public int InventoryReceiptLinesCreated { get; set; }
    public int InventoryReceiptLinesUpdated { get; set; }
    public int StockMovementsCreated { get; set; }
    public int StockMovementsUpdated { get; set; }
    public int CurrentStockRowsCreated { get; set; }
    public int CurrentStockRowsUpdated { get; set; }
}

public class CustomerImportMappingDto
{
    public string CustomerId { get; set; } = string.Empty;
    public string? SheetNameHint { get; set; }
    public string? LabelColumn { get; set; }
}

public class SaveCustomerImportMappingDto
{
    public string? SheetNameHint { get; set; }
    public string? LabelColumn { get; set; }
}

public class WeeklyMenuImportHistoryItemDto
{
    public string MenuVersionId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public DateOnly WeekStartDate { get; set; }
    public int VersionNo { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? SourceFileName { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime CreatedAt { get; set; }
    public int SuccessRowCount { get; set; }
    public int ErrorRowCount { get; set; }
    public int WarningRowCount { get; set; }
    public bool CanRollback { get; set; }
    public string? CannotRollbackReason { get; set; }
}

public class RollbackWeeklyMenuImportResultDto
{
    public string MenuVersionId { get; set; } = string.Empty;
    public int MenuSchedulesRemoved { get; set; }
}
