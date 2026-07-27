using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Features.Purchasing.Controllers;

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
    public async Task<ActionResult<ApiResponse<List<SupplierDto>>>> GetSuppliersAsync(CancellationToken cancellationToken)
    {
        var suppliers = await _supplierService.GetActiveSuppliersAsync(cancellationToken);
        return Ok(ApiResponse<List<SupplierDto>>.SuccessResult(suppliers));
    }
}
