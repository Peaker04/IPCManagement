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
public sealed class DishBomController(
    IDishBomService service,
    ICurrentUserService currentUserService) : ControllerBase
{
    [HttpGet("{id}/bom")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBomLinesAsync(string id)
    {
        var result = await service.GetBomLinesAsync(id);
        return result is null
            ? NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"))
            : Ok(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>.SuccessResult(result));
    }

    [HttpPost("{id}/bom")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddBomLineAsync(string id, [FromBody] CreateDishBomLineRequest dto)
    {
        var result = await service.AddBomLineAsync(id, dto);
        return result is null
            ? NotFound(ApiResponse.FailResult("Không tìm thấy món ăn hoặc nguyên liệu của dòng BOM."))
            : StatusCode(StatusCodes.Status201Created,
                ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã thêm dòng BOM."));
    }

    [HttpPut("{id}/bom/{bomId}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateBomLineAsync(
        string id,
        string bomId,
        [FromBody] UpdateDishBomLineRequest dto)
    {
        var result = await service.UpdateBomLineAsync(id, bomId, dto, currentUserService.GetUserId(User));
        return result is null
            ? NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."))
            : Ok(ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã cập nhật dòng BOM."));
    }

    [HttpDelete("{id}/bom/{bomId}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CloseBomLineAsync(string id, string bomId)
    {
        var success = await service.CloseBomLineAsync(id, bomId);
        return success
            ? Ok(ApiResponse.SuccessResult("Đã ngừng áp dụng dòng BOM."))
            : NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."));
    }
}
