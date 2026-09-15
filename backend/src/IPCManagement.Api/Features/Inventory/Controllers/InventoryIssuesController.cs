using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Shared.Contracts;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Inventory.Controllers;

[ApiController]
[Route("api/inventory-issues")]
[Authorize(Policy = AuthorizationPolicies.InventoryIssueAccess)]
[EnableRateLimiting("api-general")]
public class InventoryIssuesController : ControllerBase
{
    private readonly IInventoryIssueService _inventoryIssueService;
    private readonly ICurrentUserService _currentUserService;
    private readonly SystemOperationRequestContext _operationContext;

    public InventoryIssuesController(
        IInventoryIssueService inventoryIssueService,
        ICurrentUserService currentUserService,
        SystemOperationRequestContext operationContext)
    {
        _inventoryIssueService = inventoryIssueService;
        _currentUserService = currentUserService;
        _operationContext = operationContext;
    }

    /// <summary>Lấy danh sách phiếu xuất kho.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<InventoryIssueDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllAsync([FromQuery] InventoryIssueFilterRequestDto request)
    {
        try
        {
            EnsureSourceFamilyMatchesActiveMode(request.SourceFamily);
            var scopedRequest = ApplyWarehouseScope(request);
            var result = await _inventoryIssueService.GetPagedAsync(scopedRequest);
            return Ok(ApiResponse<PagedResponseDto<InventoryIssueDto>>.SuccessResult(result));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Lấy chi tiết phiếu xuất kho theo ID.</summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<InventoryIssueDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByIdAsync(
        string id,
        [FromQuery] string sourceFamily = InventoryIssueSourceFamilies.Default)
    {
        try
        {
            EnsureSourceFamilyMatchesActiveMode(sourceFamily);
            var result = await _inventoryIssueService.GetByIdAsync(id, sourceFamily);
            if (result is null)
                return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

            if (!CanAccessWarehouse(result.WarehouseId))
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.FailResult("Không có quyền xem phiếu xuất kho của kho này."));

            return Ok(ApiResponse<InventoryIssueDto>.SuccessResult(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Tạo mới phiếu xuất kho.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<InventoryIssueCreatedDto>), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAsync([FromBody] CreateInventoryIssueRequest dto)
    {
        try
        {
            if (!string.IsNullOrWhiteSpace(dto.ReconciliationBatchId) &&
                !_currentUserService.GetRoleNames(User).Any(role =>
                    AuthorizationPolicies.WarehouseRoles.Contains(role, StringComparer.OrdinalIgnoreCase)))
            {
                return StatusCode(StatusCodes.Status403Forbidden,
                    ApiResponse.FailResult("Chỉ người phụ trách Kho được tạo phiếu xuất cho lô đối chiếu."));
            }

            var userId = _currentUserService.GetUserId(User);
            var result = await _inventoryIssueService.CreateAsync(dto, userId);
            if (result is null)
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

            return CreatedAtAction(
                "GetById",
                new { id = result.IssueId },
                ApiResponse<InventoryIssueCreatedDto>.SuccessResult(result, "Tạo phiếu xuất kho thành công."));
        }
        catch (StockShortageException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message, ex.Shortage));
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
        catch (ResourceConflictException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    /// <summary>Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất kho.</summary>
    [HttpPost("{id}/confirm-receipt")]
    [ProducesResponseType(typeof(ApiResponse<InventoryIssueDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmReceiptAsync(string id, [FromBody] ConfirmInventoryIssueReceiptRequest dto)
    {
        try
        {
            var userId = _currentUserService.GetUserId(User);
            if (userId is null)
                return Unauthorized(ApiResponse.FailResult("Không xác định được người dùng."));

            var result = await _inventoryIssueService.ConfirmReceiptAsync(id, dto, userId);
            if (result is null)
                return NotFound(ApiResponse.FailResult($"Không tìm thấy phiếu xuất kho với ID: {id}"));

            return Ok(ApiResponse<InventoryIssueDto>.SuccessResult(result, "Bếp đã xác nhận nhận nguyên liệu."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    private void EnsureSourceFamilyMatchesActiveMode(string sourceFamily)
    {
        var knownFamily = sourceFamily.Equals(InventoryIssueSourceFamilies.Default, StringComparison.OrdinalIgnoreCase)
            || sourceFamily.Equals(InventoryIssueSourceFamilies.MaterialReconciliation, StringComparison.OrdinalIgnoreCase)
            || sourceFamily.Equals(InventoryIssueSourceFamilies.LegacyUnclassified, StringComparison.OrdinalIgnoreCase);
        if (!knownFamily) return;

        var expectedFamily = _operationContext.Mode == SystemOperationEligibility.MaterialReconciliation
            ? InventoryIssueSourceFamilies.MaterialReconciliation
            : InventoryIssueSourceFamilies.Default;
        if (!string.Equals(sourceFamily, expectedFamily, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Nguồn phiếu xuất kho không thuộc chế độ vận hành hiện tại.", nameof(sourceFamily));
    }

    private InventoryIssueFilterRequestDto ApplyWarehouseScope(InventoryIssueFilterRequestDto request)
    {
        var scopedWarehouseId = GetScopedWarehouseId();
        if (scopedWarehouseId is null)
        {
            return request;
        }

        if (!string.IsNullOrWhiteSpace(request.WarehouseId) &&
            !string.Equals(request.WarehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Không có quyền xem phiếu xuất kho của kho khác.");
        }

        request.WarehouseId = scopedWarehouseId;
        return request;
    }

    private bool CanAccessWarehouse(string warehouseId)
    {
        var scopedWarehouseId = GetScopedWarehouseId();
        return scopedWarehouseId is null ||
            string.Equals(warehouseId, scopedWarehouseId, StringComparison.OrdinalIgnoreCase);
    }

    private string? GetScopedWarehouseId()
    {
        var roles = _currentUserService.GetRoleNames(User);
        var hasInventoryRole = roles.Any(AuthorizationPolicies.IsInventoryRole);
        var hasProductionRole = roles.Any(AuthorizationPolicies.IsProductionRole);
        if (hasInventoryRole)
        {
            return null;
        }

        if (!hasProductionRole)
        {
            throw new UnauthorizedAccessException("Không có quyền xem phiếu xuất kho.");
        }

        var warehouseId = _currentUserService.GetWarehouseId(User);
        if (string.IsNullOrWhiteSpace(warehouseId) || GuidHelper.ParseGuidString(warehouseId) is null)
        {
            throw new UnauthorizedAccessException("Tài khoản bếp chưa được gán kho để xem phiếu xuất kho.");
        }

        return warehouseId;
    }
}
