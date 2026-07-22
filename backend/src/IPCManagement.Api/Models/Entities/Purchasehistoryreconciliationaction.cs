using System;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchasehistoryreconciliationaction
{
    public byte[] PurchaseHistoryReconciliationActionId { get; set; } = null!;

    public byte[] PurchaseHistoryReconciliationRunId { get; set; } = null!;

    public string ActionId { get; set; } = null!;

    public string ActionType { get; set; } = null!;

    public string SourceKey { get; set; } = null!;

    public string? SourceSheet { get; set; }

    public int? SourceRow { get; set; }

    public string? BusinessKey { get; set; }

    public string TargetType { get; set; } = null!;

    public string TargetId { get; set; } = null!;

    public string ReasonCode { get; set; } = null!;

    public string BeforeEvidence { get; set; } = null!;

    public string BeforeHash { get; set; } = null!;

    public string AfterEvidence { get; set; } = null!;

    public string AfterHash { get; set; } = null!;

    public string ActionHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual Purchasehistoryreconciliationrun PurchaseHistoryReconciliationRun { get; set; } = null!;
}
