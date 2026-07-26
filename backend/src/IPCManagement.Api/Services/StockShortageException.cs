using IPCManagement.Api.Models.DTOs.Inventory;

namespace IPCManagement.Api.Services;

public class StockShortageException : InvalidOperationException
{
    public StockShortageException(StockShortageIssueDto shortage)
        : base("Không đủ tồn kho để tạo phiếu xuất.")
    {
        Shortage = shortage;
    }

    public StockShortageIssueDto Shortage { get; }
}
