namespace IPCManagement.Api.Features.Purchasing.Contracts;

public class UpdatePurchaseRequestLineSupplierDto
{
    public string SupplierId { get; set; } = string.Empty;
    public decimal EstimatedUnitPrice { get; set; }
    public string? ExpectedDeliveryDate { get; set; }
    public string? Note { get; set; }
}
