using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/inventory-receipts")]
[Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
[EnableRateLimiting("api-general")]
public class InventoryReceiptsController : ControllerBase
{
    private readonly IInventoryReceiptService _inventoryReceiptService;
    private readonly ICurrentUserService _currentUserService;

    public InventoryReceiptsController(
        IInventoryReceiptService inventoryReceiptService,
        ICurrentUserService currentUserService)
    {
        _inventoryReceiptService = inventoryReceiptService;
        _currentUserService = currentUserService;
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
        var result = await _inventoryReceiptService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu nhập kho với ID: {id}"));

        return Ok(ApiResponse<InventoryReceiptDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới phiếu nhập kho.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInventoryReceiptDto dto)
    {
        var userId = _currentUserService.GetUserId(User);

        var result = await _inventoryReceiptService.CreateAsync(dto, userId);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.ReceiptId },
            ApiResponse<InventoryReceiptCreatedDto>.SuccessResult(result, "Tạo phiếu nhập kho thành công."));
    }

    /// <summary>Tạo phiếu nhập kho từ phiếu mua đã gửi nhà cung cấp.</summary>
    [HttpPost("from-purchase")]
    public async Task<IActionResult> CreateFromPurchase([FromBody] CreateInventoryReceiptFromPurchaseDto dto)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _inventoryReceiptService.CreateFromPurchaseRequestAsync(dto, userId);
            if (result is null)
            {
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));
            }

            return CreatedAtAction(
                nameof(GetById),
                new { id = result.ReceiptId },
                ApiResponse<InventoryReceiptCreatedDto>.SuccessResult(result, "Đã nhập kho từ phiếu mua."));
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
