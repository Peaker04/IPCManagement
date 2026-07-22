using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchasepriceexception
{
    public byte[] PurchasePriceExceptionId { get; set; } = null!;

    public byte[] PurchaseLineSupplierDecisionId { get; set; } = null!;

    public decimal ReferencePrice { get; set; }

    public decimal ProposedPrice { get; set; }

    public decimal VariancePercent { get; set; }

    public string EvidenceType { get; set; } = null!;

    public byte[] EvidenceId { get; set; } = null!;

    public DateOnly EvidenceDate { get; set; }

    public string Reason { get; set; } = null!;

    public string ProposalFingerprint { get; set; } = null!;

    public int ProposalVersion { get; set; }

    public byte[] RequestedBy { get; set; } = null!;

    public DateTime RequestedAt { get; set; }

    public string Status { get; set; } = "PENDING";

    public byte[]? DecidedBy { get; set; }

    public string? DecisionReason { get; set; }

    public DateTime? DecidedAt { get; set; }

    public byte[]? SupersededByExceptionId { get; set; }

    public int ConcurrencyVersion { get; set; } = 1;

    public virtual Purchaselinesupplierdecision PurchaseLineSupplierDecision { get; set; } = null!;

    public virtual User RequestedByNavigation { get; set; } = null!;

    public virtual User? DecidedByNavigation { get; set; }

    public virtual Purchasepriceexception? SupersededByException { get; set; }

    public virtual ICollection<Purchasepriceexception> SupersededExceptions { get; set; } = new List<Purchasepriceexception>();
}
