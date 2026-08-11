namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public sealed class LifecycleOutboxOptions
{
    public const string SectionName = "LifecycleOutbox";

    public bool Enabled { get; set; }
    public int BatchSize { get; set; } = 50;
    public int PollIntervalSeconds { get; set; } = 5;
    public int LeaseSeconds { get; set; } = 60;
    public int MaxAttempts { get; set; } = 8;
    public int BaseRetrySeconds { get; set; } = 5;
    public int WarnPendingAgeSeconds { get; set; } = 300;
}
