using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.Reconciliation.Controllers;

[ApiController, Route("api/reconciliation/batches"), Authorize]
[SystemOperation("reconciliation.batches.read", OperationDisposition.ReconciliationOnly)]
public sealed class ReconciliationBatchesController : ControllerBase
{
    private readonly ReconciliationBatchService service;
    private readonly ReconciliationCompletionService completion;
    private readonly ReconciliationQuantityImportService quantityImports;
    private readonly ICurrentUserService currentUser;

    public ReconciliationBatchesController(ReconciliationBatchService service, ReconciliationCompletionService completion, ReconciliationQuantityImportService quantityImports, ICurrentUserService currentUser)
    {
        this.service = service;
        this.completion = completion;
        this.quantityImports = quantityImports;
        this.currentUser = currentUser;
    }

    [HttpGet, Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationBatchDto>>), StatusCodes.Status200OK)] public async Task<IActionResult> List(CancellationToken token)
    {
        var items = await service.ListAsync(token);
        return Ok(ApiResponse<IReadOnlyList<ReconciliationBatchDto>>.SuccessResult(CanReadReconciliationDetails() ? items : items.Select(ToOperationalScope).ToList()));
    }
    [HttpGet("draft-sources"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationDraftSourceDto>>), StatusCodes.Status200OK)] public async Task<IActionResult> DraftSources(CancellationToken token) => Ok(ApiResponse<IReadOnlyList<ReconciliationDraftSourceDto>>.SuccessResult(await service.ListDraftSourcesAsync(token)));
    [HttpGet("{id}"), Authorize(Policy = AuthorizationPolicies.ReconciliationReadAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Get(string id, CancellationToken token) { var item = await service.GetAsync(id, token); return item is null ? NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu.")) : Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(CanReadReconciliationDetails() ? item : ToOperationalScope(item))); }
    [HttpGet("{id}/warehouse-daily"), Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationWarehouseDailyDto>), StatusCodes.Status200OK)] public async Task<IActionResult> WarehouseDaily(string id, CancellationToken token) { var item = await service.GetWarehouseDailyAsync(id, token); return item is null ? NotFound(ApiResponse.FailResult("Không tìm thấy lô đối chiếu.")) : Ok(ApiResponse<ReconciliationWarehouseDailyDto>.SuccessResult(item)); }
    [HttpGet("{id}/source-changes"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationSourceChangeDto>>), StatusCodes.Status200OK)] public async Task<IActionResult> SourceChanges(string id, CancellationToken token) => Ok(ApiResponse<IReadOnlyList<ReconciliationSourceChangeDto>>.SuccessResult(await service.ListSourceChangesAsync(id, token)));
    [HttpGet("{id}/dishes"), Authorize(Policy = AuthorizationPolicies.ReconciliationWarehouseReadAccess), ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ReconciliationBatchDishSummaryDto>>), StatusCodes.Status200OK)] public async Task<IActionResult> Dishes(string id, CancellationToken token) => Ok(ApiResponse<IReadOnlyList<ReconciliationBatchDishSummaryDto>>.SuccessResult(await service.ListDishesAsync(id, token)));
    [HttpPost("quantity-import/preview"), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<QuantityImportPreviewDto>), StatusCodes.Status200OK)] public async Task<IActionResult> PreviewQuantityImport(PreviewQuantityImportRequest request, CancellationToken token) => Ok(ApiResponse<QuantityImportPreviewDto>.SuccessResult(await quantityImports.PreviewAsync(request, token)));
    [HttpPost("quantity-import/commit"), SystemOperation("reconciliation.quantity-import.commit", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<QuantityImportCommitDto>), StatusCodes.Status200OK)] public async Task<IActionResult> CommitQuantityImport(CommitQuantityImportRequest request, CancellationToken token) => Ok(ApiResponse<QuantityImportCommitDto>.SuccessResult(await quantityImports.CommitAsync(request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost, SystemOperation("reconciliation.batches.create", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Create(CreateReconciliationDraftRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await service.CreateDraftAsync(request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost("{id}/ready"), SystemOperation("reconciliation.batches.ready", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Ready(string id, ReadyReconciliationBatchRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await service.ReadyAsync(id, request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost("{id}/transfer-to-warehouse"), SystemOperation("reconciliation.batches.transfer", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationSourceReadAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationWarehouseTransferDto>), StatusCodes.Status200OK)] public async Task<IActionResult> TransferToWarehouse(string id, TransferReconciliationBatchRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationWarehouseTransferDto>.SuccessResult(await service.TransferToWarehouseAsync(id, request, currentUser.GetUserId(User) ?? "", token)));
    [HttpPost("{id}/complete"), SystemOperation("reconciliation.batches.complete", OperationDisposition.ReconciliationOnly), Authorize(Policy = AuthorizationPolicies.ReconciliationCompleteAccess), ProducesResponseType(typeof(ApiResponse<ReconciliationBatchDto>), StatusCodes.Status200OK)] public async Task<IActionResult> Complete(string id, CompleteReconciliationBatchRequest request, CancellationToken token) => Ok(ApiResponse<ReconciliationBatchDto>.SuccessResult(await completion.CompleteAsync(id, request, currentUser.GetUserId(User) ?? "", token)));

    private bool CanReadReconciliationDetails() => currentUser.GetRoleNames(User).Any(role =>
        AuthorizationPolicies.ReconciliationDecisionRoles.Contains(role, StringComparer.OrdinalIgnoreCase)
        || AuthorizationPolicies.ReconciliationSourceReadRoles.Contains(role, StringComparer.OrdinalIgnoreCase));

    private static ReconciliationBatchDto ToOperationalScope(ReconciliationBatchDto item) => item with
    {
        MenuVersionId = string.Empty,
        QuantityImportBatchId = string.Empty,
        Lines = []
    };
}
