using System.Globalization;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Mvc;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.SampleData.Controllers;

public sealed partial class WeeklyMenuImportsController
{
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

    [HttpGet("weekly-menu/import-history")]
    [ProducesResponseType(typeof(ApiResponse<PagedResponseDto<WeeklyMenuImportHistoryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWeeklyMenuImportHistoryAsync(
        [FromQuery] string? customerId,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        [FromQuery] PagedRequestDto request,
        CancellationToken cancellationToken)
    {
        var history = await _historyService.GetWeeklyMenuImportHistoryAsync(customerId, fromDate, toDate, request, cancellationToken);
        return Ok(ApiResponse<PagedResponseDto<WeeklyMenuImportHistoryItemDto>>.SuccessResult(history));
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
}
