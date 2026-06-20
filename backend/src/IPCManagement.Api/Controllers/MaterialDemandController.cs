using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/material-demand")]
[Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
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
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Generate(
        [FromBody] GenerateMaterialDemandRequestDto request,
        CancellationToken cancellationToken)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _materialDemandService.GenerateAsync(request, userId, cancellationToken);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy số suất đã chốt để tính nhu cầu nguyên liệu."));
        }

        return Ok(ApiResponse<MaterialDemandResultDto>.SuccessResult(result, "Tính nhu cầu nguyên liệu thành công."));
    }
}
