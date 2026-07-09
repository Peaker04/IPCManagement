using System.Diagnostics;
using Serilog.Context;

namespace IPCManagement.Api.Middlewares;

public class CorrelationIdMiddleware
{
    public const string HeaderName = "X-Correlation-ID";
    public const string ItemKey = "CorrelationId";

    private const int MaxCorrelationIdLength = 128;

    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = ResolveCorrelationId(context);
        context.TraceIdentifier = correlationId;
        context.Items[ItemKey] = correlationId;
        context.Response.Headers[HeaderName] = correlationId;

        using (LogContext.PushProperty(ItemKey, correlationId))
        using (_logger.BeginScope(new Dictionary<string, object> { [ItemKey] = correlationId }))
        {
            await _next(context);
        }
    }

    private static string ResolveCorrelationId(HttpContext context)
    {
        var headerValue = context.Request.Headers[HeaderName].FirstOrDefault();
        if (IsValidCorrelationId(headerValue))
        {
            return headerValue!.Trim();
        }

        return Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
    }

    private static bool IsValidCorrelationId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var trimmed = value.Trim();
        return trimmed.Length <= MaxCorrelationIdLength &&
               trimmed.All(character => !char.IsControl(character));
    }
}
