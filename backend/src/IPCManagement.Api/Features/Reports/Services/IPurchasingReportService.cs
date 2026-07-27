using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IPurchasingReportService
{
    Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query);
    Task<IReadOnlyList<PurchasePlanReportDto>> GetPurchasePlanAsync(WorkflowReportQueryDto query);
    Task<PurchasePlanPageDto> GetPurchasePlanPageAsync(PurchasePlanPageQueryDto query);
    Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query);
}
