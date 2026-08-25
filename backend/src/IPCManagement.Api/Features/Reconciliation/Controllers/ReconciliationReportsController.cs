using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/reports"), Authorize(Policy = AuthorizationPolicies.ReportRead)]
public sealed class ReconciliationReportsController(ReconciliationBatchService service) : ControllerBase
{
    [HttpGet("{id}")] public async Task<IActionResult> Get(string id, CancellationToken token) { var batch = await service.GetAsync(id, token); return batch is null ? NotFound(ApiResponse.FailResult("Không tìm thấy báo cáo đối chiếu.")) : Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(batch)); }
}
