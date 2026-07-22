using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>Tải workbench thu mua theo tuần, ngày phục vụ và giai đoạn.</summary>
    [HttpGet("workbench")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseWorkbenchWeekDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetWorkbenchWeek(
        [FromQuery] PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseRequestWorkflowService.GetWorkbenchWeekAsync(query, cancellationToken);
            return Ok(ApiResponse<PurchaseWorkbenchWeekDto>.SuccessResult(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Tạo đề xuất mua hàng từ các dòng nhu cầu nguyên liệu còn thiếu sau kiểm tồn.</summary>
    [HttpPost("from-demand")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseGenerateAccess)]
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

    /// <summary>Tải báo giá hoặc biên nhận hợp lệ để chọn nhà cung cấp.</summary>
    [HttpGet("requests/{id}/lines/{lineId}/supplier-evidence")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseGenerateAccess)]
    [ProducesResponseType(typeof(ApiResponse<SupplierEvidenceResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSupplierEvidence(
        string id,
        string lineId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseRequestWorkflowService.GetSupplierEvidenceAsync(
                id,
                lineId,
                cancellationToken);
            return Ok(ApiResponse<SupplierEvidenceResultDto>.SuccessResult(result));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Xác nhận nhà cung cấp, giá và ngày giao từ bằng chứng hiện hành.</summary>
    [HttpPost("requests/{id}/lines/{lineId}/supplier-decision")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseGenerateAccess)]
    [ProducesResponseType(typeof(ApiResponse<PurchaseLineSupplierDecisionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> ConfirmLineSupplier(
        string id,
        string lineId,
        [FromBody] ConfirmPurchaseLineSupplierDto request,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _purchaseRequestWorkflowService.ConfirmLineSupplierAsync(
                id,
                lineId,
                request,
                userId,
                cancellationToken);
            return Ok(ApiResponse<PurchaseLineSupplierDecisionDto>.SuccessResult(
                result,
                "Xác nhận nhà cung cấp thành công."));
        }
        catch (DbUpdateConcurrencyException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Gửi đơn mua chính thức sau khi nhu cầu nguyên liệu đã được duyệt.</summary>
    [HttpPost("requests/{id}/submit")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseGenerateAccess)]
    [ProducesResponseType(typeof(ApiResponse<PurchaseRequestWorkflowResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Submit(
        string id,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _purchaseRequestWorkflowService.SubmitAsync(id, userId, cancellationToken);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy đơn mua."));
            }

            return Ok(ApiResponse<PurchaseRequestWorkflowResultDto>.SuccessResult(result, "Đã gửi đơn mua chính thức."));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
