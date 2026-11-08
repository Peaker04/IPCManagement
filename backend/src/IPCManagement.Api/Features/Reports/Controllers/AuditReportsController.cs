using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
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
[SystemOperation("admin-data.audit", OperationDisposition.Retained)]
public class AuditReportsController : ControllerBase
{
    private readonly IAuditReportService _reportService;

    public AuditReportsController(IAuditReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("audit-changes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<AuditChangeReportDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GetAuditChangesAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<AuditChangeReportDto>>.SuccessResult(
            await _reportService.GetAuditChangesAsync(query)));

    [HttpGet("audit-changes/page")]
    [ProducesResponseType(typeof(ApiResponse<CursorPageDto<AuditChangeReportDto>>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GetAuditChangePageAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<AuditChangeReportDto>>.SuccessResult(
            await _reportService.GetAuditChangePageAsync(query)));

    [HttpGet("audit-changes/csv")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ExportAuditChangesCsvAsync([FromQuery] WorkflowReportQueryDto query)
    {
        var file = await _reportService.ExportAuditChangesCsvAsync(query);
        return File(file.Content, file.ContentType, file.FileName);
    }
}
