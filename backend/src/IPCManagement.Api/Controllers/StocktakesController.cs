using System.Threading.Tasks;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Services;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StocktakesController : ControllerBase
{
    private readonly IStocktakeService _stocktakeService;

    public StocktakesController(IStocktakeService stocktakeService)
    {
        _stocktakeService = stocktakeService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PagedResponseDto<StocktakeDto>>>> GetPaged([FromQuery] StocktakeFilterRequestDto request)
    {
        var result = await _stocktakeService.GetPagedAsync(request);
        return Ok(ApiResponse<PagedResponseDto<StocktakeDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> GetById(string id)
    {
        var result = await _stocktakeService.GetByIdAsync(id);
        if (result == null) return NotFound(ApiResponse<StocktakeDto>.FailResult("Không tìm thấy phiên kiểm kê."));
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> Create([FromBody] CreateStocktakeDto dto)
    {
        var userId = User.FindFirst("id")?.Value ?? string.Empty;
        var result = await _stocktakeService.CreateAsync(dto, userId);
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }

    [HttpPut("{id}/actual-qty")]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> UpdateActualQty(string id, [FromBody] UpdateStocktakeLinesDto dto)
    {
        var userId = User.FindFirst("id")?.Value ?? string.Empty;
        var result = await _stocktakeService.UpdateActualQtyAsync(id, dto, userId);
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }

    [HttpPost("{id}/submit")]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> Submit(string id)
    {
        var userId = User.FindFirst("id")?.Value ?? string.Empty;
        var result = await _stocktakeService.SubmitForApprovalAsync(id, userId);
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }

    [HttpPost("{id}/approve")]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> Approve(string id)
    {
        var userId = User.FindFirst("id")?.Value ?? string.Empty;
        var result = await _stocktakeService.ApproveAsync(id, userId);
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }

    [HttpPost("{id}/reject")]
    public async Task<ActionResult<ApiResponse<StocktakeDto>>> Reject(string id, [FromBody] RejectDto dto)
    {
        var userId = User.FindFirst("id")?.Value ?? string.Empty;
        var result = await _stocktakeService.RejectAsync(id, userId, dto.Reason);
        return Ok(ApiResponse<StocktakeDto>.SuccessResult(result));
    }
}

public class RejectDto
{
    public string Reason { get; set; } = string.Empty;
}
