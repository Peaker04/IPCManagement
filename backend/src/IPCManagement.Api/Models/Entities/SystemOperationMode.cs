namespace IPCManagement.Api.Models.Entities;

public sealed class SystemOperationMode
{
    public byte Id { get; set; } = 1;
    public string Mode { get; set; } = null!;
    public long Version { get; set; }
    public byte[] UpdatedBy { get; set; } = null!;
    public DateTime UpdatedAt { get; set; }
    public string? Reason { get; set; }
}
