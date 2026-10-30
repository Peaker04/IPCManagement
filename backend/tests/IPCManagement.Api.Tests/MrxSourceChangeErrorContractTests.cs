using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Middlewares;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class MrxSourceChangeErrorContractTests
{
    [Fact]
    public async Task Middleware_maps_day_locked_to_409_with_code_and_dates()
    {
        var context = NewContext();
        var middleware = CreateMiddleware(_ => throw new MrxSourceChangeException(
            MrxErrorCodes.DayLocked, 409, "Ngày 15/06/2026 đã có phiếu xuất.", [new DateOnly(2026, 6, 15)]));

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var body = await ReadJsonBodyAsync(context);
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("code").GetString().Should().Be("MRX_DAY_LOCKED");
        body.GetProperty("message").GetString().Should().Be("Ngày 15/06/2026 đã có phiếu xuất.");
        body.GetProperty("lockedDates").EnumerateArray().Select(x => x.GetString()).Should().Equal("2026-06-15");
        body.TryGetProperty("correlationId", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Middleware_maps_servings_split_required_to_422()
    {
        var context = NewContext();
        var middleware = CreateMiddleware(_ => throw new MrxSourceChangeException(
            MrxErrorCodes.ServingsSplitRequired, 422, "Cần tách suất mặn/chay."));

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);
        var body = await ReadJsonBodyAsync(context);
        body.GetProperty("code").GetString().Should().Be("MRX_SERVINGS_SPLIT_REQUIRED");
        body.GetProperty("lockedDates").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public void Error_codes_have_contract_values()
    {
        MrxErrorCodes.DayLocked.Should().Be("MRX_DAY_LOCKED");
        MrxErrorCodes.SourceStale.Should().Be("MRX_SOURCE_STALE");
        MrxErrorCodes.BatchCompleted.Should().Be("MRX_BATCH_COMPLETED");
        MrxErrorCodes.ServingsSplitRequired.Should().Be("MRX_SERVINGS_SPLIT_REQUIRED");
        MrxErrorCodes.BomMissing.Should().Be("MRX_BOM_MISSING");
    }

    private static DefaultHttpContext NewContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
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
