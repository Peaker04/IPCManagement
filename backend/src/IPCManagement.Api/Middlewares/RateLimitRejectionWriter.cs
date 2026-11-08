using System.Globalization;
using System.Threading.RateLimiting;

namespace IPCManagement.Api.Middlewares;

internal static class RateLimitRejectionWriter
{
    internal static async ValueTask WriteAsync(
        HttpContext context,
        RateLimitLease lease,
        CancellationToken cancellationToken)
    {
        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.Response.ContentType = "application/json";

        if (lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.Response.Headers.RetryAfter = Math.Ceiling(retryAfter.TotalSeconds)
                .ToString(CultureInfo.InvariantCulture);
        }

        await context.Response.WriteAsync(
            """{"success":false,"message":"Quá nhiều yêu cầu. Vui lòng thử lại sau."}""",
            cancellationToken);
    }
}
