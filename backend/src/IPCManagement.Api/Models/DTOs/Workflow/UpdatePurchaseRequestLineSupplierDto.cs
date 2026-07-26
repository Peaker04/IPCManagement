namespace IPCManagement.Api.Models.DTOs.Workflow;

public class UpdatePurchaseRequestLineSupplierDto
{
    public string SupplierId { get; set; } = string.Empty;
    public decimal EstimatedUnitPrice { get; set; }
    public string? ExpectedDeliveryDate { get; set; }
    public string? Note { get; set; }
}
