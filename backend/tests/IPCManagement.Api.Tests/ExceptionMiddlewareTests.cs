using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Middlewares;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class ExceptionMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_Should_Return_NotFoundEnvelope_ForMissingImportDirectory()
    {
        const string message = "Không tìm thấy thư mục dữ liệu mẫu: D:\\missing-docs";
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = CreateMiddleware(_ => throw new DirectoryNotFoundException(message));

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        var body = await ReadJsonBodyAsync(context);
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("message").GetString().Should().Be(message);
    }

    [Fact]
    public async Task InvokeAsync_Should_HideUnexpectedExceptionDetail_InProduction()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var middleware = CreateMiddleware(_ => throw new Exception("database password leaked"));

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        var body = await ReadJsonBodyAsync(context);
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("message").GetString().Should().Be("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
        body.TryGetProperty("errors", out var errors).Should().BeTrue();
        errors.ValueKind.Should().Be(JsonValueKind.Null);
    }

    private static ExceptionMiddleware CreateMiddleware(RequestDelegate next)
    {
        var logger = Substitute.For<ILogger<ExceptionMiddleware>>();
        var environment = Substitute.For<IHostEnvironment>();
        environment.EnvironmentName.Returns(Environments.Production);
        return new ExceptionMiddleware(next, logger, environment);
    }

    private static async Task<JsonElement> ReadJsonBodyAsync(HttpContext context)
    {
        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        return document.RootElement.Clone();
    }
}
