using System.Globalization;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace IPCManagement.Api.Features.SampleData.Controllers;

[ApiController]
[Route("api/coordination")]
[Tags("Coordination")]
[Authorize(Policy = AuthorizationPolicies.CoordinationAccess)]
[EnableRateLimiting("api-general")]
public sealed class WeeklyMenuBatchImportsController(
    IWeeklyMenuImportService importService,
    ICurrentUserService currentUserService) : ControllerBase
{
    private const int MaxBatchFiles = 10;

    [HttpPost("weekly-menu/import/commit-batch")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(XlsxSecurityLimits.MaxUploadBytes * MaxBatchFiles)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<WeeklyMenuImportResultDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> CommitAsync(
        [FromForm] List<IFormFile> files,
        [FromForm] List<string> customerIds,
        [FromForm] List<string> weekStartDates,
        [FromForm] List<decimal> priceTierAmounts,
        [FromForm] List<string> previewTokens,
        CancellationToken cancellationToken)
    {
        if (files.Count < 2 ||
            files.Count > MaxBatchFiles ||
            files.Any(file => file.Length == 0 || file.Length > XlsxSecurityLimits.MaxUploadBytes))
        {
            return BadRequest(ApiResponse.FailResult(
                $"Batch import cần từ 2 đến {MaxBatchFiles} file Excel hợp lệ."));
        }

        if (customerIds.Count != files.Count ||
            weekStartDates.Count != files.Count ||
            priceTierAmounts.Count != files.Count ||
            previewTokens.Count != files.Count)
        {
            return BadRequest(ApiResponse.FailResult(
                "Thông tin batch import không khớp số file. Vui lòng kiểm tra lại toàn bộ file."));
        }

        var streams = new List<Stream>(files.Count);
        try
        {
            var items = new List<WeeklyMenuImportBatchItem>(files.Count);
            for (var index = 0; index < files.Count; index++)
            {
                var stream = files[index].OpenReadStream();
                streams.Add(stream);
                items.Add(new WeeklyMenuImportBatchItem(
                    stream,
                    files[index].FileName,
                    customerIds[index],
                    ParseWeekStartDate(weekStartDates[index]),
                    priceTierAmounts[index],
                    previewTokens[index]));
            }

            var result = await importService.CommitWeeklyMenuImportBatchAsync(
                items,
                currentUserService.GetUserId(User),
                cancellationToken);
            return Ok(ApiResponse<IReadOnlyList<WeeklyMenuImportResultDto>>.SuccessResult(
                result,
                $"Đã lưu atomic {result.Count} file thực đơn."));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse.FailResult(ex.Message));
        }
        finally
        {
            foreach (var stream in streams)
            {
                await stream.DisposeAsync();
            }
        }
    }

    private static DateOnly? ParseWeekStartDate(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            ? parsed
            : throw new ArgumentException("Ngày bắt đầu tuần không hợp lệ. Dùng định dạng yyyy-MM-dd.");
    }
}
