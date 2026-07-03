using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Unit;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly IUnitService _unitService;

    public UnitsController(IUnitService unitService)
    {
        _unitService = unitService;
    }

    /// <summary>Lấy danh sách đơn vị tính.</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var units = await _unitService.GetAllAsync(cancellationToken);
        return Ok(ApiResponse<List<UnitDto>>.SuccessResult(units));
    }
}
