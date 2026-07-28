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
public sealed class MealQuantityPlansController : ControllerBase
{
    private readonly IMealQuantityPlanService _service;
    private readonly ICurrentUserService _currentUserService;

    public MealQuantityPlansController(IMealQuantityPlanService service, ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpGet("meal-quantity-plans")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMealQuantityPlansAsync([FromQuery] MealQuantityPlanQueryDto query)
        => Ok(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>.SuccessResult(await _service.GetMealQuantityPlansAsync(query)));

    [HttpPost("meal-quantity-plans/quick-servings")]
    [ProducesResponseType(typeof(ApiResponse<MealQuantityPlanDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpsertQuickServingsAsync([FromBody] UpsertQuickServingsRequest request)
    {
        try
        {
            var result = await _service.UpsertQuickServingsAsync(request, _currentUserService.GetUserId(User));
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy lịch menu cho ngày/ca này để tạo kế hoạch suất."))
                : Ok(ApiResponse<MealQuantityPlanDto>.SuccessResult(result,
                    request.Complete ? "Đã hoàn tất số suất cho KHSX." : "Đã lưu số suất cho KHSX."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
    }
}
