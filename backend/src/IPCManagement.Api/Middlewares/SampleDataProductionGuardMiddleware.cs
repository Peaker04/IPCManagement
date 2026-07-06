namespace IPCManagement.Api.Middlewares;

public class SampleDataProductionGuardMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IHostEnvironment _environment;

    public SampleDataProductionGuardMiddleware(
        RequestDelegate next,
        IHostEnvironment environment)
    {
        _next = next;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (ShouldHideSampleDataEndpoint(_environment, context.Request.Path))
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        await _next(context);
    }

    public static bool ShouldHideSampleDataEndpoint(
        IHostEnvironment environment,
        PathString path)
        => !environment.IsDevelopment() &&
           path.StartsWithSegments("/api/sample-data", StringComparison.OrdinalIgnoreCase);
}
