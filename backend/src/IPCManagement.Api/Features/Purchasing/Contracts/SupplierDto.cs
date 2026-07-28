namespace IPCManagement.Api.Features.Purchasing.Contracts;

public class SupplierDto
{
    public string SupplierId { get; set; } = string.Empty;
    public string? SupplierCode { get; set; }
    public string? SupplierName { get; set; }
}
