using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Planning.Controllers;

[ApiController]
[Route("api/material-demand")]
[Authorize(Policy = AuthorizationPolicies.DemandGenerateAccess)]
[EnableRateLimiting("api-general")]
public class MaterialDemandController : ControllerBase
{
    private readonly IMaterialDemandService _materialDemandService;
    private readonly ICurrentUserService _currentUserService;

    public MaterialDemandController(
        IMaterialDemandService materialDemandService,
        ICurrentUserService currentUserService)
    {
        _materialDemandService = materialDemandService;
        _currentUserService = currentUserService;
    }

    /// <summary>Tính nhu cầu nguyên liệu từ số suất đã chốt, sau đó mới kiểm tồn kho.</summary>
    [HttpPost("generate")]
    [ProducesResponseType(typeof(ApiResponse<MaterialDemandResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> GenerateAsync(
        [FromBody] GenerateMaterialDemandRequest request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.GetUserId(User);
        MaterialDemandResultDto? result;
        try
        {
            result = await _materialDemandService.GenerateAsync(request, userId, cancellationToken);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy số suất đã hoàn tất để tính nhu cầu nguyên liệu."));
        }

        return Ok(ApiResponse<MaterialDemandResultDto>.SuccessResult(result, "Tính nhu cầu nguyên liệu thành công."));
    }

    /// <summary>Kiểm tra xem demand đã tính có bị lỗi thời so với dữ liệu hiện tại không.</summary>
    [HttpGet("staleness")]
    [ProducesResponseType(typeof(ApiResponse<MaterialDemandStalenessDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStalenessAsync(
        [FromQuery] string serviceDate,
        [FromQuery] string? customerId,
        [FromQuery] string? scope,
        CancellationToken cancellationToken)
    {
        var result = await _materialDemandService.GetStalenessAsync(serviceDate, customerId, scope, cancellationToken);
        return Ok(ApiResponse<MaterialDemandStalenessDto>.SuccessResult(result));
    }

    [HttpPost("{id}/approve")]
    [ProducesResponseType(typeof(ApiResponse<MaterialDemandApprovalDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveAsync(
        string id,
        [FromBody] MaterialDemandApproveRequest? request,
        CancellationToken cancellationToken)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _materialDemandService.ApproveAsync(id, userId, request?.Reason, cancellationToken);
            if (result is null)
            {
                return NotFound(ApiResponse.FailResult("Không tìm thấy nhu cầu nguyên liệu."));
            }

            return Ok(ApiResponse<MaterialDemandApprovalDto>.SuccessResult(result, "Đã duyệt nhu cầu nguyên liệu."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
