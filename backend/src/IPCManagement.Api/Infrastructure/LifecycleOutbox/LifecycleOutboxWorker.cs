using Microsoft.Extensions.Options;

namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public sealed class LifecycleOutboxWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<LifecycleOutboxOptions> options,
    ILogger<LifecycleOutboxWorker> logger) : BackgroundService
{
    private readonly LifecycleOutboxOptions _options = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            logger.LogInformation("Lifecycle outbox relay đang tắt theo cấu hình.");
            return;
        }

        var delay = TimeSpan.FromSeconds(_options.PollIntervalSeconds > 0 ? _options.PollIntervalSeconds : 5);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<ILifecycleOutboxProcessor>();
                await processor.ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lifecycle outbox relay gặp lỗi ngoài message scope.");
            }

            await Task.Delay(delay, stoppingToken);
        }
    }
}
