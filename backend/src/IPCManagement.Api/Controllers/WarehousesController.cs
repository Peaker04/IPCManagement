using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Warehouse;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthorizationPolicies.WarehouseAccess)]
[EnableRateLimiting("api-general")]
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
        var result = await _warehouseService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kho với ID: {id}"));

        return Ok(ApiResponse<WarehouseDto>.SuccessResult(result));
    }
}
