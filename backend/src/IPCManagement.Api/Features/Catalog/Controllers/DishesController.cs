using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Catalog.Controllers;

[ApiController]
[Route("api/Dishes")]
[Authorize]
[EnableRateLimiting("api-general")]
[Tags("Dishes")]
public sealed class DishesController(IDishCatalogService service) : ControllerBase
{
    [HttpGet("catalog")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCatalogAsync([FromQuery] bool includeInactive = false)
    {
        var result = await service.GetCatalogAsync(includeInactive);
        return Ok(ApiResponse<IReadOnlyList<DishCatalogDto>>.SuccessResult(result));
    }

    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<DishDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] PagedRequestDto request)
    {
        var result = await service.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<DishDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        var result = await service.GetByIdAsync(id);
        return result is null
            ? NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"))
            : Ok(ApiResponse<DishDto>.SuccessResult(result));
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateDishRequest dto)
    {
        var result = await service.CreateAsync(dto);
        return CreatedAtAction("GetById", new { id = result.DishId },
            ApiResponse<DishDto>.SuccessResult(result, "Tạo món ăn thành công."));
    }

    [HttpPut("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAsync(string id, [FromBody] UpdateDishRequest dto)
    {
        var result = await service.UpdateAsync(id, dto);
        return result is null
            ? NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"))
            : Ok(ApiResponse<DishDto>.SuccessResult(result, "Cập nhật thành công."));
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAsync(string id)
    {
        var success = await service.DeleteAsync(id);
        return success
            ? Ok(ApiResponse.SuccessResult("Xóa món ăn thành công."))
            : NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));
    }
}
