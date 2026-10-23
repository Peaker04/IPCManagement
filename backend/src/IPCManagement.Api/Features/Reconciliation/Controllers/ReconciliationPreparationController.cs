using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/preparation"), Authorize]
public sealed class ReconciliationPreparationController(
    ReconciliationPreparationService service,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet]
    [SystemOperation("reconciliation.preparation.read", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationPreparationDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(
        [FromQuery] DateOnly serviceDate,
        [FromQuery] string[]? batchIds,
        CancellationToken token)
    {
        var result = await service.GetPreparationAsync(serviceDate, batchIds, token);
        return Ok(ApiResponse<ReconciliationPreparationDto>.SuccessResult(result));
    }

    [HttpGet("workbook-preview")]
    [SystemOperation("reconciliation.preparation.workbook-preview", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationPreparationWorkbookDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWorkbookPreview(
        [FromQuery] ReconciliationPreparationWorkbookQuery query,
        CancellationToken token)
    {
        var result = await service.GetWorkbookAsync(query, token);
        return Ok(ApiResponse<ReconciliationPreparationWorkbookDto>.SuccessResult(result));
    }

    [HttpGet("export-workbook")]
    [SystemOperation("reconciliation.preparation.export-workbook", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportWorkbook(
        [FromQuery] ReconciliationPreparationWorkbookQuery query,
        CancellationToken token)
    {
        var bytes = await service.ExportWorkbookXlsxAsync(query, token);
        var dateStr = query.ServiceDate?.ToString("yyyyMMdd") ?? DateTime.UtcNow.ToString("yyyyMMdd");
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"bang-chuan-bi-nguyen-lieu-{dateStr}.xlsx");
    }

    [HttpPost("issue")]
    [SystemOperation("reconciliation.preparation.issue", OperationDisposition.ReconciliationOnly)]
    [Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<CoordinatedPreparationIssueResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Issue(
        [FromBody] CoordinatedPreparationIssueRequest request,
        CancellationToken token)
    {
        var actorUserId = currentUserService.GetUserId(User) ?? string.Empty;
        var result = await service.IssueCoordinatedAsync(request, actorUserId, token);
        return Ok(ApiResponse<CoordinatedPreparationIssueResultDto>.SuccessResult(
            result,
            result.IdempotentReplay
                ? "Lệnh xuất kho phối hợp đã được xử lý trước đó (idempotent replay)."
                : $"Xuất kho phối hợp thành công {result.Issues.Count} lô đối soát."));
    }
}
