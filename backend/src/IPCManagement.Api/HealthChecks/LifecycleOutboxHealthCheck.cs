using IPCManagement.Api.Data;
using IPCManagement.Api.Infrastructure.LifecycleOutbox;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace IPCManagement.Api.HealthChecks;

public sealed class LifecycleOutboxHealthCheck(
    IpcManagementContext context,
    IOptions<LifecycleOutboxOptions> options,
    TimeProvider timeProvider) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext healthContext,
        CancellationToken cancellationToken = default)
    {
        var configuration = options.Value;
        var counts = await context.Lifecycleoutboxmessages
            .AsNoTracking()
            .GroupBy(message => message.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Status, item => item.Count, cancellationToken);
        var oldestPendingAt = await context.Lifecycleoutboxmessages
            .AsNoTracking()
            .Where(message => message.Status == "PENDING" || message.Status == "FAILED" || message.Status == "PROCESSING")
            .MinAsync(message => (DateTime?)message.CreatedAt, cancellationToken);

        var data = new Dictionary<string, object>
        {
            ["enabled"] = configuration.Enabled,
            ["pending"] = counts.GetValueOrDefault("PENDING"),
            ["processing"] = counts.GetValueOrDefault("PROCESSING"),
            ["failed"] = counts.GetValueOrDefault("FAILED"),
            ["poison"] = counts.GetValueOrDefault("POISON"),
            ["oldestPendingAt"] = oldestPendingAt?.ToString("O") ?? string.Empty
        };

        if (!configuration.Enabled)
        {
            return HealthCheckResult.Degraded("Lifecycle outbox relay đang tắt.", data: data);
        }

        if (counts.GetValueOrDefault("POISON") > 0)
        {
            return HealthCheckResult.Unhealthy("Lifecycle outbox có poison message cần Admin xử lý.", data: data);
        }

        var warnAge = TimeSpan.FromSeconds(configuration.WarnPendingAgeSeconds > 0
            ? configuration.WarnPendingAgeSeconds
            : 300);
        if (oldestPendingAt is not null && timeProvider.GetUtcNow().UtcDateTime - oldestPendingAt > warnAge)
        {
            return HealthCheckResult.Degraded("Lifecycle outbox có backlog quá ngưỡng cảnh báo.", data: data);
        }

        return HealthCheckResult.Healthy("Lifecycle outbox hoạt động bình thường.", data);
    }
}
