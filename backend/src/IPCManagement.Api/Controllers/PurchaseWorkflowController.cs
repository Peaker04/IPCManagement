using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/purchase-workflow")]
[Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
[EnableRateLimiting("api-general")]
public class PurchaseWorkflowController : ControllerBase
{
    private readonly IPurchaseRequestWorkflowService _purchaseRequestWorkflowService;
    private readonly ICurrentUserService _currentUserService;

    public PurchaseWorkflowController(
        IPurchaseRequestWorkflowService purchaseRequestWorkflowService,
        ICurrentUserService currentUserService)
    {
        _purchaseRequestWorkflowService = purchaseRequestWorkflowService;
        _currentUserService = currentUserService;
    }

    /// <summary>Tạo đề xuất mua hàng từ các dòng nhu cầu nguyên liệu còn thiếu sau kiểm tồn.</summary>
    [HttpPost("from-demand")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseRequestWorkflowResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GenerateFromDemand(
        [FromBody] GeneratePurchaseRequestFromDemandDto request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _purchaseRequestWorkflowService.GenerateFromDemandAsync(request, userId, cancellationToken);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng thiếu nguyên liệu để tạo đề xuất mua hàng."));
        }

        return Ok(ApiResponse<PurchaseRequestWorkflowResultDto>.SuccessResult(result, "Tạo đề xuất mua hàng thành công."));
    }
}
