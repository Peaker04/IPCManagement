namespace IPCManagement.Application.DTOs.Warehouse;

public class WarehouseDto
{
    public string WarehouseId { get; set; } = string.Empty;
    public string WarehouseCode { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public string? WarehouseType { get; set; }
    public string? Note { get; set; }
}
