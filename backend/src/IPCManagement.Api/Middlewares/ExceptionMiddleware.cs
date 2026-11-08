using System.Net;
using System.Text.Json;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Middlewares;

/// <summary>
/// Bắt mọi exception chưa được xử lý, log và trả về ApiResponse chuẩn.
/// Ngăn lộ stack trace ra ngoài môi trường production.
/// </summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionMiddleware(
        RequestDelegate next,
        ILogger<ExceptionMiddleware> logger,
        IHostEnvironment env)
    {
        _next   = next;
        _logger = logger;
        _env    = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, message) = ex switch
        {
            // ── Exception nghiệp vụ có phân loại rõ ràng ────────────────────────
            BusinessRuleException     => (HttpStatusCode.BadRequest,           ex.Message),
            ResourceNotFoundException => (HttpStatusCode.NotFound,             ex.Message),
            ResourceConflictException => (HttpStatusCode.Conflict,             ex.Message),
            ReconciliationToleranceAuthorityException => (HttpStatusCode.Conflict, ex.Message),

            // ── Exception hạ tầng / .NET ───────────────────────────────────────
            // Kestrel ném BadHttpRequestException ngay trong lúc model-binding (vd. [RequestSizeLimit]
            // chặn file quá cỡ → 413). Không có arm này thì rơi vào "_" và trả 500 sai bản chất.
            Microsoft.AspNetCore.Http.BadHttpRequestException badRequest =>
                ((HttpStatusCode)badRequest.StatusCode,
                 badRequest.StatusCode == StatusCodes.Status413PayloadTooLarge
                    ? "File tải lên vượt quá dung lượng cho phép (tối đa 10 MB)."
                    : "Yêu cầu không hợp lệ."),
            DbUpdateConcurrencyException => (HttpStatusCode.Conflict,             "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng thử lại."),
            ArgumentException         => (HttpStatusCode.UnprocessableEntity, ex.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized,      "Không có quyền truy cập."),
            KeyNotFoundException      => (HttpStatusCode.NotFound,            ex.Message),
            DirectoryNotFoundException => (HttpStatusCode.NotFound,           ex.Message),
            _                         => (HttpStatusCode.InternalServerError, "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.")
        };

        context.Response.StatusCode = (int)statusCode;

        // correlationId lấy từ CorrelationIdMiddleware (không tạo cơ chế thứ hai) để người dùng
        // đọc được mã tra cứu ngay trên body lỗi, khớp với header X-Correlation-ID.
        var correlationId = context.Items.TryGetValue(CorrelationIdMiddleware.ItemKey, out var value)
            && value is string tracked && !string.IsNullOrWhiteSpace(tracked)
                ? tracked
                : context.TraceIdentifier;

        var response = new
        {
            success = false,
            message,
            // Chỉ expose chi tiết lỗi ở môi trường development
            errors = _env.IsDevelopment() ? new { detail = ex.ToString() } : null,
            correlationId
        };

        var options  = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        var json     = JsonSerializer.Serialize(response, options);
        await context.Response.WriteAsync(json);
    }
}

// Extension method để đăng ký middleware gọn gàng trong Program.cs
public static class ExceptionMiddlewareExtensions
{
    public static IApplicationBuilder UseExceptionMiddleware(this IApplicationBuilder app)
        => app.UseMiddleware<ExceptionMiddleware>();
}
