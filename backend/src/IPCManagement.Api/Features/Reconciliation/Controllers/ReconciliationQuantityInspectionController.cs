using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/batches/quantity-import"), Authorize]
[SystemOperation("reconciliation.batches.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationQuantityInspectionController(ReconciliationQuantityImportService quantityImports) : ControllerBase
{
    [HttpGet("materials"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MaterialInspection([FromQuery] string menuVersionId, [FromQuery] PagedRequestDto query, CancellationToken token)
        => Ok(ApiResponse<QuantityInspectionPageDto<QuantityMaterialInspectionDto>>.SuccessResult(await quantityImports.GetMaterialInspectionAsync(menuVersionId, query, token)));

    [HttpGet("plans"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<QuantityInspectionPageDto<QuantityPlanInspectionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PlanInspection([FromQuery] string menuVersionId, [FromQuery] PagedRequestDto query, CancellationToken token)
        => Ok(ApiResponse<QuantityInspectionPageDto<QuantityPlanInspectionDto>>.SuccessResult(await quantityImports.GetPlanInspectionAsync(menuVersionId, query, token)));
}
