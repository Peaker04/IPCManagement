namespace IPCManagement.Api.Models.Entities;

public sealed class MrxHistoricalPurposeProposal
{
    public byte[] ProposalId { get; set; } = null!;
    public byte[] BatchId { get; set; } = null!;
    public byte[] IssueLineId { get; set; } = null!;
    public DateOnly ServiceDate { get; set; }
    public decimal UnallocatedQuantity { get; set; }
    public string AllocationsJson { get; set; } = string.Empty;
    public string Status { get; set; } = "PENDING";
    public long Version { get; set; } = 1;
    public string Reason { get; set; } = string.Empty;
    public byte[] CreatedBy { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string? DecisionReason { get; set; }
    public InventoryIssueLine IssueLine { get; set; } = null!;
    public ReconciliationBatch Batch { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}
