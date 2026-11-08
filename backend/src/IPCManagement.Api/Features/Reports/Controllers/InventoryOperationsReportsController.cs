using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/workflow-reports")]
[Tags("WorkflowReports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class InventoryOperationsReportsController : ControllerBase
{
    private readonly IInventoryOperationsReportService _reportService;

    public InventoryOperationsReportsController(IInventoryOperationsReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("workflow-documents")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WorkflowDocumentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkflowDocumentsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<WorkflowDocumentDto>>.SuccessResult(
            await _reportService.GetWorkflowDocumentsAsync(query)));

    [HttpGet("kitchen-issues")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<KitchenIssueReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKitchenIssuesAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<KitchenIssueReportDto>>.SuccessResult(
            await _reportService.GetKitchenIssuesAsync(query)));

    [HttpGet("kitchen-issues/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<KitchenIssueReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetKitchenIssuesPageAsync([FromQuery] KitchenIssuePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<KitchenIssueReportDto>>.SuccessResult(
            await _reportService.GetKitchenIssuesPageAsync(query)));

    [HttpGet("issue-vs-return")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<IssueVsReturnUsageReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIssueVsReturnAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _reportService.GetIssueVsReturnAsync(query)));

    [HttpGet("issue-vs-return/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<IssueVsReturnUsageReportDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIssueVsReturnPageAsync([FromQuery] IssueVsReturnPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _reportService.GetIssueVsReturnPageAsync(query)));

    [HttpGet("supply-line-reconciliation")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SupplyLineReconciliationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSupplyLineReconciliationAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<SupplyLineReconciliationDto>>.SuccessResult(
            await _reportService.GetSupplyLineReconciliationAsync(query)));
}
