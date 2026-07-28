using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Shared.Contracts;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Inventory.Controllers;

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

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<SupplementalMaterialRequestDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] SupplementalMaterialRequestFilterDto request)
    {
        try
        {
            var result = await _service.GetPagedAsync(request, ResolveWarehouseScope());
            return Ok(ApiResponse<PagedResponseDto<SupplementalMaterialRequestDto>>.SuccessResult(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<SupplementalMaterialRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        try
        {
            var result = await _service.GetByIdAsync(id, ResolveWarehouseScope());
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy yêu cầu cấp nguyên liệu bổ sung."))
                : Ok(ApiResponse<SupplementalMaterialRequestDto>.SuccessResult(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SupplementalMaterialRequestDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateSupplementalMaterialRequest request)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await _service.CreateAsync(request, userId, ResolveWarehouseScope());
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
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("{id}/fulfill")]
    [ProducesResponseType(typeof(ApiResponse<SupplementalMaterialRequestDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> FulfillAsync(string id, [FromBody] FulfillSupplementalMaterialRequest request)
        => await ExecuteActionAsync(
            (userId, warehouseId) => _service.FulfillAsync(id, request, userId, warehouseId),
            "Đã tạo phiếu xuất bổ sung và trừ tồn kho.");

    [HttpPost("{id}/route-to-purchasing")]
    [ProducesResponseType(typeof(ApiResponse<SupplementalMaterialRequestDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> RouteToPurchasingAsync(string id)
        => await ExecuteActionAsync(
            (userId, warehouseId) => _service.RouteToPurchasingAsync(id, userId, warehouseId),
            "Đã chuyển phần thiếu sang danh sách thu mua.");

    [HttpPost("{id}/reject")]
    [ProducesResponseType(typeof(ApiResponse<SupplementalMaterialRequestDto>), StatusCodes.Status200OK)]
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> RejectAsync(string id, [FromBody] RejectSupplementalMaterialRequest request)
        => await ExecuteActionAsync(
            (userId, warehouseId) => _service.RejectAsync(id, request, userId, warehouseId),
            "Đã từ chối yêu cầu bổ sung.");

    private async Task<IActionResult> ExecuteActionAsync(
        Func<string, string?, Task<SupplementalMaterialRequestDto>> action,
        string successMessage)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            var result = await action(userId, ResolveWarehouseScope());
            return Ok(ApiResponse<SupplementalMaterialRequestDto>.SuccessResult(result, successMessage));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
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

    private string? ResolveWarehouseScope()
        => _currentUserService.GetWarehouseId(User);
}
