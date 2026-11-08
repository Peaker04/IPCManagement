namespace IPCManagement.Api.Models.Entities;

public partial class LifecycleCommandReceipt
{
    public byte[] CommandReceiptId { get; set; } = null!;
    public string CommandId { get; set; } = null!;
    public string AggregateType { get; set; } = null!;
    public byte[] AggregateId { get; set; } = null!;
    public string ResponseJson { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
