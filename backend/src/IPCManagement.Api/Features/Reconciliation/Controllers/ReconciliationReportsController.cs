using System.Globalization;
using System.Text;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/reports"), Authorize]
[SystemOperation("reconciliation.reports.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationReportsController(
    ReconciliationBatchService service,
    ReconciliationReportsService reportsService) : ControllerBase
{
    [HttpGet("operational-summary")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxOperationalSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOperationalSummary(CancellationToken token)
        => Ok(ApiResponse<MrxOperationalSummaryDto>.SuccessResult(await reportsService.GetOperationalSummaryAsync(token)));

    [HttpGet("transactions-history")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxTransactionHistoryReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransactionsHistory([FromQuery] string? batchId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken token)
        => Ok(ApiResponse<MrxTransactionHistoryReportDto>.SuccessResult(await reportsService.GetTransactionsHistoryAsync(batchId, fromDate, toDate, token)));

    [HttpGet("transactions-history/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportTransactionsHistory([FromQuery] string? batchId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken token)
    {
        var report = await reportsService.GetTransactionsHistoryAsync(batchId, fromDate, toDate, token);
        return File(ReconciliationReportsService.BuildTransactionsHistoryCsv(report.Rows), "text/csv; charset=utf-8", "lich-su-giao-dich-kho.csv");
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
    public async Task<IActionResult> GetCompletedRegister([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default)
        => Ok(ApiResponse<MrxCompletedRegisterReportDto>.SuccessResult(await reportsService.GetCompletedRegisterAsync(pageNumber, pageSize, token)));

    [HttpGet("completed-register/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportCompletedRegister([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default)
    {
        var report = await reportsService.GetCompletedRegisterAsync(pageNumber, pageSize, token);
        return File(ReconciliationReportsService.BuildCompletedRegisterCsv(report.Rows), "text/csv; charset=utf-8", "so-lo-da-hoan-tat.csv");
    }

    [HttpGet("audit-trail")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MrxAuditTrailReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAuditTrail([FromQuery] string? batchId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default)
        => Ok(ApiResponse<MrxAuditTrailReportDto>.SuccessResult(await reportsService.GetAuditTrailAsync(batchId, pageNumber, pageSize, token)));

    [HttpGet("audit-trail/csv")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces("text/csv")]
    public async Task<IActionResult> ExportAuditTrail([FromQuery] string? batchId, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 50, CancellationToken token = default)
    {
        var report = await reportsService.GetAuditTrailAsync(batchId, pageNumber, pageSize, token);
        return File(ReconciliationReportsService.BuildAuditTrailCsv(report.Rows), "text/csv; charset=utf-8", "nhat-ky-kiem-toan-doi-soat.csv");
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
    private static string Csv(string? value) => $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";
}
