using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/purchase-orders")]
[Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
[EnableRateLimiting("api-general")]
public class PurchaseOrdersController : ControllerBase
{
    private readonly IPurchaseOrderService _purchaseOrderService;
    private readonly ICurrentUserService _currentUserService;

    public PurchaseOrdersController(IPurchaseOrderService purchaseOrderService, ICurrentUserService currentUserService)
    {
        _purchaseOrderService = purchaseOrderService;
        _currentUserService = currentUserService;
    }

    /// <summary>Lấy danh sách đơn mua hàng, có thể lọc theo trạng thái.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchaseOrderDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetList([FromQuery] string? status, CancellationToken cancellationToken)
    {
        var orders = await _purchaseOrderService.GetListAsync(status, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<PurchaseOrderDto>>.SuccessResult(orders));
    }

    /// <summary>Lấy chi tiết một đơn mua hàng kèm các dòng.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(string id, CancellationToken cancellationToken)
    {
        var order = await _purchaseOrderService.GetByIdAsync(id, cancellationToken);
        if (order is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy đơn mua hàng."));
        }

        return Ok(ApiResponse<PurchaseOrderDto>.SuccessResult(order));
    }

    /// <summary>Tạo đơn mua hàng (theo từng nhà cung cấp) từ một đề xuất mua hàng đã được duyệt.</summary>
    [HttpPost("from-request/{purchaseRequestId}")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchaseOrderDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateFromRequest(string purchaseRequestId, CancellationToken cancellationToken)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            var orders = await _purchaseOrderService.CreateFromApprovedRequestAsync(purchaseRequestId, userId, cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<PurchaseOrderDto>>.SuccessResult(orders, "Tạo đơn mua hàng thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Ghi nhận số lượng đã nhận cho các dòng của một đơn mua hàng.</summary>
    [HttpPost("{id}/receive")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordReceipt(string id, [FromBody] RecordPurchaseOrderReceiptDto request, CancellationToken cancellationToken)
    {
        try
        {
            var order = await _purchaseOrderService.RecordReceiptAsync(id, request, cancellationToken);
            return Ok(ApiResponse<PurchaseOrderDto>.SuccessResult(order, "Ghi nhận nhận hàng thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Hủy một đơn mua hàng chưa nhận hàng.</summary>
    [HttpPost("{id}/cancel")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseOrderDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Cancel(string id, CancellationToken cancellationToken)
    {
        try
        {
            var order = await _purchaseOrderService.CancelAsync(id, cancellationToken);
            return Ok(ApiResponse<PurchaseOrderDto>.SuccessResult(order, "Hủy đơn mua hàng thành công."));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
