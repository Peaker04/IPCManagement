using System.Collections.Concurrent;
using System.Text.Json;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Controllers;

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

    [HttpGet("current-stock")]
    public async Task<IActionResult> GetCurrentStockAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<CurrentStockSummaryDto>>.SuccessResult(
            await _workflowReportService.GetCurrentStockAsync(query)));

    [HttpGet("current-stock/page")]
    public async Task<IActionResult> GetCurrentStockPageAsync([FromQuery] CurrentStockPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<CurrentStockSummaryDto>>.SuccessResult(
            await _workflowReportService.GetCurrentStockPageAsync(query)));

    [HttpGet("stock-movements")]
    public async Task<IActionResult> GetStockMovementsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockMovementViewDto>>.SuccessResult(
            await _workflowReportService.GetStockMovementsAsync(query)));

    [HttpGet("stock-movements/page")]
    public async Task<IActionResult> GetStockMovementPageAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<StockMovementViewDto>>.SuccessResult(
            await _workflowReportService.GetStockMovementPageAsync(query)));

    [HttpGet("stock-ledger-reconciliation")]
    public async Task<IActionResult> GetStockLedgerReconciliationAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockLedgerReconciliationDto>>.SuccessResult(
            await _workflowReportService.GetStockLedgerReconciliationAsync(query)));

    [HttpGet("stock-snapshots")]
    public async Task<IActionResult> GetStockSnapshotsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _workflowReportService.GetStockSnapshotsAsync(query)));

    [HttpPost("stock-snapshots/generate")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GenerateStockSnapshotsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<StockSnapshotDto>>.SuccessResult(
            await _workflowReportService.GenerateMonthlyStockSnapshotAsync(query)));

    [HttpGet("workflow-documents")]
    public async Task<IActionResult> GetWorkflowDocumentsAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<WorkflowDocumentDto>>.SuccessResult(
            await _workflowReportService.GetWorkflowDocumentsAsync(query)));

    [HttpGet("ingredient-demand")]
    public async Task<IActionResult> GetIngredientDemandAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IngredientDemandReportDto>>.SuccessResult(
            await _workflowReportService.GetIngredientDemandAsync(query)));

    [HttpGet("ingredient-demand/page")]
    public async Task<IActionResult> GetIngredientDemandPageAsync([FromQuery] IngredientDemandPageQueryDto query)
        => Ok(ApiResponse<IngredientDemandPageDto>.SuccessResult(
            await _workflowReportService.GetIngredientDemandPageAsync(query)));

    [HttpGet("ingredient-demand/aggregate/page")]
    public async Task<IActionResult> GetIngredientDemandAggregatePageAsync([FromQuery] IngredientDemandAggregatePageQueryDto query)
        => Ok(ApiResponse<IngredientDemandAggregatePageDto>.SuccessResult(
            await _workflowReportService.GetIngredientDemandAggregatePageAsync(query)));

    [HttpGet("material-request-candidates/page")]
    public async Task<IActionResult> GetMaterialRequestCandidatePageAsync([FromQuery] MaterialRequestCandidatePageQueryDto query)
    {
        try
        {
            return Ok(ApiResponse<MaterialRequestCandidatePageDto>.SuccessResult(
                await _workflowReportService.GetMaterialRequestCandidatePageAsync(query)));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("purchase-demand")]
    public async Task<IActionResult> GetPurchaseDemandAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchaseDemandReportDto>>.SuccessResult(
            await _workflowReportService.GetPurchaseDemandAsync(query)));

    [HttpGet("purchase-plan")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPurchasePlanAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PurchasePlanReportDto>>.SuccessResult(
            await _workflowReportService.GetPurchasePlanAsync(query)));

    [HttpGet("purchase-plan/page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPurchasePlanPageAsync([FromQuery] PurchasePlanPageQueryDto query)
        => Ok(ApiResponse<PurchasePlanPageDto>.SuccessResult(
            await _workflowReportService.GetPurchasePlanPageAsync(query)));

    [HttpGet("receipt-price-variance")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseOrderReadAccess)]
    public async Task<IActionResult> GetReceiptPriceVarianceAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _workflowReportService.GetReceiptPriceVarianceAsync(query)));

    [HttpGet("receipt-price-variance/page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseOrderReadAccess)]
    public async Task<IActionResult> GetReceiptPriceVariancePageAsync([FromQuery] ReceiptPriceVariancePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<ReceiptPriceVarianceReportDto>>.SuccessResult(
            await _workflowReportService.GetReceiptPriceVariancePageAsync(query)));

    [HttpGet("price-variance/by-supplier")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceBySupplierAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceBySupplierDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceBySupplierAsync(query)));

    [HttpGet("price-variance/by-supplier/page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceBySupplierPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceBySupplierDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceBySupplierPageAsync(query)));

    [HttpGet("price-variance/by-period")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByPeriodAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByPeriodDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByPeriodAsync(query)));

    [HttpGet("price-variance/by-period/page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByPeriodPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByPeriodDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByPeriodPageAsync(query)));

    [HttpGet("price-variance/by-dish-group")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByDishGroupAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByDishGroupAsync(query)));

    [HttpGet("price-variance/by-dish-group/page")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public async Task<IActionResult> GetPriceVarianceByDishGroupPageAsync([FromQuery] PriceVarianceAggregatePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<PriceVarianceByDishGroupDto>>.SuccessResult(
            await _workflowReportService.GetPriceVarianceByDishGroupPageAsync(query)));

    [HttpGet("kitchen-issues")]
    public async Task<IActionResult> GetKitchenIssuesAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<KitchenIssueReportDto>>.SuccessResult(
            await _workflowReportService.GetKitchenIssuesAsync(query)));

    [HttpGet("kitchen-issues/page")]
    public async Task<IActionResult> GetKitchenIssuesPageAsync([FromQuery] KitchenIssuePageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<KitchenIssueReportDto>>.SuccessResult(
            await _workflowReportService.GetKitchenIssuesPageAsync(query)));

    [HttpGet("operational-kpis")]
    public async Task<IActionResult> GetOperationalKpisAsync()
    {
        var result = await GetOrCreateAggregateAsync(OperationalKpisCacheKey, async () =>
        {
            var dataQuality = await GetDataQualitySnapshotAsync(new WorkflowReportQueryDto());
            return await _workflowReportService.GetOperationalKpisAsync(dataQuality.ErrorCount);
        });

        return Ok(ApiResponse<OperationalKpiSummaryDto>.SuccessResult(result));
    }

    [HttpGet("issue-vs-return")]
    public async Task<IActionResult> GetIssueVsReturnAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _workflowReportService.GetIssueVsReturnAsync(query)));

    [HttpGet("issue-vs-return/page")]
    public async Task<IActionResult> GetIssueVsReturnPageAsync([FromQuery] IssueVsReturnPageQueryDto query)
        => Ok(ApiResponse<PagedResponseDto<IssueVsReturnUsageReportDto>>.SuccessResult(
            await _workflowReportService.GetIssueVsReturnPageAsync(query)));

    [HttpGet("audit-changes")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GetAuditChangesAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<AuditChangeReportDto>>.SuccessResult(
            await _workflowReportService.GetAuditChangesAsync(query)));

    [HttpGet("audit-changes/page")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> GetAuditChangePageAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<CursorPageDto<AuditChangeReportDto>>.SuccessResult(
            await _workflowReportService.GetAuditChangePageAsync(query)));

    [HttpGet("audit-changes/csv")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public async Task<IActionResult> ExportAuditChangesCsvAsync([FromQuery] WorkflowReportQueryDto query)
    {
        query.Limit = 1000;
        var data = await _workflowReportService.GetAuditChangesAsync(query);
        
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("Mã log,Thời gian,Người thực hiện,Mảng nghiệp vụ,Tên bảng,ID thực thể,Tên cột,Giá trị cũ,Giá trị mới,Lý do");
        
        foreach (var row in data)
        {
            sb.AppendLine($"\"{row.AuditId}\",\"{row.ChangedAt:yyyy-MM-dd HH:mm:ss}\",\"{row.ChangedByName}\",\"{row.BusinessArea}\",\"{row.EntityName}\",\"{row.EntityId}\",\"{row.FieldName}\",\"{row.OldValue?.Replace("\"", "\"\"")}\",\"{row.NewValue?.Replace("\"", "\"\"")}\",\"{row.Reason?.Replace("\"", "\"\"")}\"");
        }
        
        var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"audit-log-{DateTime.Now:yyyyMMddHHmmss}.csv");
    }

    [HttpGet("data-quality")]
    public async Task<IActionResult> GetDataQualityAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<DataQualityReportDto>.SuccessResult(
            await _workflowReportService.GetDataQualityAsync(query)));

    [HttpGet("data-quality/page")]
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

    [HttpGet("order-export")]
    public async Task<IActionResult> GetOrderExportAsync([FromQuery] WorkflowReportQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<OrderExportReportRowDto>>.SuccessResult(
            await _workflowReportService.GetOrderExportAsync(query)));

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
