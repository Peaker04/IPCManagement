using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Models.DTOs.Supplier;

public class SupplierDto
{
    public string SupplierId { get; set; } = string.Empty;
    public string? SupplierCode { get; set; }
    public string? SupplierName { get; set; }
}

public class CreateSupplierDto
{
    [Required]
    [MaxLength(50)]
    public string SupplierCode { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string SupplierName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? ContactName { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(255)]
    public string? Address { get; set; }
}
