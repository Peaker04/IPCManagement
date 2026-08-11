using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api-general")]
public class WarehousesController : ControllerBase
{
    private const int SelectorPageSize = 100;
    private readonly IWarehouseService _warehouseService;

    public WarehousesController(IWarehouseService warehouseService)
    {
        _warehouseService = warehouseService;
    }

    /// <summary>Lấy danh sách tất cả kho.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.WarehouseCatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<WarehouseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] PagedRequestDto request)
    {
        var result = await _warehouseService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<WarehouseDto>>.SuccessResult(result));
    }

    /// <summary>Lấy toàn bộ kho cho các bộ chọn nghiệp vụ.</summary>
    [HttpGet("selector")]
    [Authorize(Policy = AuthorizationPolicies.WarehouseSelectorAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WarehouseDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSelectorAsync()
    {
        var warehouses = new List<WarehouseDto>();
        var pageNumber = 1;
        PagedResponseDto<WarehouseDto> page;

        do
        {
            page = await _warehouseService.GetPagedAsync(new PagedRequestDto
            {
                PageNumber = pageNumber,
                PageSize = SelectorPageSize
            });
            warehouses.AddRange(page.Items);
            pageNumber++;
        }
        while (pageNumber <= page.TotalPages);

        return Ok(ApiResponse<IReadOnlyList<WarehouseDto>>.SuccessResult(warehouses));
    }

    /// <summary>Lấy chi tiết kho theo ID.</summary>
    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.WarehouseCatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<WarehouseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        var result = await _warehouseService.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kho với ID: {id}"));

        return Ok(ApiResponse<WarehouseDto>.SuccessResult(result));
    }
}
