using System;

namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Source-line and unit snapshot of one immutable receipt correction line.
/// </summary>
public partial class ReceiptCorrectionLine
{
    public byte[] CorrectionLineId { get; set; } = null!;
    public byte[] CorrectionId { get; set; } = null!;
    public byte[] ReceiptLineId { get; set; } = null!;
    public byte[] IngredientId { get; set; } = null!;
    public byte[] UnitId { get; set; } = null!;
    public decimal Quantity { get; set; }
    public string? SourceLotNumber { get; set; }
    public DateOnly? SourceManufactureDate { get; set; }
    public DateOnly? SourceExpiredDate { get; set; }
}
