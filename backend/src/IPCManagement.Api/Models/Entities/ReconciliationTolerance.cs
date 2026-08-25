namespace IPCManagement.Api.Models.Entities;

public sealed class ReconciliationTolerance
{
    public byte[] ToleranceId { get; set; } = null!;
    public string ScopeKind { get; set; } = null!;
    public byte[]? ScopeId { get; set; }
    public decimal Value { get; set; }
    public long Version { get; set; }
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
