using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Coordination.Controllers;

[ApiController]
[Route("api/coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
[Tags("Coordination")]
public sealed class CustomerContractsController : ControllerBase
{
    private readonly ICustomerContractService _service;
    private readonly ICurrentUserService _currentUserService;

    public CustomerContractsController(ICustomerContractService service, ICurrentUserService currentUserService)
    {
        _service = service;
        _currentUserService = currentUserService;
    }

    [HttpGet("customer-contracts")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CustomerContractDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerContractsAsync()
        => Ok(ApiResponse<IReadOnlyList<CustomerContractDto>>.SuccessResult(await _service.GetCustomerContractsAsync()));

    [HttpPost("customers/contract")]
    [ProducesResponseType(typeof(ApiResponse<CustomerContractDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCustomerContractAsync([FromBody] CreateCustomerContractRequest request)
    {
        try
        {
            var result = await _service.CreateCustomerContractAsync(request, _currentUserService.GetUserId(User));
            return CreatedAtAction("GetCustomerContracts",
                ApiResponse<CustomerContractDto>.SuccessResult(result, "Đã tạo khách hàng và contract."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPut("customers/{id}/contract")]
    [ProducesResponseType(typeof(ApiResponse<CustomerContractDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCustomerContractAsync(string id, [FromBody] UpdateCustomerContractRequest request)
    {
        try
        {
            var result = await _service.UpdateCustomerContractAsync(
                id,
                request,
                _currentUserService.GetUserId(User),
                HttpContext.TraceIdentifier);
            return result is null
                ? NotFound(ApiResponse.FailResult("Không tìm thấy khách hàng để cập nhật contract."))
                : Ok(ApiResponse<CustomerContractDto>.SuccessResult(result, "Đã cập nhật contract khách hàng."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }
}
