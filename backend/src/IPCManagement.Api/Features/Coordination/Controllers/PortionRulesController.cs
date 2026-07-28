using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Coordination.Controllers;

[ApiController]
[Route("api/coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
[Tags("Coordination")]
public sealed class PortionRulesController : ControllerBase
{
    private readonly IPortionRuleService _service;
    private readonly ICurrentUserService _currentUserService;

    public PortionRulesController(IPortionRuleService service, ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpGet("portion-rules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PortionRuleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPortionRulesAsync([FromQuery] PortionRuleQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<PortionRuleDto>>.SuccessResult(await _service.GetPortionRulesAsync(query)));

    [HttpPost("portion-rules")]
    [ProducesResponseType(typeof(ApiResponse<PortionRuleDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreatePortionRuleAsync([FromBody] CreatePortionRuleRequest request)
    {
        try
        {
            var result = await _service.CreatePortionRuleAsync(request, _currentUserService.GetUserId(User));
            return CreatedAtAction(nameof(GetPortionRulesAsync),
                ApiResponse<PortionRuleDto>.SuccessResult(result, "Đã tạo portion rule."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPut("portion-rules/{id}")]
    [ProducesResponseType(typeof(ApiResponse<PortionRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdatePortionRuleAsync(string id, [FromBody] UpdatePortionRuleRequest request)
    {
        try
        {
            var result = await _service.UpdatePortionRuleAsync(id, request, _currentUserService.GetUserId(User));
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy portion rule."))
                : Ok(ApiResponse<PortionRuleDto>.SuccessResult(result, "Đã cập nhật portion rule."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("portion-rules/resolve")]
    [ProducesResponseType(typeof(ApiResponse<ResolvedPortionRuleDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ResolvePortionRuleAsync([FromBody] ResolvePortionRuleRequest request)
    {
        try
        {
            var result = await _service.ResolvePortionRuleAsync(request);
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy khách hàng để resolve portion rule."))
                : Ok(ApiResponse<ResolvedPortionRuleDto>.SuccessResult(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
