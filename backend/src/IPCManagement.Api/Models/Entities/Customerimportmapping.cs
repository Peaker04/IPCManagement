using System;

namespace IPCManagement.Api.Models.Entities;

/// <summary>
/// Cấu hình mapping cột/sheet Excel đã lưu cho 1 khách hàng, dùng để ưu tiên
/// thay cho dò tự động (ParseWeeklyMenuWorkbook) khi khách hàng đó có mẫu file riêng.
/// </summary>
public class Customerimportmapping
{
    public byte[]   MappingId     { get; set; } = null!;
    public byte[]   CustomerId    { get; set; } = null!;
    public string?  SheetNameHint { get; set; }
    public string?  LabelColumn   { get; set; }
    public DateTime CreatedAt     { get; set; }
    public DateTime UpdatedAt     { get; set; }

    public virtual Customer Customer { get; set; } = null!;
}
