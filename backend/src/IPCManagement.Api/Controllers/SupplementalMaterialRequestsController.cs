using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/supplemental-material-requests")]
[Authorize(Policy = AuthorizationPolicies.InventoryIssueAccess)]
[EnableRateLimiting("api-general")]
public sealed class SupplementalMaterialRequestsController : ControllerBase
{
    private readonly ISupplementalMaterialRequestService _service;
    private readonly ICurrentUserService _currentUserService;

    public SupplementalMaterialRequestsController(
        ISupplementalMaterialRequestService service,
        ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSupplementalMaterialRequestDto request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var roles = _currentUserService.GetRoleNames(User);
            var scopedWarehouseId = roles.Any(AuthorizationPolicies.IsProductionRole)
                ? _currentUserService.GetWarehouseId(User)
                : null;
            var result = await _service.CreateAsync(request, userId, scopedWarehouseId);
            return Created(string.Empty, ApiResponse<SupplementalMaterialRequestDto>.SuccessResult(
                result,
                "Đã gửi yêu cầu bổ sung tới kho."));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
