using FluentAssertions;
using IPCManagement.Api.Middlewares;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_Should_UseRequestCorrelationIdAndReturnHeader()
    {
        const string correlationId = "week-2026-06-15-import-generate";
        var context = CreateContext();
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = correlationId;
        var middleware = CreateMiddleware(async nextContext =>
        {
            nextContext.TraceIdentifier.Should().Be(correlationId);
            nextContext.Items[CorrelationIdMiddleware.ItemKey].Should().Be(correlationId);
            await nextContext.Response.StartAsync();
        });

        await middleware.InvokeAsync(context);

        context.Response.Headers[CorrelationIdMiddleware.HeaderName].ToString().Should().Be(correlationId);
    }

    [Fact]
    public async Task InvokeAsync_Should_GenerateCorrelationId_WhenHeaderMissing()
    {
        var context = CreateContext();
        var middleware = CreateMiddleware(async nextContext =>
        {
            nextContext.TraceIdentifier.Should().NotBeNullOrWhiteSpace();
            nextContext.Items[CorrelationIdMiddleware.ItemKey].Should().Be(nextContext.TraceIdentifier);
            await nextContext.Response.StartAsync();
        });

        await middleware.InvokeAsync(context);

        context.Response.Headers[CorrelationIdMiddleware.HeaderName].ToString()
            .Should().Be(context.TraceIdentifier)
            .And.NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task InvokeAsync_Should_IgnoreUnsafeCorrelationIdHeader()
    {
        var context = CreateContext();
        context.Request.Headers[CorrelationIdMiddleware.HeaderName] = "bad\r\nid";
        var middleware = CreateMiddleware(async nextContext =>
        {
            nextContext.TraceIdentifier.Should().NotBe("bad\r\nid");
            await nextContext.Response.StartAsync();
        });

        await middleware.InvokeAsync(context);

        context.Response.Headers[CorrelationIdMiddleware.HeaderName].ToString().Should().Be(context.TraceIdentifier);
    }

    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    private static CorrelationIdMiddleware CreateMiddleware(RequestDelegate next)
    {
        var logger = Substitute.For<ILogger<CorrelationIdMiddleware>>();
        return new CorrelationIdMiddleware(next, logger);
    }
}
