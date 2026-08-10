using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Catalog.Controllers;

[ApiController]
[Route("api/catalog-evidence-resolutions")]
[Authorize]
public sealed class CatalogEvidenceResolutionsController(
    IBomEvidenceResolutionService bomService,
    IDuplicateIngredientResolutionService duplicateService,
    ICurrentUserService currentUser) : ControllerBase
{
    [HttpPost("bom/preview")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    public IActionResult PreviewBom(BomResolutionRequest request, [FromQuery] string commandId)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(bomService.Preview(request, Context(commandId, 0, "Catalog"))));

    [HttpPost("bom/{id}/review")]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public IActionResult ReviewBom(string id, [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(bomService.Review(id, Context(commandId, expectedVersion, "Manager"))));

    [HttpPost("bom/{id}/apply")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public IActionResult ApplyBom(string id, [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(bomService.Apply(id, Context(commandId, expectedVersion, "Admin"), DateTime.UtcNow)));

    [HttpPost("duplicates/preview")]
    [Authorize(Policy = AuthorizationPolicies.CatalogAccess)]
    public IActionResult PreviewDuplicate(DuplicateIngredientResolutionRequest request, [FromQuery] string commandId)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(duplicateService.Preview(request, Context(commandId, 0, "Catalog"))));

    [HttpPost("duplicates/{id}/review")]
    [Authorize(Policy = AuthorizationPolicies.InventoryApproveAccess)]
    public IActionResult ReviewDuplicate(string id, [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(duplicateService.Review(id, Context(commandId, expectedVersion, "Manager"))));

    [HttpPost("duplicates/{id}/apply")]
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    public IActionResult ApplyDuplicate(string id, DuplicateIngredientResolutionRequest request,
        [FromQuery] string commandId, [FromQuery] long expectedVersion)
        => Ok(ApiResponse<EvidenceResolutionState>.SuccessResult(
            duplicateService.Apply(id, request, Context(commandId, expectedVersion, "Admin"), DateTime.UtcNow)));

    private ResolutionCommandContext Context(string commandId, long expectedVersion, string role)
        => new(commandId, expectedVersion, currentUser.GetUserId(User) ?? string.Empty, role, DateTime.UtcNow);
}
