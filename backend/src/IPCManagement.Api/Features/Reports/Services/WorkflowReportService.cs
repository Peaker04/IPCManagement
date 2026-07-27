using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

public class WorkflowReportService : IWorkflowReportService
{
    private readonly IDataQualityReportService _dataQualityReportService;
    private readonly IDataQualityCommandService _dataQualityCommandService;
    private readonly IOperationalKpiReportService _operationalKpiReportService;

    public WorkflowReportService(IpcManagementContext context)
        : this(context, new StockLedgerReportService(context))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService)
        : this(
            context,
            stockLedgerReportService,
            new DataQualityReportService(context, stockLedgerReportService))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IDataQualityReportService dataQualityReportService)
        : this(
            context,
            stockLedgerReportService,
            dataQualityReportService,
            new DataQualityCommandService(context, stockLedgerReportService))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IDataQualityReportService dataQualityReportService,
        IDataQualityCommandService dataQualityCommandService)
        : this(
            context,
            stockLedgerReportService,
            dataQualityReportService,
            dataQualityCommandService,
            new OperationalKpiReportService(context, dataQualityReportService))
    {
    }

    public WorkflowReportService(
        IpcManagementContext context,
        IStockLedgerReportService stockLedgerReportService,
        IDataQualityReportService dataQualityReportService,
        IDataQualityCommandService dataQualityCommandService,
        IOperationalKpiReportService operationalKpiReportService)
    {
        _dataQualityReportService = dataQualityReportService;
        _dataQualityCommandService = dataQualityCommandService;
        _operationalKpiReportService = operationalKpiReportService;
    }

    public Task<DataQualityReportDto> GetDataQualityAsync(WorkflowReportQueryDto query)
        => _dataQualityReportService.GetDataQualityAsync(query);

    public Task<DataQualityPageDto> GetDataQualityPageAsync(DataQualityPageQueryDto query)
        => _dataQualityReportService.GetDataQualityPageAsync(query);

    public Task<DataQualityIssueRemediationDto> UpdateDataQualityIssueRemediationAsync(
        DataQualityIssueRemediationRequest request,
        string actorUserId)
        => _dataQualityCommandService.UpdateDataQualityIssueRemediationAsync(request, actorUserId);

    public Task<DataQualityCleanupResultDto> CleanupDataQualityAsync(
        DataQualityCleanupRequest request,
        string actorUserId)
        => _dataQualityCommandService.CleanupDataQualityAsync(request, actorUserId);

    public Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(int? criticalDataQualityCount = null)
        => _operationalKpiReportService.GetOperationalKpisAsync(criticalDataQualityCount);

}
