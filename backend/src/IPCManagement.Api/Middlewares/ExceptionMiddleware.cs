using System.Net;
using System.Text.Json;
using IPCManagement.Api.Helpers;
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
            DbUpdateConcurrencyException => (HttpStatusCode.Conflict,             "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng thử lại."),
            InvalidOperationException => (HttpStatusCode.BadRequest,         ex.Message),
            ArgumentException         => (HttpStatusCode.UnprocessableEntity, ex.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized,      "Không có quyền truy cập."),
            KeyNotFoundException      => (HttpStatusCode.NotFound,            ex.Message),
            DirectoryNotFoundException => (HttpStatusCode.NotFound,           ex.Message),
            _                         => (HttpStatusCode.InternalServerError, "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.")
        };

        context.Response.StatusCode = (int)statusCode;

        var response = ApiResponse.FailResult(
            message,
            // Chỉ expose chi tiết lỗi ở môi trường development
            _env.IsDevelopment() ? new { detail = ex.ToString() } : null
        );

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
