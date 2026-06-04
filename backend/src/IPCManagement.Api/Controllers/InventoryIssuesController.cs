using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Inventory;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
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
        if (GuidHelper.ParseGuidString(id) is null)
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));

        var result = await _inventoryIssueService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

        return Ok(ApiResponse<InventoryIssueDto>.SuccessResult(result));
    }
}
