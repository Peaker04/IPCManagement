namespace IPCManagement.Api.Models.DTOs.Workflow;

public class GenerateMaterialDemandRequestDto
{
    public string ServiceDate { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string Scope { get; set; } = "FULLDAY";
}

public class MaterialDemandResultDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    public string RequestCode { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int ProductionPlanLineCount { get; set; }
    public IReadOnlyList<MaterialDemandLineDto> Lines { get; set; } = [];
    public IReadOnlyList<MissingBomDishDto> MissingBomDishes { get; set; } = [];
}

public class MissingBomDishDto
{
    public string DishId { get; set; } = string.Empty;
    public string DishCode { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string CustomerCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string MenuId { get; set; } = string.Empty;
    public string MenuName { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public int TotalServings { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class MaterialDemandLineDto
{
    public string MaterialRequestLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public string DishId { get; set; } = string.Empty;
    public string DishName { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public int TotalServings { get; set; }
    public decimal GrossQtyPerServing { get; set; }
    public decimal BomRatePercent { get; set; }
    public decimal TotalRequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal SuggestedPurchaseQty { get; set; }
}
