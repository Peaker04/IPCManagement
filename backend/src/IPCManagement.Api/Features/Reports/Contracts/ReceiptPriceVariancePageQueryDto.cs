using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Contracts;

public sealed class ReceiptPriceVariancePageQueryDto : WorkflowReportPageQueryDto
{
    public string? SearchKeyword { get; set; }
}
