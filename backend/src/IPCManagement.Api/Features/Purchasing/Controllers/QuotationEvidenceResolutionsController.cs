using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.Purchasing.Controllers;

[ApiController]
[Route("api/quotation-evidence-resolutions")]
[Authorize]
[EnableRateLimiting("api-general")]
public sealed class QuotationEvidenceResolutionsController(
    IQuotationEvidenceResolutionService service,
    ICurrentUserService currentUser) : ControllerBase
{
    [HttpPost("preview")]
    [Authorize(Policy = AuthorizationPolicies.PurchaseAccess)]
    public IActionResult Preview(QuotationResolutionRequest request, [FromQuery] string commandId)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(service.Preview(request, Context(commandId, 0, "Purchasing"))));

    [HttpPost("{id}/review")]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public IActionResult Review(string id, [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(service.Review(id, Context(commandId, expectedVersion, "Manager"))));

    [HttpPost("{id}/apply")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public IActionResult Apply(string id, [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(service.Apply(id, Context(commandId, expectedVersion, "Admin"), DateTime.UtcNow)));

    private ResolutionCommandContext Context(string commandId, long expectedVersion, string role)
        => new(commandId, expectedVersion, currentUser.GetUserId(User) ?? string.Empty, role, DateTime.UtcNow);
}
