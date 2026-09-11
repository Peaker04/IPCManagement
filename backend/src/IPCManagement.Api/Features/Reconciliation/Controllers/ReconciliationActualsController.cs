using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/lines"), Authorize]
public sealed class ReconciliationActualsController(ReconciliationActualService service, ICurrentUserService currentUser) : ControllerBase
{
    [HttpGet("disposition-categories"), Authorize(Policy = AuthorizationPolicies.ReportAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationDispositionCategoryDto>>), StatusCodes.Status200OK)]
    public IActionResult DispositionCategories() => Ok(ApiResponse<IReadOnlyList<ReconciliationDispositionCategoryDto>>.SuccessResult(ReconciliationDispositionCategories.Options));

    [HttpPut("{lineId}/purchased"), SystemOperationNeutral, Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public Task<IActionResult> Purchased(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) =>
        Task.FromResult<IActionResult>(StatusCode(StatusCodes.Status410Gone, ApiResponse.FailResult("Luồng nhập số mua cho đối chiếu đã ngừng hỗ trợ.")));

    [HttpPut("{lineId}/issued"), SystemOperationNeutral, Authorize(Policy = AuthorizationPolicies.WarehouseAccess)]
    public Task<IActionResult> Issued(string lineId, UpsertReconciliationActualRequest request, CancellationToken token) =>
        Task.FromResult<IActionResult>(StatusCode(StatusCodes.Status410Gone, ApiResponse.FailResult("Số đã xuất chỉ được đọc từ sổ phiếu xuất kho liên kết.")));
    [HttpPut("{lineId}/disposition"), SystemOperation("reconciliation.actuals.disposition", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationDispositionAccess)] public async Task<IActionResult> Disposition(string lineId, SetReconciliationDispositionRequest request, CancellationToken token) { await service.SetDispositionAsync(lineId, request, currentUser.GetUserId(User) ?? "", token); return NoContent(); }
}
