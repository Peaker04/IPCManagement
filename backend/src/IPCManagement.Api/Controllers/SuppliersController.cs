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
}
