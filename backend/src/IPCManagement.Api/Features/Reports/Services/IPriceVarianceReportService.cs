using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public interface IPriceVarianceReportService
{
    Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<ReceiptPriceVarianceReportDto>> GetReceiptPriceVariancePageAsync(ReceiptPriceVariancePageQueryDto query);
    Task<IReadOnlyList<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierPageAsync(PriceVarianceAggregatePageQueryDto query);
    Task<IReadOnlyList<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodPageAsync(PriceVarianceAggregatePageQueryDto query);
    Task<IReadOnlyList<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupAsync(WorkflowReportQueryDto query);
    Task<PagedResponseDto<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupPageAsync(PriceVarianceAggregatePageQueryDto query);
}
