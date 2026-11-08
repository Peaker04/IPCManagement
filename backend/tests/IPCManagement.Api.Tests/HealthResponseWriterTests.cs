using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.HealthChecks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IPCManagement.Api.Tests;

public class HealthResponseWriterTests
{
    [Fact]
    public void EndpointOptions_Should_LockProbePartitionsAndReadyStatusCodes()
    {
        var live = HealthEndpointOptions.CreateLive();
        var ready = HealthEndpointOptions.CreateReady();
        var liveRegistration = new HealthCheckRegistration("live", _ => null!, null, ["live"]);
        var readyRegistration = new HealthCheckRegistration("ready", _ => null!, null, ["ready"]);

        live.Predicate!(liveRegistration).Should().BeTrue();
        live.Predicate(readyRegistration).Should().BeFalse();
        ready.Predicate!(readyRegistration).Should().BeTrue();
        ready.Predicate(liveRegistration).Should().BeFalse();
        ready.ResultStatusCodes[HealthStatus.Healthy].Should().Be(StatusCodes.Status200OK);
        ready.ResultStatusCodes[HealthStatus.Degraded].Should().Be(StatusCodes.Status200OK);
        ready.ResultStatusCodes[HealthStatus.Unhealthy].Should().Be(StatusCodes.Status503ServiceUnavailable);
    }

    [Theory]
    [InlineData(HealthStatus.Healthy, "Healthy")]
    [InlineData(HealthStatus.Degraded, "Degraded")]
    [InlineData(HealthStatus.Unhealthy, "Unhealthy")]
    public async Task WriteAsync_Should_EmitMachineReadableStatusAndChecks(HealthStatus status, string expected)
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        var report = new HealthReport(
            new Dictionary<string, HealthReportEntry>
            {
                ["database"] = new(status, "database status", TimeSpan.FromMilliseconds(12), null, null)
            },
            TimeSpan.FromMilliseconds(15));

        await HealthResponseWriter.WriteAsync(context, report);

        context.Response.ContentType.Should().Be("application/json");
        context.Response.Body.Position = 0;
        using var payload = await JsonDocument.ParseAsync(context.Response.Body);
        payload.RootElement.GetProperty("status").GetString().Should().Be(expected);
        var check = payload.RootElement.GetProperty("checks")[0];
        check.GetProperty("name").GetString().Should().Be("database");
        check.GetProperty("status").GetString().Should().Be(expected);
    }
}
