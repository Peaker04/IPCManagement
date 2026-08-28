using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Data.Transactions;

public sealed class SystemOperationRequestContext
{
    public string? Mode { get; set; }
    public string? OperationKey { get; set; }
    public long? ExpectedModeVersion { get; set; }
    public OperationDisposition Disposition { get; set; } = OperationDisposition.Neutral;
}
