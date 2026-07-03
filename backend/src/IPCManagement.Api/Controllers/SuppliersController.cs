using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SuppliersController : ControllerBase
{
    private readonly ISupplierService _supplierService;

    public SuppliersController(ISupplierService supplierService)
    {
        _supplierService = supplierService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SupplierDto>>>> GetSuppliers(CancellationToken cancellationToken)
    {
        var suppliers = await _supplierService.GetActiveSuppliersAsync(cancellationToken);
        return Ok(ApiResponse<List<SupplierDto>>.SuccessResult(suppliers));
    }

    /// <summary>Tạo nhà cung cấp mới.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SupplierDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateSupplierDto request, CancellationToken cancellationToken)
    {
        try
        {
            var supplier = await _supplierService.CreateAsync(request, cancellationToken);
            return Ok(ApiResponse<SupplierDto>.SuccessResult(supplier, "Tạo nhà cung cấp thành công."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
