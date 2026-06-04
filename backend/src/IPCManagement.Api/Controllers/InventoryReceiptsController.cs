using System.Security.Claims;
using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/inventory-receipts")]
[Authorize]
public class InventoryReceiptsController : ControllerBase
{
    private readonly IInventoryReceiptService _inventoryReceiptService;

    public InventoryReceiptsController(IInventoryReceiptService inventoryReceiptService)
    {
        _inventoryReceiptService = inventoryReceiptService;
    }

    /// <summary>Lấy danh sách phiếu nhập kho.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _inventoryReceiptService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<InventoryReceiptDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết phiếu nhập kho theo ID (bao gồm các dòng).</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        if (GuidHelper.ParseGuidString(id) is null)
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));

        var result = await _inventoryReceiptService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu nhập kho với ID: {id}"));

        return Ok(ApiResponse<InventoryReceiptDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới phiếu nhập kho.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInventoryReceiptDto dto)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        var result = await _inventoryReceiptService.CreateAsync(dto, userId);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.ReceiptId },
            ApiResponse<InventoryReceiptCreatedDto>.SuccessResult(result, "Tạo phiếu nhập kho thành công."));
    }
}
