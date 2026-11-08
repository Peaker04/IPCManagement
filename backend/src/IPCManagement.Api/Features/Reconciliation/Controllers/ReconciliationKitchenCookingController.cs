using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/batches/{id}/kitchen-cooking"), Authorize]
[SystemOperation("reconciliation.kitchen-cooking.read", OperationDisposition.ReconciliationOnly)]
[Authorize(Policy = AuthorizationPolicies.ReconciliationKitchenAccess)]
public sealed class ReconciliationKitchenCookingController(ReconciliationKitchenExportService service) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<ReconciliationKitchenCookingExportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(string id, CancellationToken token)
    {
        try
        {
            var result = await service.GetAsync(id, token);
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu."))
                : Ok(ApiResponse<ReconciliationKitchenCookingExportDto>.SuccessResult(result));
        }
        catch (InvalidOperationException error) when (IsCompatibilityError(error))
        {
            return Conflict(ApiResponse.FailResult(error.Message));
        }
    }

    [HttpGet("csv")]
    [Produces("text/csv")]
    public async Task<IActionResult> Csv(string id, CancellationToken token)
    {
        try
        {
            var result = await service.GetAsync(id, token);
            if (result is null) return NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu."));
            if (result.Rows.Count == 0) return Conflict(ApiResponse.FailResult("Lô không có dòng phiếu nấu để xuất."));
            return File(ReconciliationKitchenExportService.BuildCsv(result.Rows), "text/csv; charset=utf-8", $"phieu-nau-{result.BatchId}.csv");
        }
        catch (InvalidOperationException error) when (IsCompatibilityError(error))
        {
            return Conflict(ApiResponse.FailResult(error.Message));
        }
    }

    [HttpGet("xlsx")]
    [Produces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")]
    public async Task<IActionResult> Xlsx(string id, CancellationToken token)
    {
        try
        {
            var result = await service.GetAsync(id, token);
            if (result is null) return NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu."));
            if (result.Rows.Count == 0) return Conflict(ApiResponse.FailResult("Lô không có dòng phiếu nấu để xuất."));
            return File(ReconciliationKitchenExportService.BuildXlsx(result.Rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"phieu-nau-{result.BatchId}.xlsx");
        }
        catch (InvalidOperationException error) when (IsCompatibilityError(error))
        {
            return Conflict(ApiResponse.FailResult(error.Message));
        }
    }

    private static bool IsCompatibilityError(InvalidOperationException error) =>
        error.Message.Contains("KITCHEN_FROZEN_LINEAGE_", StringComparison.Ordinal)
        || error.Message.Contains("LEGACY_DAILY_LINEAGE_MISSING", StringComparison.Ordinal);
}
