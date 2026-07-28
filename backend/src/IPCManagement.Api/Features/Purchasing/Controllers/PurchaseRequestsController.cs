using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Purchasing.Controllers;

[ApiController]
[Route("api/purchase-requests")]
[Authorize]
public class PurchaseRequestsController : ControllerBase
{
    private readonly IPurchaseRequestQueryService _queryService;

    public PurchaseRequestsController(IPurchaseRequestQueryService queryService)
    {
        _queryService = queryService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<PurchaseRequestWorkflowResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseRequestsAsync([FromQuery] PurchaseRequestQueryDto query)
    {
        var result = await _queryService.GetPurchaseRequestsAsync(query);
        return Ok(ApiResponse<IReadOnlyList<PurchaseRequestWorkflowResultDto>>.SuccessResult(result));
    }

    [HttpGet("page")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<PurchaseRequestWorkflowResultDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseRequestsPageAsync([FromQuery] PurchaseRequestQueryDto query)
    {
        var result = await _queryService.GetPurchaseRequestsPageAsync(query);
        return Ok(ApiResponse<PagedResponseDto<PurchaseRequestWorkflowResultDto>>.SuccessResult(result));
    }

    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<PurchaseRequestWorkflowResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPurchaseRequestByIdAsync(string id)
    {
        var purchaseRequestId = GuidHelper.ParseGuidString(id);
        if (purchaseRequestId is null)
        {
            return BadRequest(ApiResponse.FailResult("Mã đề xuất không hợp lệ."));
        }

        var result = await _queryService.GetPurchaseRequestByIdAsync(purchaseRequestId);
        return result is null
            ? NotFound(ApiResponse.FailResult("Không tìm thấy đề xuất mua hàng."))
            : Ok(ApiResponse<PurchaseRequestWorkflowResultDto>.SuccessResult(result));
    }
}
