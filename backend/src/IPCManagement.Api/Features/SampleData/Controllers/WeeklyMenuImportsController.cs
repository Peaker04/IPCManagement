
using System.Globalization;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Controllers;

[ApiController]
[Route("api/coordination")]
[Tags("Coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public sealed class WeeklyMenuImportsController : ControllerBase
{
    /// <summary>
    /// Hạn mức dung lượng cho mọi file Excel tải lên luồng thực đơn tuần.
    /// Trỏ về hằng số dùng chung <see cref="XlsxSecurityLimits.MaxUploadBytes"/> để mọi endpoint
    /// nhận file Excel (thực đơn tuần, import BOM) chỉ có MỘT nguồn sự thật về hạn mức;
    /// căn cứ đo đạc xem tại chính hằng số đó.
    /// </summary>
    private const long MaxUploadBytes = XlsxSecurityLimits.MaxUploadBytes;

    private readonly IWeeklyMenuQueryService _queryService;
    private readonly IWeeklyMenuTemplateService _templateService;
    private readonly IWeeklyMenuImportService _importService;
    private readonly IWeeklyMenuImportHistoryService _historyService;
    private readonly ICustomerImportMappingService _mappingService;
    private readonly IWeeklyMenuBulkEditService _bulkEditService;
    private readonly IMenuAmendmentService _menuAmendmentService;
    private readonly ICurrentUserService _currentUserService;

    public WeeklyMenuImportsController(
        IWeeklyMenuQueryService queryService,
        IWeeklyMenuTemplateService templateService,
        IWeeklyMenuImportService importService,
        IWeeklyMenuImportHistoryService historyService,
        ICustomerImportMappingService mappingService,
        IWeeklyMenuBulkEditService bulkEditService,
        IMenuAmendmentService menuAmendmentService,
        ICurrentUserService currentUserService)
    {
        _queryService = queryService;
        _templateService = templateService;
        _importService = importService;
        _historyService = historyService;
        _mappingService = mappingService;
        _bulkEditService = bulkEditService;
        _menuAmendmentService = menuAmendmentService;
        _currentUserService = currentUserService;
    }

    [HttpGet("customers")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CoordinationCustomerOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomersAsync(CancellationToken cancellationToken)
    {
        var result = await _queryService.GetActiveCustomersAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CoordinationCustomerOptionDto>>.SuccessResult(result));
    }

    [HttpGet("weekly-menu")]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto?>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetWeeklyMenuAsync(
        [FromQuery] string customerId,
        [FromQuery] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng chọn khách hàng để tải thực đơn tuần."));
        }

        var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
        var result = await _queryService.GetCommittedWeeklyMenuAsync(
            customerId,
            parsedWeekStart,
            cancellationToken);

        return Ok(ApiResponse<WeeklyMenuImportResultDto?>.SuccessResult(
            result,
            result is null ? "Chưa có thực đơn tuần đã lưu." : "Đã tải thực đơn tuần đã lưu."));
    }

    [HttpPost("weekly-menu/import")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> ImportWeeklyMenuAsync(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        return BadRequest(ApiResponse.FailResult("Vui lòng dùng luồng xem trước và xác nhận lưu thực đơn."));
    }

    [HttpGet("weekly-menu/template")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> DownloadWeeklyMenuTemplateAsync(
        [FromQuery] string? customerId,
        [FromQuery] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
        var template = await _templateService.BuildWeeklyMenuTemplateAsync(
            customerId,
            parsedWeekStart,
            cancellationToken);
        var fileDate = (parsedWeekStart ?? DateOnly.FromDateTime(DateTime.UtcNow))
            .ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        return File(
            template.Content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"weekly-menu-template-{template.CustomerCode}-{fileDate}.xlsx");
    }

    [HttpPost("weekly-menu/import/preview")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> PreviewWeeklyMenuImportAsync(
        IFormFile file,
        [FromForm] string customerId,
        [FromForm] string? weekStartDate,
        [FromForm] decimal? priceTierAmount,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng tải lên file Excel hợp lệ."));
        }

        try
        {
            var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
            using var stream = file.OpenReadStream();
            var result = await _importService.PreviewWeeklyMenuImportAsync(
                stream,
                file.FileName,
                customerId,
                parsedWeekStart,
                priceTierAmount,
                cancellationToken);

            return Ok(ApiResponse<WeeklyMenuImportResultDto>.SuccessResult(
                result,
                "Đã phân tích file thực đơn. Vui lòng kiểm tra trước khi lưu."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/import/commit")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaxUploadBytes)]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> CommitWeeklyMenuImportAsync(
        IFormFile file,
        [FromForm] string customerId,
        [FromForm] string? weekStartDate,
        [FromForm] decimal? priceTierAmount, [FromForm] string? previewToken,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng tải lên file Excel hợp lệ."));
        }

        try
        {
            var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
            var userId = _currentUserService.GetUserId(User);
            using var stream = file.OpenReadStream();
            var result = await _importService.CommitWeeklyMenuImportAsync(
                stream,
                file.FileName,
                customerId,
                parsedWeekStart,
                priceTierAmount, previewToken,
                userId,
                cancellationToken);

            return Ok(ApiResponse<WeeklyMenuImportResultDto>.SuccessResult(
                result,
                "Đã lưu thực đơn tuần từ file Excel."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("weekly-menu/import-history")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WeeklyMenuImportHistoryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWeeklyMenuImportHistoryAsync(
        [FromQuery] string? customerId,
        CancellationToken cancellationToken)
    {
        var history = await _historyService.GetWeeklyMenuImportHistoryAsync(customerId, cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<WeeklyMenuImportHistoryItemDto>>.SuccessResult(history));
    }

    [HttpPost("weekly-menu/import/{menuVersionId}/rollback")]
    [ProducesResponseType(typeof(ApiResponse<RollbackWeeklyMenuImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> RollbackWeeklyMenuImportAsync(
        string menuVersionId,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _historyService.RollbackWeeklyMenuImportAsync(
                menuVersionId,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<RollbackWeeklyMenuImportResultDto>.SuccessResult(
                result,
                "Đã hủy phiên import thực đơn."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpGet("customers/{customerId}/import-mapping")]
    [ProducesResponseType(typeof(ApiResponse<CustomerImportMappingDto?>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken)
    {
        var mapping = await _mappingService.GetCustomerImportMappingAsync(customerId, cancellationToken);
        return Ok(ApiResponse<CustomerImportMappingDto?>.SuccessResult(mapping));
    }

    [HttpPut("customers/{customerId}/import-mapping")]
    [ProducesResponseType(typeof(ApiResponse<CustomerImportMappingDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveCustomerImportMappingAsync(
        string customerId,
        [FromBody] SaveCustomerImportMappingRequest request,
        CancellationToken cancellationToken)
    {
        var mapping = await _mappingService.SaveCustomerImportMappingAsync(
            customerId,
            request,
            cancellationToken);
        return Ok(ApiResponse<CustomerImportMappingDto>.SuccessResult(
            mapping,
            "Đã lưu cấu hình mapping cho khách hàng."));
    }

    [HttpPut("weekly-menu/bulk-update")]
    [ProducesResponseType(typeof(ApiResponse<List<string>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> BulkUpdateWeeklyMenuAsync(
        [FromBody] BulkUpdateWeeklyMenuRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.CustomerId))
        {
            return BadRequest(ApiResponse.FailResult("Dữ liệu cập nhật thực đơn không hợp lệ."));
        }

        var (success, message, warnings) = await _bulkEditService.BulkUpdateWeeklyMenuAsync(
            request,
            cancellationToken);
        if (!success)
        {
            return BadRequest(ApiResponse.FailResult(message));
        }

        return Ok(ApiResponse<List<string>>.SuccessResult(warnings, message));
    }

    [HttpPost("weekly-menu/amendments")]
    [ProducesResponseType(typeof(ApiResponse<MenuAmendmentResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateMenuAmendmentAsync(
        [FromBody] CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.CreateAsync(
                request,
                _currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(
                result,
                result.RequiresReconciliation
                    ? "Đã tạo yêu cầu thay đổi; cần đối soát chứng từ phía sau."
                    : "Đã tạo yêu cầu thay đổi thực đơn, chờ review."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
    }

    [HttpPost("weekly-menu/amendments/{amendmentId}/review")]
    [Authorize(Roles = "Admin,ADMIN,Manager,MANAGER,Quản lý")]
    public async Task<IActionResult> ReviewMenuAmendmentAsync(string amendmentId, [FromBody] ReviewMenuAmendmentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _menuAmendmentService.ReviewAsync(amendmentId, request, _currentUserService.GetUserId(User), cancellationToken);
            return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(result, "Đã hậu kiểm yêu cầu thay đổi thực đơn."));
        }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse.FailResult(ex.Message)); }
        catch (BusinessRuleException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
    }

    [HttpPost("weekly-menu/amendments/{amendmentId}/execute")]
    [Authorize(Roles = "Admin,ADMIN,Manager,MANAGER,Quản lý")]
    public async Task<IActionResult> ExecuteMenuAmendmentAsync(string amendmentId, CancellationToken cancellationToken)
    {
        try { return Ok(ApiResponse<MenuAmendmentResultDto>.SuccessResult(await _menuAmendmentService.ExecuteAsync(amendmentId, _currentUserService.GetUserId(User), cancellationToken), "Đã thực thi thay đổi thực đơn.")); }
        catch (KeyNotFoundException ex) { return NotFound(ApiResponse.FailResult(ex.Message)); }
        catch (BusinessRuleException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
        catch (ArgumentException ex) { return BadRequest(ApiResponse.FailResult(ex.Message)); }
    }

    [HttpGet("weekly-menu/amendments")]
    public async Task<IActionResult> GetMenuAmendmentsAsync([FromQuery] string? status, CancellationToken cancellationToken)
        => Ok(ApiResponse<IReadOnlyList<MenuAmendmentInboxItemDto>>.SuccessResult(await _menuAmendmentService.GetInboxAsync(status, cancellationToken)));

    private static DateOnly? ParseOptionalWeekStartDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParse(value, out var parsed) ? parsed : null;
    }
}
