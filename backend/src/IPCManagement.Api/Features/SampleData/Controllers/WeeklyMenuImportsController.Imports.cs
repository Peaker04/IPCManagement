using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Features.SampleData.Controllers;

public sealed partial class WeeklyMenuImportsController
{
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
}
