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
[Authorize]
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
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
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

    [HttpPost("{receiptId}/quality")]
    [Authorize(Policy = AuthorizationPolicies.WarehousePurchaseReceive)]
    [ProducesResponseType(typeof(ApiResponse<WarehousePurchaseReceiptResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> AcceptQualityAsync(
        string receiptId,
        [FromBody] ReceiptQualityDecisionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseReceivingService.AcceptQualityAsync(receiptId, request, _currentUserService.GetUserId(User), cancellationToken);
            return Ok(ApiResponse<WarehousePurchaseReceiptResultDto>.SuccessResult(result, "Đã ghi nhận kết quả kiểm tra chất lượng."));
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

    [HttpPost("{receiptId}/post")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<WarehousePurchaseReceiptResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PostAsync(
        string receiptId,
        [FromBody] ReceiptPostRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseReceivingService.PostAsync(receiptId, request, _currentUserService.GetUserId(User), cancellationToken);
            return Ok(ApiResponse<WarehousePurchaseReceiptResultDto>.SuccessResult(result, "Đã POSTED phiếu nhập kho và ghi nhận tồn kho."));
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

    [HttpPost("{receiptId}/rework")]
    [Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
    [ProducesResponseType(typeof(ApiResponse<WarehousePurchaseReceiptResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ReworkAsync(
        string receiptId,
        [FromBody] ReceiptReworkRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseReceivingService.ReworkAsync(
                receiptId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<WarehousePurchaseReceiptResultDto>.SuccessResult(
                result,
                "Đã trả phiếu nhập về bước kiểm tra lại."));
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

    [HttpPost("{receiptId}/void")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<WarehousePurchaseReceiptResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> VoidAsync(
        string receiptId,
        [FromBody] ReceiptVoidRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseReceivingService.VoidAsync(
                receiptId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<WarehousePurchaseReceiptResultDto>.SuccessResult(
                result,
                "Đã hủy phiếu nhập có audit; tồn kho chưa thay đổi."));
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

    [HttpPost("{receiptId}/corrections")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [ProducesResponseType(typeof(ApiResponse<ReceiptCorrectionResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateCorrectionAsync(
        string receiptId,
        [FromBody] CreateReceiptCorrectionRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchaseReceivingService.CreateCorrectionAsync(
                receiptId,
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<ReceiptCorrectionResultDto>.SuccessResult(
                result,
                "Đã POSTED chứng từ correction của phiếu nhập."));
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
