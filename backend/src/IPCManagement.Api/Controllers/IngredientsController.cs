using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Ingredient;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class IngredientsController : ControllerBase
{
    private readonly IIngredientService _service;

    public IngredientsController(IIngredientService service)
    {
        _service = service;
    }

    /// <summary>Lấy danh sách nguyên liệu có phân trang và tìm kiếm.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<IngredientDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] PagedRequestDto request)
    {
        var result = await _service.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<IngredientDto>>.SuccessResult(result));
    }

    /// <summary>Lấy chi tiết một nguyên liệu theo ID.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<IngredientDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id)
    {
        var result = await _service.GetByIdAsync(id);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nguyên liệu với ID: {id}"));

        return Ok(ApiResponse<IngredientDto>.SuccessResult(result));
    }

    /// <summary>Tạo mới nguyên liệu.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<IngredientDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateIngredientDto dto)
    {
        var result = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = result.IngredientId },
            ApiResponse<IngredientDto>.SuccessResult(result, "Tạo nguyên liệu thành công."));
    }

    /// <summary>Cập nhật thông tin nguyên liệu.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<IngredientDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateIngredientDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        if (result is null)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nguyên liệu với ID: {id}"));

        return Ok(ApiResponse<IngredientDto>.SuccessResult(result, "Cập nhật thành công."));
    }

    /// <summary>Xóa nguyên liệu.</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(string id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success)
            return NotFound(ApiResponse.FailResult($"Không tìm thấy nguyên liệu với ID: {id}"));

        return Ok(ApiResponse.SuccessResult("Xóa nguyên liệu thành công."));
    }
}
