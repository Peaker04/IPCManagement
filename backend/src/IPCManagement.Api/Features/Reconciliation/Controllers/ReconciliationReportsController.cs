using System.Security.Claims;
using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/reports"), Authorize]
[SystemOperation("reconciliation.reports.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationReportsController(
    ReconciliationBatchService service,
    ReconciliationReportsService reportsService) : ControllerBase
{
    [HttpGet("source-changes"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<ReconciliationSourceChangeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSourceChanges([FromQuery] string batchId, [FromQuery] PagedRequestDto page, CancellationToken token)
        => Ok(ApiResponse<PagedResponseDto<ReconciliationSourceChangeDto>>.SuccessResult(await service.GetSourceChangesPageAsync(batchId, page, token)));

    [HttpGet("operational-summary")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxOperationalSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOperationalSummary([FromQuery] MrxOperationalSummaryQuery query, CancellationToken token)
        => Ok(ApiResponse<MrxOperationalSummaryDto>.SuccessResult(await reportsService.GetOperationalSummaryAsync(
            query, User.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToArray(), token)));

    [HttpGet("transactions-history")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<MrxTransactionHistoryRowDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransactionsHistory(
        [FromQuery] string? batchId,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] PagedRequestDto page,
        CancellationToken token)
        => Ok(ApiResponse<PagedResponseDto<MrxTransactionHistoryRowDto>>.SuccessResult(
            await reportsService.GetTransactionsHistoryAsync(batchId, fromDate, toDate, page, token)));

    [HttpGet("transactions-history/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportTransactionsHistory([FromQuery] string? batchId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken token)
    {
        Response.ContentType = "text/csv; charset=utf-8";
        Response.Headers.ContentDisposition = "attachment; filename=\"lich-su-giao-dich-kho.csv\"";
        await MrxReportCsvStreamWriter.WriteTransactionsAsync(
            Response.Body,
            reportsService.StreamTransactionsHistoryExportAsync(batchId, fromDate, toDate, token),
            token);
        return new EmptyResult();
    }

    [HttpGet("variance-register")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxVarianceRegisterReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVarianceRegister([FromQuery] string? batchId, [FromQuery] DateOnly? weekStartDate, CancellationToken token)
        => Ok(ApiResponse<MrxVarianceRegisterReportDto>.SuccessResult(await reportsService.GetVarianceRegisterAsync(batchId, weekStartDate, token)));

    [HttpGet("variance-register/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportVarianceRegister([FromQuery] string? batchId, [FromQuery] DateOnly? weekStartDate, CancellationToken token)
    {
        var report = await reportsService.GetVarianceRegisterAsync(batchId, weekStartDate, token);
        return File(ReconciliationReportsService.BuildVarianceRegisterCsv(report.Rows), "text/csv; charset=utf-8", "so-theo-doi-chenh-lech.csv");
    }

    [HttpGet("completed-register")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxCompletedRegisterReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCompletedRegister([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default, [FromQuery] MrxHistoricalScopeQuery? scope = null)
        => Ok(ApiResponse<MrxCompletedRegisterReportDto>.SuccessResult(await reportsService.GetCompletedRegisterAsync(
            new PagedRequestDto { PageNumber = pageNumber, PageSize = pageSize }, scope ?? new(), token)));

    [HttpGet("completed-register/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportCompletedRegister([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default, [FromQuery] MrxHistoricalScopeQuery? scope = null)
    {
        var rows = new List<MrxCompletedRegisterRowDto>();
        await foreach (var row in reportsService.StreamCompletedRegisterExportAsync(scope ?? new(), token)) rows.Add(row);
        return File(ReconciliationReportsService.BuildCompletedRegisterCsv(rows), "text/csv; charset=utf-8", "so-lo-da-hoan-tat.csv");
    }

    [HttpGet("audit-trail")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxAuditTrailReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditTrail([FromQuery] string? batchId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default, [FromQuery] string? search = null)
        => Ok(ApiResponse<MrxAuditTrailReportDto>.SuccessResult(await reportsService.GetAuditTrailAsync(
            batchId, new PagedRequestDto { PageNumber = pageNumber, PageSize = pageSize, SearchKeyword = search }, token)));

    [HttpGet("audit-trail/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportAuditTrail([FromQuery] string? batchId, CancellationToken token = default)
    {
        Response.ContentType = "text/csv; charset=utf-8";
        Response.Headers.ContentDisposition = "attachment; filename=\"nhat-ky-kiem-toan-doi-soat.csv\"";
        await MrxReportCsvStreamWriter.WriteAuditAsync(
            Response.Body,
            reportsService.StreamAuditTrailExportAsync(batchId, token),
            token);
        return new EmptyResult();
    }

    [HttpGet("{id}"), Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Get(string id, CancellationToken token) { var batch = await service.GetAsync(id, token); return batch is null ? NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu.")) : Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(batch)); }

    [HttpGet("{id}/export")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> Export(string id, CancellationToken token)
    {
        var batch = await service.GetAsync(id, token);
        if (batch is null) return NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu."));
        var csv = new StringBuilder("batchLineId,ingredientId,canonicalUnitId,requiredQuantity,purchasedQuantity,issuedQuantity,purchasedRequiredDifference,issuedRequiredDifference,purchasedIssuedDifference,status,dispositionCategory,dispositionReason\r\n");
        foreach (var line in batch.Lines)
        {
            csv.AppendJoin(',', Csv(line.BatchLineId), Csv(line.IngredientId), Csv(line.CanonicalUnitId), Number(line.RequiredQuantity), Number(line.PurchasedQuantity), Number(line.IssuedQuantity), Number(line.PurchasedRequiredDifference), Number(line.IssuedRequiredDifference), Number(line.PurchasedIssuedDifference), Csv(line.Status), Csv(line.Disposition?.Category), Csv(line.Disposition?.Reason)).Append("\r\n");
        }
        return File(new UTF8Encoding(encoderShouldEmitUTF8Identifier: true).GetBytes(csv.ToString()), "text/csv; charset=utf-8", $"reconciliation-{batch.BatchId}.csv");
    }

    private static string Number(decimal? value) => value?.ToString(CultureInfo.InvariantCulture) ?? string.Empty;
    private static string Csv(string? value) => MrxReportCsvStreamWriter.Csv(value);
}
