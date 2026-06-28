using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
[EnableRateLimiting("api-general")]
public class DishesController : ControllerBase
{
    private readonly IDishService _service;
    private readonly ICurrentUserService _currentUserService;

    public DishesController(IDishService service, ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    /// <summary>Lấy catalog món ăn kèm slot thực đơn và chi tiết BOM.</summary>
    [HttpGet("catalog")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCatalog()
    {
        var result = await _service.GetCatalogAsync();
        return Ok(ApiResponse<IReadOnlyList<DishCatalogDto>>.SuccessResult(result));
    }

    /// <summary>Kiểm tra món nào đã có BOM và món nào thiếu định lượng.</summary>
    [HttpGet("bom-coverage")]
    [ProducesResponseType(typeof(ApiResponse<BomCoverageReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomCoverage()
    {
        var result = await _service.GetBomCoverageAsync();
        return Ok(ApiResponse<BomCoverageReportDto>.SuccessResult(result));
    }

    /// <summary>Validate chất lượng BOM sau import hoặc cập nhật catalog.</summary>
    [HttpGet("bom-validation")]
    [ProducesResponseType(typeof(ApiResponse<BomValidationReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomValidation()
    {
        var result = await _service.GetBomValidationAsync();
        return Ok(ApiResponse<BomValidationReportDto>.SuccessResult(result));
    }

    /// <summary>Xem tín hiệu lịch sử import thực đơn/BOM gần nhất.</summary>
    [HttpGet("import-history")]
    [ProducesResponseType(typeof(ApiResponse<MenuImportHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuImportHistory()
    {
        var result = await _service.GetMenuImportHistoryAsync();
        return Ok(ApiResponse<MenuImportHistoryDto>.SuccessResult(result));
    }

    /// <summary>Xem trạng thái dữ liệu mẫu/seed/import theo domain vận hành.</summary>
    [HttpGet("sample-import-status")]
    [ProducesResponseType(typeof(ApiResponse<SampleImportStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSampleImportStatus()
    {
        var result = await _service.GetSampleImportStatusAsync();
        return Ok(ApiResponse<SampleImportStatusDto>.SuccessResult(result));
    }

    /// <summary>Lấy danh sách món ăn có phân trang và tìm kiếm.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<DishDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _service.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<DishDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết một món ăn theo ID.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<DishDto>.SuccessResult(result));
    }

    /// <summary>Lấy danh sách BOM của một món ăn.</summary>
    [HttpGet("{id}/bom")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBomLines(string id)
    {
        var result = await _service.GetBomLinesAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>.SuccessResult(result));
    }

    /// <summary>Tạo mới món ăn.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create([FromBody] CreateDishDto dto)
    {
        var result = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.DishId },
            ApiResponse<DishDto>.SuccessResult(result, "Tạo món ăn thành công."));
    }

    /// <summary>Cập nhật thông tin món ăn.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateDishDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<DishDto>.SuccessResult(result, "Cập nhật thành công."));
    }

    /// <summary>Thêm một dòng BOM nguyên liệu cho món ăn.</summary>
    [HttpPost("{id}/bom")]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddBomLine(string id, [FromBody] CreateDishBomLineDto dto)
    {
        var result = await _service.AddBomLineAsync(id, dto);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return CreatedAtAction(nameof(GetBomLines), new { id },
            ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã thêm dòng BOM cho món ăn."));
    }

    /// <summary>Cập nhật một dòng BOM nguyên liệu của món ăn.</summary>
    [HttpPut("{id}/bom/{bomId}")]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateBomLine(string id, string bomId, [FromBody] UpdateDishBomLineDto dto)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _service.UpdateBomLineAsync(id, bomId, dto, userId);
        if (result is null)
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."));

        return Ok(ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã cập nhật dòng BOM."));
    }

    /// <summary>Ngừng áp dụng một dòng BOM của món ăn.</summary>
    [HttpDelete("{id}/bom/{bomId}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CloseBomLine(string id, string bomId)
    {
        var success = await _service.CloseBomLineAsync(id, bomId);
        if (!success)
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."));

        return Ok(ApiResponse.SuccessResult("Đã ngừng áp dụng dòng BOM."));
    }

    /// <summary>Xóa món ăn.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse.SuccessResult("Xóa món ăn thành công."));
    }
}
