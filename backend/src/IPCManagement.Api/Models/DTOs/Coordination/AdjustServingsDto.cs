namespace IPCManagement.Api.Models.DTOs.Coordination;

public class AdjustServingsRequestDto
{
    public int ServingsQuantity { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public class AdjustServingsResultDto
{
    public bool Success { get; set; }
    public string OrderId { get; set; } = string.Empty;
    public int OldServings { get; set; }
    public int NewServings { get; set; }
    public DateTime ChangedAt { get; set; }
    public string AuditId { get; set; } = string.Empty;
    public string? Warning { get; set; }
}