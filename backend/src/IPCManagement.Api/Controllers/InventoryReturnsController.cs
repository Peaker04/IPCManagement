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
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _inventoryReturnService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<InventoryReturnDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết phiếu trả nguyên liệu dư theo ID.</summary>
    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _inventoryReturnService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu trả nguyên liệu với ID: {id}"));

        return Ok(ApiResponse<InventoryReturnDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới phiếu trả nguyên liệu dư sau sản xuất.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.ProductionAccess)]
    public async Task<IActionResult> Create([FromBody] CreateInventoryReturnDto dto)
    {
        var userId = _currentUserService.GetUserId(User);

        var result = await _inventoryReturnService.CreateAsync(dto, userId);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.ReturnId },
            ApiResponse<InventoryReturnCreatedDto>.SuccessResult(result, "Tạo phiếu trả nguyên liệu thành công."));
    }
}
