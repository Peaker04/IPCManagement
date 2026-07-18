using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/supplier-quotations")]
[Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
[EnableRateLimiting("api-general")]
public class SupplierQuotationsController : ControllerBase
{
    private readonly ISupplierQuotationService _supplierQuotationService;

    public SupplierQuotationsController(ISupplierQuotationService supplierQuotationService)
    {
        _supplierQuotationService = supplierQuotationService;
    }

    /// <summary>Lấy toàn bộ báo giá của các nhà cung cấp cho một nguyên liệu, kèm cờ đánh dấu giá tốt nhất hiện hành.</summary>
    [HttpGet("ingredient/{ingredientId}")]
    [ProducesResponseType(typeof(ApiResponse<List<SupplierQuotationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByIngredient(string ingredientId, CancellationToken cancellationToken)
    {
        var quotations = await _supplierQuotationService.GetByIngredientAsync(ingredientId, cancellationToken);
        return Ok(ApiResponse<List<SupplierQuotationDto>>.SuccessResult(quotations));
    }

    [HttpGet("ingredient/{ingredientId}/page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<SupplierQuotationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByIngredientPage(string ingredientId, [FromQuery] SupplierQuotationPageQueryDto query, CancellationToken cancellationToken)
    {
        var quotations = await _supplierQuotationService.GetByIngredientPageAsync(ingredientId, query, cancellationToken);
        return Ok(ApiResponse<PagedResponseDto<SupplierQuotationDto>>.SuccessResult(quotations));
    }

    /// <summary>Lấy toàn bộ báo giá của một nhà cung cấp cho các nguyên liệu.</summary>
    [HttpGet("supplier/{supplierId}")]
    [ProducesResponseType(typeof(ApiResponse<List<SupplierQuotationDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBySupplier(string supplierId, CancellationToken cancellationToken)
    {
        var quotations = await _supplierQuotationService.GetBySupplierAsync(supplierId, cancellationToken);
        return Ok(ApiResponse<List<SupplierQuotationDto>>.SuccessResult(quotations));
    }

    /// <summary>Tạo báo giá mới của một nhà cung cấp cho một nguyên liệu.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SupplierQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create([FromBody] CreateSupplierQuotationDto request, CancellationToken cancellationToken)
    {
        try
        {
            var quotation = await _supplierQuotationService.CreateAsync(request, cancellationToken);
            return Ok(ApiResponse<SupplierQuotationDto>.SuccessResult(quotation, "Tạo báo giá thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Cập nhật một báo giá đã có.</summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<SupplierQuotationDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateSupplierQuotationDto request, CancellationToken cancellationToken)
    {
        try
        {
            var quotation = await _supplierQuotationService.UpdateAsync(id, request, cancellationToken);
            return Ok(ApiResponse<SupplierQuotationDto>.SuccessResult(quotation, "Cập nhật báo giá thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Ngừng hiệu lực một báo giá (soft-delete).</summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deactivate(string id, CancellationToken cancellationToken)
    {
        try
        {
            await _supplierQuotationService.DeactivateAsync(id, cancellationToken);
            return Ok(ApiResponse.SuccessResult("Ngừng báo giá thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
