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
