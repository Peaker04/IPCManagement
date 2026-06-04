using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Warehouse;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WarehousesController : ControllerBase
{
    private readonly IWarehouseService _warehouseService;

    public WarehousesController(IWarehouseService warehouseService)
    {
        _warehouseService = warehouseService;
    }

    /// <summary>Lấy danh sách tất cả kho.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _warehouseService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<WarehouseDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết kho theo ID.</summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        if (GuidHelper.ParseGuidString(id) is null)
            return BadRequest(ApiResponse.FailResult("ID không hợp lệ."));

        var result = await _warehouseService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kho với ID: {id}"));

        return Ok(ApiResponse<WarehouseDto>.SuccessResult(result));
    }
}
