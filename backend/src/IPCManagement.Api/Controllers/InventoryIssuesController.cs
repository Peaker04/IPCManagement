using System.Security.Claims;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/inventory-issues")]
[Authorize]
public class InventoryIssuesController : ControllerBase
{
    private readonly IInventoryIssueService _inventoryIssueService;

    public InventoryIssuesController(IInventoryIssueService inventoryIssueService)
    {
        _inventoryIssueService = inventoryIssueService;
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
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        var result = await _inventoryIssueService.CreateAsync(dto, userId);
        if (result is null)
            return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

        return CreatedAtAction(
            nameof(GetById),
            new { id = result.IssueId },
            ApiResponse<InventoryIssueCreatedDto>.SuccessResult(result, "Tạo phiếu xuất kho thành công."));
    }
}
