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
[Authorize(Policy = AuthorizationPolicies.InventoryAccess)]
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
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _inventoryIssueService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<InventoryIssueDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết phiếu xuất kho theo ID.</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _inventoryIssueService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

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
}
