using System.Collections.Concurrent;
using System.Text.Json;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Controllers;

[ApiController]
[Route("api/workflow-reports")]
[Authorize]
[EnableRateLimiting("api-general")]
public class WorkflowReportsController : ControllerBase
{
    private static readonly TimeSpan AggregateCacheDuration = TimeSpan.FromSeconds(15);
    private const string OperationalKpisCacheKey = "workflow-reports:operational-kpis";
    private static long _dataQualityCacheVersion;
    private static readonly ConcurrentDictionary<string, Lazy<Task<object>>> AggregateCacheLoads = new();

    private readonly IWorkflowReportService _workflowReportService;
    private readonly ICurrentUserService _currentUserService;
    private readonly IMemoryCache _cache;

    public WorkflowReportsController(
        IWorkflowReportService workflowReportService,
        ICurrentUserService currentUserService,
        IMemoryCache cache)
    {
        _workflowReportService = workflowReportService;
        _currentUserService = currentUserService;
        _cache = cache;
    }

    [HttpGet("stock-ledger-reconciliation")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockLedgerReconciliationAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>.SuccessResult(
            await _workflowReportService.GetStockLedgerReconciliationAsync(query)));

    [HttpGet("operational-kpis")]
    [ProducesResponseType(typeof(ApiResponse<OperationalKpiSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOperationalKpisAsync()
    {
        var result = await GetOrCreateAggregateAsync(OperationalKpisCacheKey, async () =>
        {
            var dataQuality = await GetDataQualitySnapshotAsync(new WorkflowReportQueryDto());
            return await _workflowReportService.GetOperationalKpisAsync(dataQuality.ErrorCount);
        });

        return Ok(ApiResponse<OperationalKpiSummaryDto>.SuccessResult(result));
    }

    [HttpGet("data-quality")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDataQualityAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<DataQualityReportDto>.SuccessResult(
            await _workflowReportService.GetDataQualityAsync(query)));

    [HttpGet("data-quality/page")]
    [ProducesResponseType(typeof(ApiResponse<DataQualityPageDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDataQualityPageAsync([FromQuery] DataQualityPageQueryDto query)
    {
        var snapshot = await GetDataQualitySnapshotAsync(query);
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

            var result = await _workflowReportService.UpdateDataQualityIssueRemediationAsync(request, userId);
            InvalidateAggregateCaches();
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

            var result = await _workflowReportService.CleanupDataQualityAsync(request, userId);
            if (!result.DryRun)
            {
                InvalidateAggregateCaches();
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

    private void InvalidateAggregateCaches()
    {
        _cache.Remove(OperationalKpisCacheKey);
        Interlocked.Increment(ref _dataQualityCacheVersion);
    }

    private Task<DataQualityReportDto> GetDataQualitySnapshotAsync(WorkflowReportQueryDto query)
    {
        var snapshotQuery = JsonSerializer.Deserialize<WorkflowReportQueryDto>(JsonSerializer.Serialize(query))
            ?? new WorkflowReportQueryDto();
        snapshotQuery.Limit = 500;
        var version = Volatile.Read(ref _dataQualityCacheVersion);
        var cacheKey = $"workflow-reports:data-quality-snapshot:{version}:{JsonSerializer.Serialize(snapshotQuery)}";
        return GetOrCreateAggregateAsync(
            cacheKey,
            () => _workflowReportService.GetDataQualityAsync(snapshotQuery));
    }

    private async Task<T> GetOrCreateAggregateAsync<T>(string cacheKey, Func<Task<T>> factory)
        where T : class
    {
        if (_cache.TryGetValue<T>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        var load = AggregateCacheLoads.GetOrAdd(
            cacheKey,
            _ => new Lazy<Task<object>>(
                async () => await factory(),
                LazyThreadSafetyMode.ExecutionAndPublication));
        try
        {
            var result = (T)await load.Value;
            _cache.Set(cacheKey, result, AggregateCacheDuration);
            return result;
        }
        finally
        {
            AggregateCacheLoads.TryRemove(cacheKey, out _);
        }
    }
}
