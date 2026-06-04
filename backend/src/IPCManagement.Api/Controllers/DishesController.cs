using IPCManagement.Application.DTOs.Common;
using IPCManagement.Application.DTOs.Dish;
using IPCManagement.Application.Helpers;
using IPCManagement.Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DishesController : ControllerBase
{
    private readonly IDishService _service;

    public DishesController(IDishService service)
    {
        _service = service;
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
