using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Dish;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.SampleData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
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
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCatalogAsync([FromQuery] bool includeInactive = false)
    {
        var result = await _service.GetCatalogAsync(includeInactive);
        return Ok(ApiResponse<IReadOnlyList<DishCatalogDto>>.SuccessResult(result));
    }

    /// <summary>Kiểm tra món nào đã có BOM và món nào thiếu định lượng.</summary>
    [HttpGet("bom-coverage")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<BomCoverageReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomCoverageAsync()
    {
        var result = await _service.GetBomCoverageAsync();
        return Ok(ApiResponse<BomCoverageReportDto>.SuccessResult(result));
    }

    /// <summary>Validate chất lượng BOM sau import hoặc cập nhật catalog.</summary>
    [HttpGet("bom-validation")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<BomValidationReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBomValidationAsync()
    {
        var result = await _service.GetBomValidationAsync();
        return Ok(ApiResponse<BomValidationReportDto>.SuccessResult(result));
    }

    /// <summary>Xem tín hiệu lịch sử import thực đơn/BOM gần nhất.</summary>
    [HttpGet("import-history")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<MenuImportHistoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuImportHistoryAsync()
    {
        var result = await _service.GetMenuImportHistoryAsync();
        return Ok(ApiResponse<MenuImportHistoryDto>.SuccessResult(result));
    }

    /// <summary>Xem trạng thái dữ liệu mẫu/seed/import theo domain vận hành.</summary>
    [HttpGet("sample-import-status")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<SampleImportStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSampleImportStatusAsync()
    {
        var result = await _service.GetSampleImportStatusAsync();
        return Ok(ApiResponse<SampleImportStatusDto>.SuccessResult(result));
    }

    /// <summary>Tải file Excel mẫu BOM theo đơn giá/khách hàng.</summary>
    [HttpGet("bom-template")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadBomTemplateAsync([FromQuery] BomTemplateQueryDto query, CancellationToken cancellationToken)
    {
        var bytes = await _service.BuildBomTemplateWorkbookAsync(query, cancellationToken);
        var scope = string.IsNullOrWhiteSpace(query.CustomerId) ? "global" : query.CustomerId;
        return File(
            bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"bom-template-{query.TemplateType}-{query.PriceTier:0}-{scope}.xlsx");
    }

    /// <summary>Preview import BOM nhiều món trước khi commit.</summary>
    /// <remarks>
    /// Hạn mức tải lên dùng chung <see cref="XlsxSecurityLimits.MaxUploadBytes"/> (10 MB) —
    /// cùng mức với 3 action upload thực đơn tuần ở <c>CoordinationController</c>.
    /// Không có chặn này thì buffer trong <c>DishService.ReadBomImportSourceRowsAsync</c>
    /// nạp trọn file vào RAM rồi nhân đôi bằng <c>ToArray()</c> → DoS bộ nhớ.
    /// </remarks>
    [HttpPost("bom-import/preview")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(XlsxSecurityLimits.MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<BomImportPreviewDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> PreviewBomImportAsync(
        [FromForm] BomImportPreviewRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request.File.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("File import BOM trống."));
        }

        await using var stream = request.File.OpenReadStream();
        var result = await _service.PreviewBomImportAsync(stream, request, cancellationToken);
        return Ok(ApiResponse<BomImportPreviewDto>.SuccessResult(result));
    }

    /// <summary>Commit import BOM sau khi preview không còn lỗi.</summary>
    /// <remarks>Cùng hạn mức tải lên với action preview — xem <see cref="PreviewBomImport"/>.</remarks>
    [HttpPost("bom-import/commit")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(XlsxSecurityLimits.MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<BomImportCommitResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> CommitBomImportAsync(
        [FromForm] BomImportCommitRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request.File.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("File import BOM trống."));
        }

        await using var stream = request.File.OpenReadStream();
        var userId = _currentUserService.GetUserId(User);
        var result = await _service.CommitBomImportAsync(stream, request, userId, cancellationToken);
        return Ok(ApiResponse<BomImportCommitResultDto>.SuccessResult(result, "Đã import BOM theo đơn giá."));
    }

    /// <summary>Lấy danh sách món ăn có phân trang và tìm kiếm.</summary>
    [HttpGet]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<DishDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] PagedRequestDto request)
    {
        var result = await _service.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<DishDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết một món ăn theo ID.</summary>
    [HttpGet("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetByIdAsync(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<DishDto>.SuccessResult(result));
    }

    /// <summary>Lấy danh sách BOM của một món ăn.</summary>
    [HttpGet("{id}/bom")]
    [Authorize(Policy = AuthorizationPolicies.CatalogReadAccess)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetBomLinesAsync(string id)
    {
        var result = await _service.GetBomLinesAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<IReadOnlyList<DishCatalogBomLineDto>>.SuccessResult(result));
    }

    /// <summary>Tạo mới món ăn.</summary>
    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateDishRequest dto)
    {
        var result = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetByIdAsync), new { id = result.DishId },
            ApiResponse<DishDto>.SuccessResult(result, "Tạo món ăn thành công."));
    }

    /// <summary>Cập nhật thông tin món ăn.</summary>
    [HttpPut("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateAsync(string id, [FromBody] UpdateDishRequest dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse<DishDto>.SuccessResult(result, "Cập nhật thành công."));
    }

    /// <summary>Thêm một dòng BOM nguyên liệu cho món ăn.</summary>
    [HttpPost("{id}/bom")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddBomLineAsync(string id, [FromBody] CreateDishBomLineRequest dto)
    {
        var result = await _service.AddBomLineAsync(id, dto);
        if (result is null)
            return NotFound(ApiResponse.FailResult("Không tìm thấy món ăn hoặc nguyên liệu của dòng BOM."));

        return StatusCode(StatusCodes.Status201Created,
            ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã thêm dòng BOM."));
    }

    /// <summary>Cập nhật một dòng BOM nguyên liệu của món ăn.</summary>
    [HttpPut("{id}/bom/{bomId}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(typeof(ApiResponse<DishCatalogBomLineDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateBomLineAsync(string id, string bomId, [FromBody] UpdateDishBomLineRequest dto)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _service.UpdateBomLineAsync(id, bomId, dto, userId);
        if (result is null)
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."));

        return Ok(ApiResponse<DishCatalogBomLineDto>.SuccessResult(result, "Đã cập nhật dòng BOM."));
    }

    /// <summary>Ngừng áp dụng một dòng BOM của món ăn.</summary>
    [HttpDelete("{id}/bom/{bomId}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CloseBomLineAsync(string id, string bomId)
    {
        var success = await _service.CloseBomLineAsync(id, bomId);
        if (!success)
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng BOM của món ăn."));

        return Ok(ApiResponse.SuccessResult("Đã ngừng áp dụng dòng BOM."));
    }

    /// <summary>Xóa món ăn.</summary>
    [HttpDelete("{id}")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAsync(string id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy món ăn với ID: {id}"));

        return Ok(ApiResponse.SuccessResult("Xóa món ăn thành công."));
    }
}
