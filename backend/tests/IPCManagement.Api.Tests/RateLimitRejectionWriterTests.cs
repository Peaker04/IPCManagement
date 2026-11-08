using System.Text.Json;
using System.Threading.RateLimiting;
using FluentAssertions;
using IPCManagement.Api.Middlewares;
using Microsoft.AspNetCore.Http;

namespace IPCManagement.Api.Tests;

public class RateLimitRejectionWriterTests
{
    [Fact]
    public async Task WriteAsync_Should_ReturnJsonAndRetryAfter_WhenLeaseProvidesDelay()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await RateLimitRejectionWriter.WriteAsync(
            context,
            new RejectedLease(TimeSpan.FromMilliseconds(1_250)),
            CancellationToken.None);

        context.Response.StatusCode.Should().Be(StatusCodes.Status429TooManyRequests);
        context.Response.ContentType.Should().Be("application/json");
        context.Response.Headers.RetryAfter.ToString().Should().Be("2");
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        body.RootElement.GetProperty("success").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task WriteAsync_Should_Not_InventRetryAfter_WhenLeaseOmitsDelay()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await RateLimitRejectionWriter.WriteAsync(
            context,
            new RejectedLease(null),
            CancellationToken.None);

        context.Response.Headers.ContainsKey("Retry-After").Should().BeFalse();
    }

    private sealed class RejectedLease(TimeSpan? retryAfter) : RateLimitLease
    {
        public override bool IsAcquired => false;

        public override IEnumerable<string> MetadataNames =>
            retryAfter.HasValue ? [MetadataName.RetryAfter.Name] : [];

        public override bool TryGetMetadata(string metadataName, out object? metadata)
        {
            if (retryAfter.HasValue && metadataName == MetadataName.RetryAfter.Name)
            {
                metadata = retryAfter.Value;
                return true;
            }

            metadata = null;
            return false;
        }
    }
}
