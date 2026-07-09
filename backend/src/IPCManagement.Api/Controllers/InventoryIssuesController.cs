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
[Route("api/inventory-issues")]
[Authorize(Policy = AuthorizationPolicies.InventoryIssueAccess)]
[EnableRateLimiting("api-general")]
public class InventoryIssuesController : ControllerBase
{
    private readonly IInventoryIssueService _inventoryIssueService;
    private readonly ICurrentUserService _currentUserService;

    public InventoryIssuesController(
        IInventoryIssueService inventoryIssueService,
        ICurrentUserService currentUserService)
    {
        _inventoryIssueService = inventoryIssueService;
        _currentUserService = currentUserService;
    }

    /// <summary>Lấy danh sách phiếu xuất kho.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] InventoryIssueFilterRequestDto request)
    {
        try
        {
            var scopedRequest = ApplyWarehouseScope(request);
            var result = await _inventoryIssueService.GetPagedAsync(scopedRequest);
            return Ok(ApiResponse<PagedResponseDto<InventoryIssueDto>>.SuccessResult(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Lấy chi tiết phiếu xuất kho theo ID.</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _inventoryIssueService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

        if (!CanAccessWarehouse(result.WarehouseId))
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult("Không có quyền xem phiếu xuất kho của kho này."));

        return Ok(ApiResponse<InventoryIssueDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới phiếu xuất kho.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInventoryIssueDto dto)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);

            var result = await _inventoryIssueService.CreateAsync(dto, userId);
            if (result is null)
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

            return CreatedAtAction(
                nameof(GetById),
                new { id = result.IssueId },
                ApiResponse<InventoryIssueCreatedDto>.SuccessResult(result, "Tạo phiếu xuất kho thành công."));
        }
        catch (StockShortageException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message, ex.Shortage));
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

    /// <summary>Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất kho.</summary>
    [HttpPost("{id}/confirm-receipt")]
    public async Task<IActionResult> ConfirmReceipt(string id, [FromBody] ConfirmInventoryIssueReceiptDto dto)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

            var result = await _inventoryIssueService.ConfirmReceiptAsync(id, dto, userId);
            if (result is null)
                return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

            return Ok(ApiResponse<InventoryIssueDto>.SuccessResult(result, "Bếp đã xác nhận nhận nguyên liệu."));
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

    private InventoryIssueFilterRequestDto ApplyWarehouseScope(InventoryIssueFilterRequestDto request)
    {
        var scopedWarehouseId = GetScopedWarehouseId();
        if (scopedWarehouseId is null)
        {
            return request;
        }

        if (!string.IsNullOrWhiteSpace(request.WarehouseId) &&
            !string.Equals(request.WarehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Không có quyền xem phiếu xuất kho của kho khác.");
        }

        request.WarehouseId = scopedWarehouseId;
        return request;
    }

    private bool CanAccessWarehouse(string warehouseId)
    {
        var scopedWarehouseId = GetScopedWarehouseId();
        return scopedWarehouseId is null ||
            string.Equals(warehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase);
    }

    private string? GetScopedWarehouseId()
    {
        var roles = _currentUserService.GetRoleNames(User);
        var hasInventoryRole = roles.Any(AuthorizationPolicies.IsInventoryRole);
        var hasProductionRole = roles.Any(AuthorizationPolicies.IsProductionRole);
        if (hasInventoryRole)
        {
            return null;
        }

        if (!hasProductionRole)
        {
            throw new UnauthorizedAccessException("Không có quyền xem phiếu xuất kho.");
        }

        var warehouseId = _currentUserService.GetWarehouseId(User);
        if (string.IsNullOrWhiteSpace(warehouseId) || GuidHelper.ParseGuidString(warehouseId) is null)
        {
            throw new UnauthorizedAccessException("Tài khoản bếp chưa được gán kho để xem phiếu xuất kho.");
        }

        return warehouseId;
    }
}
