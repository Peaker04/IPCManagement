
using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public class StockShortageException : InvalidOperationException
{
    public StockShortageException(StockShortageIssueDto shortage)
        : base("Không đủ tồn kho để tạo phiếu xuất.")
    {
        Shortage = shortage;
    }

    public StockShortageIssueDto Shortage { get; }
}
