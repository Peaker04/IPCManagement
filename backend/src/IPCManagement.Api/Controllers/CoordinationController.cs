using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.SampleData;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.SampleData;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Controllers;

[ApiController]
[Route("api/coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public class CoordinationController : ControllerBase
{
    private readonly ICoordinationService _coordinationService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ISampleDataImportService _sampleDataImportService;

    public CoordinationController(
        ICoordinationService coordinationService,
        ICurrentUserService currentUserService,
        ISampleDataImportService sampleDataImportService)
    {
        _coordinationService = coordinationService;
        _currentUserService = currentUserService;
        _sampleDataImportService = sampleDataImportService;
    }

    [HttpGet("orders")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CoordinationOrderDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? serviceDate,
        [FromQuery] string? dayOfWeek,
        [FromQuery] string? shiftName,
        [FromQuery] string? shift)
    {
        var result = await _coordinationService.GetActiveOrdersAsync(new CoordinationOrdersQueryDto
        {
            ServiceDate = serviceDate,
            DayOfWeek = dayOfWeek,
            ShiftName = shiftName,
            Shift = shift
        });

        return Ok(ApiResponse<IReadOnlyList<CoordinationOrderDto>>.SuccessResult(result));
    }

    [HttpGet("customers")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<CoordinationCustomerOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomers(CancellationToken cancellationToken)
    {
        var result = await _sampleDataImportService.GetActiveCustomersAsync(cancellationToken);
        return Ok(ApiResponse<IReadOnlyList<CoordinationCustomerOptionDto>>.SuccessResult(result));
    }

    [HttpGet("weekly-menu")]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto?>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetWeeklyMenu(
        [FromQuery] string customerId,
        [FromQuery] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng chọn khách hàng để tải thực đơn tuần."));
        }

        var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
        var result = await _sampleDataImportService.GetCommittedWeeklyMenuAsync(
            customerId,
            parsedWeekStart,
            cancellationToken);

        return Ok(ApiResponse<WeeklyMenuImportResultDto?>.SuccessResult(
            result,
            result is null ? "Chưa có thực đơn tuần đã lưu." : "Đã tải thực đơn tuần đã lưu."));
    }

    [HttpGet("menu-schedules")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MenuScheduleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMenuSchedules([FromQuery] MenuScheduleQueryDto query)
    {
        var result = await _coordinationService.GetMenuSchedulesAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MenuScheduleDto>>.SuccessResult(result));
    }

    [HttpGet("meal-quantity-plans")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMealQuantityPlans([FromQuery] MealQuantityPlanQueryDto query)
    {
        var result = await _coordinationService.GetMealQuantityPlansAsync(query);
        return Ok(ApiResponse<IReadOnlyList<MealQuantityPlanDto>>.SuccessResult(result));
    }

    [HttpPost("orders/lock")]
    [ProducesResponseType(typeof(ApiResponse<LockOrderPlanResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LockOrderPlan([FromBody] LockOrderPlanRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.LockOrderPlanAsync(request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy kế hoạch suất ăn để chốt."));
        }

        return Ok(ApiResponse<LockOrderPlanResultDto>.SuccessResult(result, "Chốt đơn thành công."));
    }

    [HttpPost("weekly-menu/import")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportWeeklyMenu(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        await Task.CompletedTask;
        return BadRequest(ApiResponse.FailResult("Vui lòng dùng luồng xem trước và xác nhận lưu thực đơn."));
    }

    [HttpPost("weekly-menu/import/preview")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PreviewWeeklyMenuImport(
        IFormFile file,
        [FromForm] string customerId,
        [FromForm] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng tải lên file Excel hợp lệ."));
        }

        var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
        using var stream = file.OpenReadStream();
        var result = await _sampleDataImportService.PreviewWeeklyMenuImportAsync(
            stream,
            file.FileName,
            customerId,
            parsedWeekStart,
            cancellationToken);

        return Ok(ApiResponse<WeeklyMenuImportResultDto>.SuccessResult(result, "Đã phân tích file thực đơn. Vui lòng kiểm tra trước khi lưu."));
    }

    [HttpPost("weekly-menu/import/commit")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<WeeklyMenuImportResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CommitWeeklyMenuImport(
        IFormFile file,
        [FromForm] string customerId,
        [FromForm] string? weekStartDate,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse.FailResult("Vui lòng tải lên file Excel hợp lệ."));
        }

        var parsedWeekStart = ParseOptionalWeekStartDate(weekStartDate);
        using var stream = file.OpenReadStream();
        var result = await _sampleDataImportService.CommitWeeklyMenuImportAsync(
            stream,
            file.FileName,
            customerId,
            parsedWeekStart,
            cancellationToken);

        return Ok(ApiResponse<WeeklyMenuImportResultDto>.SuccessResult(result, "Đã lưu thực đơn tuần từ file Excel."));
    }

    [HttpGet("customers/{customerId}/import-mapping")]
    [ProducesResponseType(typeof(ApiResponse<CustomerImportMappingDto?>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerImportMapping(
        string customerId,
        CancellationToken cancellationToken)
    {
        var mapping = await _sampleDataImportService.GetCustomerImportMappingAsync(customerId, cancellationToken);
        return Ok(ApiResponse<CustomerImportMappingDto?>.SuccessResult(mapping));
    }

    [HttpPut("customers/{customerId}/import-mapping")]
    [ProducesResponseType(typeof(ApiResponse<CustomerImportMappingDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveCustomerImportMapping(
        string customerId,
        [FromBody] SaveCustomerImportMappingDto request,
        CancellationToken cancellationToken)
    {
        var mapping = await _sampleDataImportService.SaveCustomerImportMappingAsync(customerId, request, cancellationToken);
        return Ok(ApiResponse<CustomerImportMappingDto>.SuccessResult(mapping, "Đã lưu cấu hình mapping cho khách hàng."));
    }

    [HttpPost("orders/adjust")]
    [ProducesResponseType(typeof(ApiResponse<AdjustOrderAfterLockResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustOrderAfterLock([FromBody] AdjustOrderAfterLockRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.AdjustOrderAfterLockAsync(request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        return Ok(ApiResponse<AdjustOrderAfterLockResultDto>.SuccessResult(result, "Điều chỉnh đơn thành công."));
    }

    [HttpPost("orders/{id}/signoff")]
    [ProducesResponseType(typeof(ApiResponse<SignoffOrderResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SignoffOrder(string id, [FromBody] SignoffOrderRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);

        SignoffOrderResultDto? result;
        try
        {
            result = await _coordinationService.SignoffOrderAsync(id, request, userId);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse.FailResult(ex.Message));
        }

        if (result is null)
        {
            return NotFound(ApiResponse.FailResult($"Không tìm thấy kế hoạch với ID: {id}"));
        }

        return Ok(ApiResponse<SignoffOrderResultDto>.SuccessResult(result, "Hoàn tất ca thành công."));
    }

    [HttpPatch("orders/{id}/servings")]
    [ProducesResponseType(typeof(ApiResponse<AdjustServingsResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustServings([FromRoute] string id, [FromBody] AdjustServingsRequestDto request)
    {
        var userId = _currentUserService.GetUserId(User);
        var result = await _coordinationService.AdjustServingsAsync(id, request, userId);
        if (result is null)
        {
            return NotFound(ApiResponse.FailResult("Không tìm thấy dòng kế hoạch suất ăn để điều chỉnh."));
        }

        return Ok(ApiResponse<AdjustServingsResultDto>.SuccessResult(result, "Điều chỉnh số suất ăn thành công."));
    }

    [HttpPost("orders/export")]
    [ProducesResponseType(typeof(ApiResponse<ExportOrderReportResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportOrderReport([FromBody] ExportOrderReportRequestDto request)
    {
        var result = await _coordinationService.ExportOrderReportAsync(request);
        return Ok(ApiResponse<ExportOrderReportResultDto>.SuccessResult(result, "Tạo báo cáo thành công."));
    }

    private static DateOnly? ParseOptionalWeekStartDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParse(value, out var parsed) ? parsed : null;
    }
}
