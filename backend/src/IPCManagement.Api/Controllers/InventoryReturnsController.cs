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
[Route("api/inventory-returns")]
[Authorize]
[EnableRateLimiting("api-general")]
public class InventoryReturnsController : ControllerBase
{
    private readonly IInventoryReturnService _inventoryReturnService;
    private readonly ICurrentUserService _currentUserService;

    public InventoryReturnsController(
        IInventoryReturnService inventoryReturnService,
        ICurrentUserService currentUserService)
    {
        _inventoryReturnService = inventoryReturnService;
        _currentUserService = currentUserService;
    }

    /// <summary>Lấy danh sách phiếu trả nguyên liệu dư.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.InventoryIssueAccess)]
    public async Task<IActionResult> GetAllAsync([FromQuery] InventoryReturnFilterRequestDto request)
    {
        var scopedWarehouseId = _currentUserService.GetWarehouseId(User);
        if (scopedWarehouseId is not null)
        {
            request.WarehouseId = scopedWarehouseId;
        }
        var result = await _inventoryReturnService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<InventoryReturnDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết phiếu trả nguyên liệu dư theo ID.</summary>
    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.InventoryIssueAccess)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        var result = await _inventoryReturnService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu trả nguyên liệu với ID: {id}"));

        var scopedWarehouseId = _currentUserService.GetWarehouseId(User);
        if (scopedWarehouseId is not null && !string.Equals(result.WarehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult("Không có quyền xem phiếu trả của kho khác."));

        return Ok(ApiResponse<InventoryReturnDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới phiếu trả nguyên liệu dư sau sản xuất.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateInventoryReturnRequest dto)
    {
        var userId = _currentUserService.GetUserId(User);

        var result = await _inventoryReturnService.CreateAsync(dto, userId);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

        return CreatedAtAction(
            nameof(GetByIdAsync),
            new { id = result.ReturnId },
            ApiResponse<InventoryReturnCreatedDto>.SuccessResult(result, "Tạo phiếu trả nguyên liệu thành công."));
    }

    /// <summary>Thủ kho xác nhận phiếu trả nguyên liệu và cộng tồn kho.</summary>
    [HttpPost("{id}/confirm-receipt")]
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> ConfirmReceiptAsync(string id, [FromBody] ConfirmInventoryReturnReceiptRequest dto)
    {
        var userId = _currentUserService.GetUserId(User);
        var existing = await _inventoryReturnService.GetByIdAsync(id);
        if (existing is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu trả nguyên liệu với ID: {id}"));
        var scopedWarehouseId = _currentUserService.GetWarehouseId(User);
        if (scopedWarehouseId is not null && !string.Equals(existing.WarehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult("Không có quyền xác nhận phiếu trả của kho khác."));

        var success = await _inventoryReturnService.ConfirmReceiptAsync(id, dto, userId);
        if (!success)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu trả nguyên liệu với ID: {id}"));

        return Ok(ApiResponse.SuccessResult("Xác nhận phiếu trả nguyên liệu và cộng tồn kho thành công."));
    }
}
