using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Purchasing.Controllers;

[ApiController]
[Route("api/warehouse/purchase-orders/{purchaseOrderId}/receipts")]
[Authorize(Policy = AuthorizationPolicies.WarehousePurchaseReceive)]
[EnableRateLimiting("api-general")]
public sealed class WarehousePurchaseReceiptsController : ControllerBase
{
    private readonly IPurchaseReceivingService _purchaseReceivingService;
    private readonly ICurrentUserService _currentUserService;

    public WarehousePurchaseReceiptsController(
        IPurchaseReceivingService purchaseReceivingService,
        ICurrentUserService currentUserService)
    {
        _purchaseReceivingService = purchaseReceivingService;
        _currentUserService = currentUserService;
    }

    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<WarehousePurchaseReceiptResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RecordAsync(
        string purchaseOrderId,
        [FromBody] RecordWarehousePurchaseReceiptRequest request,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(purchaseOrderId, request.PurchaseOrderId, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(ApiResponse.FailResult("Đơn mua hàng trên đường dẫn không khớp nội dung phiếu nhập."));
        }

        try
        {
            var userId = _currentUserService.GetUserId(User);
            var result = await _purchaseReceivingService.RecordAsync(request, userId, cancellationToken);
            return Ok(ApiResponse<WarehousePurchaseReceiptResultDto>.SuccessResult(
                result,
                "Ghi nhận nhập kho từ đơn mua hàng thành công."));
        }
        catch (KeyNotFoundException exception)
        {
            return NotFound(ApiResponse.FailResult(exception.Message));
        }
        catch (ArgumentException exception)
        {
            return BadRequest(ApiResponse.FailResult(exception.Message));
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(ApiResponse.FailResult(exception.Message));
        }
    }
}
