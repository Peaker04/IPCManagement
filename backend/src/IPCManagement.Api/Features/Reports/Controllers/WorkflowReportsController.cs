using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/workflow-reports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class WorkflowReportsController : ControllerBase
{
    private readonly IDataQualityReportService _dataQualityReportService;
    private readonly IDataQualityCommandService _dataQualityCommandService;
    private readonly IOperationalKpiReportService _operationalKpiReportService;
    private readonly IWorkflowReportAggregateCache _aggregateCache;
    private readonly ICurrentUserService _currentUserService;

    public WorkflowReportsController(
        IDataQualityReportService dataQualityReportService,
        IDataQualityCommandService dataQualityCommandService,
        IOperationalKpiReportService operationalKpiReportService,
        IWorkflowReportAggregateCache aggregateCache,
        ICurrentUserService currentUserService)
    {
        _dataQualityReportService = dataQualityReportService;
        _dataQualityCommandService = dataQualityCommandService;
        _operationalKpiReportService = operationalKpiReportService;
        _aggregateCache = aggregateCache;
        _currentUserService = currentUserService;
    }

    [HttpGet("operational-kpis")]
    [ProducesResponseType(typeof(ApiResponse<OperationalKpiSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOperationalKpisAsync()
    {
        var result = await _aggregateCache.GetOperationalKpisAsync(async () =>
        {
            var dataQuality = await _aggregateCache.GetDataQualitySnapshotAsync(
                new WorkflowReportQueryDto(),
                _dataQualityReportService.GetDataQualityAsync);
            return await _operationalKpiReportService.GetOperationalKpisAsync(dataQuality.ErrorCount);
        });

        return Ok(ApiResponse<OperationalKpiSummaryDto>.SuccessResult(result));
    }

    [HttpGet("data-quality")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDataQualityAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<DataQualityReportDto>.SuccessResult(
            await _dataQualityReportService.GetDataQualityAsync(query)));

    [HttpGet("data-quality/page")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityPageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDataQualityPageAsync([FromQuery] DataQualityPageQueryDto query)
    {
        var snapshot = await _aggregateCache.GetDataQualitySnapshotAsync(
            query,
            _dataQualityReportService.GetDataQualityAsync);
        var pageItems = snapshot.Issues
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();
        var result = new DataQualityPageDto
        {
            GeneratedAt = snapshot.GeneratedAt,
            TotalIssues = snapshot.TotalIssues,
            IsTruncated = snapshot.IsTruncated,
            ErrorCount = snapshot.ErrorCount,
            WarningCount = snapshot.WarningCount,
            ResolvedIssueCount = snapshot.ResolvedIssueCount,
            ReopenedIssueCount = snapshot.ReopenedIssueCount,
            UrgentIssueCount = snapshot.UrgentIssueCount,
            MissingBomCount = snapshot.MissingBomCount,
            InvalidUnitCount = snapshot.InvalidUnitCount,
            MissingConversionCount = snapshot.MissingConversionCount,
            NegativeStockCount = snapshot.NegativeStockCount,
            OrphanDocumentCount = snapshot.OrphanDocumentCount,
            Issues = pageItems,
            Page = PagedResponseDto<DataQualityIssueDto>.Create(
                pageItems,
                snapshot.TotalIssues,
                query.PageNumber,
                query.PageSize)
        };

        return Ok(ApiResponse<DataQualityPageDto>.SuccessResult(result));
    }

    [HttpPost("data-quality/issues/remediation")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityIssueRemediationDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> UpdateDataQualityIssueRemediationAsync([FromBody] DataQualityIssueRemediationRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await _dataQualityCommandService.UpdateDataQualityIssueRemediationAsync(request, userId);
            _aggregateCache.Invalidate();
            return Ok(ApiResponse<DataQualityIssueRemediationDto>.SuccessResult(result, "Đã cập nhật trạng thái xử lý data-quality issue."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("data-quality/cleanup")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityCleanupResultDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> CleanupDataQualityAsync([FromBody] DataQualityCleanupRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await _dataQualityCommandService.CleanupDataQualityAsync(request, userId);
            if (!result.DryRun)
            {
                _aggregateCache.Invalidate();
            }
            var message = result.DryRun
                ? "Đã quét dữ liệu có thể dọn, chưa thay đổi dữ liệu."
                : "Đã dọn dữ liệu mồ côi/stale theo chính sách data-quality.";

            return Ok(ApiResponse<DataQualityCleanupResultDto>.SuccessResult(result, message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ApiResponse.FailResult(ex.Message));
        }
    }
}
