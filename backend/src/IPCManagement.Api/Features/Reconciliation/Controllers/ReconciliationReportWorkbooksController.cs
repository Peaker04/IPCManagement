using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/reports"), Authorize]
[SystemOperation("reconciliation.reports.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationReportWorkbooksController(
    ReconciliationBatchService service,
    ReconciliationReportsService reportsService) : ControllerBase
{
    [HttpGet("transactions-history/xlsx")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces(MrxReportWorkbookExporter.ContentType)]
    public async Task<IActionResult> ExportTransactionsHistoryXlsx([FromQuery] string? batchId, [FromQuery] DateOnly? fromDate, [FromQuery] DateOnly? toDate, CancellationToken token)
        => File(await MrxReportWorkbookExporter.TransactionsAsync(reportsService.StreamTransactionsHistoryExportAsync(batchId, fromDate, toDate, token), token), MrxReportWorkbookExporter.ContentType, "lich-su-giao-dich-kho.xlsx");

    [HttpGet("variance-register/xlsx")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces(MrxReportWorkbookExporter.ContentType)]
    public async Task<IActionResult> ExportVarianceRegisterXlsx([FromQuery] string? batchId, [FromQuery] DateOnly? weekStartDate, CancellationToken token)
    {
        var report = await reportsService.GetVarianceRegisterAsync(batchId, weekStartDate, token, maximumDailyLines: 10_000);
        return File(await MrxReportWorkbookExporter.VariancesAsync(MrxReportWorkbookExporter.Enumerate(report.Rows, token), token), MrxReportWorkbookExporter.ContentType, "so-theo-doi-chenh-lech.xlsx");
    }

    [HttpGet("completed-register/xlsx")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces(MrxReportWorkbookExporter.ContentType)]
    public async Task<IActionResult> ExportCompletedRegisterXlsx(CancellationToken token)
        => File(await MrxReportWorkbookExporter.CompletedAsync(reportsService.StreamCompletedRegisterExportAsync(token), token), MrxReportWorkbookExporter.ContentType, "so-lo-da-hoan-tat.xlsx");

    [HttpGet("audit-trail/xlsx")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess)]
    [Produces(MrxReportWorkbookExporter.ContentType)]
    public async Task<IActionResult> ExportAuditTrailXlsx([FromQuery] string? batchId, CancellationToken token)
        => File(await MrxReportWorkbookExporter.AuditAsync(reportsService.StreamAuditTrailExportAsync(batchId, token), token), MrxReportWorkbookExporter.ContentType, "nhat-ky-doi-soat.xlsx");

    [HttpGet("{id}/export/xlsx")]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess)]
    [Produces(MrxReportWorkbookExporter.ContentType)]
    public async Task<IActionResult> ExportXlsx(string id, CancellationToken token)
    {
        var batch = await service.GetAsync(id, token);
        if (batch is null) return NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu."));
        return File(await MrxReportWorkbookExporter.BatchAsync(MrxReportWorkbookExporter.Enumerate(batch.Lines, token), token), MrxReportWorkbookExporter.ContentType, $"doi-soat-{batch.BatchId}.xlsx");
    }
}
