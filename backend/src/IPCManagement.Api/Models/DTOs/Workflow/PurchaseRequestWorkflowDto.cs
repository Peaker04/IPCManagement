namespace IPCManagement.Api.Models.DTOs.Workflow;

public class GeneratePurchaseRequestFromDemandDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
}

public class PurchaseRequestWorkflowResultDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
    public string PurchaseRequestCode { get; set; } = string.Empty;
    public string MaterialRequestId { get; set; } = string.Empty;
    public string PurchaseForDate { get; set; } = string.Empty;
    public string? ShiftName { get; set; }
    public string Status { get; set; } = string.Empty;
    public IReadOnlyList<PurchaseRequestWorkflowLineDto> Lines { get; set; } = [];
}

public class PurchaseRequestWorkflowLineDto
{
    public string PurchaseRequestLineId { get; set; } = string.Empty;
    public string MaterialRequestLineId { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string IngredientName { get; set; } = string.Empty;
    public string? SupplierId { get; set; }
    public string? SupplierName { get; set; }
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal RequiredQty { get; set; }
    public decimal CurrentStockQty { get; set; }
    public decimal PurchaseQty { get; set; }
    public decimal EstimatedUnitPrice { get; set; }
    public string? ExpectedDeliveryDate { get; set; }
    public string? Note { get; set; }
}

public class ConfirmPurchaseRequestDto
{
    public string PurchaseRequestId { get; set; } = string.Empty;
    public string WarehouseId { get; set; } = string.Empty;
}

public class PurchaseWorkbenchQueryDto
{
    public string Week { get; set; } = string.Empty;
    public string? Date { get; set; }
    public string? Stage { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 8;
}

public class PurchaseWorkbenchWeekDto
{
    public string WeekStart { get; set; } = string.Empty;
    public string WeekEnd { get; set; } = string.Empty;
    public string? SelectedDate { get; set; }
    public string? SelectedStage { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalItems { get; set; }
    public int TotalPages { get; set; }
    public PurchaseWorkflowStageCountsDto StageCounts { get; set; } = new();
    public IReadOnlyList<PurchaseWorkbenchServiceDateDto> ServiceDates { get; set; } = [];
}

public class PurchaseWorkbenchServiceDateDto
{
    public string ServiceDate { get; set; } = string.Empty;
    public string Scope { get; set; } = "FULLDAY";
    public string CurrentStage { get; set; } = string.Empty;
    public int ApprovedDemandCount { get; set; }
    public int ShortageLineCount { get; set; }
    public int SupplierReadyLineCount { get; set; }
    public int BlockingExceptionCount { get; set; }
    public string? PurchaseRequestId { get; set; }
    public string? PurchaseRequestCode { get; set; }
    public string? PurchaseRequestStatus { get; set; }
    public int OrderCount { get; set; }
    public int ReceivingLineCount { get; set; }
    public int FullyReceivedLineCount { get; set; }
    public IReadOnlyList<ApprovedDemandSummaryDto> ApprovedDemands { get; set; } = [];
}

public class PurchaseWorkflowStageCountsDto
{
    public int Demand { get; set; }
    public int SupplierPrice { get; set; }
    public int Exception { get; set; }
    public int SubmittedRequest { get; set; }
    public int ApprovedOrder { get; set; }
    public int ReceivingProgress { get; set; }
}

public class ApprovedDemandSummaryDto
{
    public string MaterialRequestId { get; set; } = string.Empty;
    public string RequestCode { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string Scope { get; set; } = "FULLDAY";
    public string Status { get; set; } = string.Empty;
    public int ShortageLineCount { get; set; }
    public string CurrentStage { get; set; } = string.Empty;
    public string? PurchaseRequestId { get; set; }
    public string? PurchaseRequestCode { get; set; }
    public string? PurchaseRequestStatus { get; set; }
}
