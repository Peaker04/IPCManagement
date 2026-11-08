namespace IPCManagement.Api.Models.Entities;

public sealed class ServiceRunAdjustment
{
    public byte[] ServiceRunAdjustmentId { get; set; } = null!;
    public byte[] ServiceRunId { get; set; } = null!;
    public int CorrectedActualServings { get; set; }
    public string Reason { get; set; } = null!;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public ServiceRun ServiceRun { get; set; } = null!;
}
