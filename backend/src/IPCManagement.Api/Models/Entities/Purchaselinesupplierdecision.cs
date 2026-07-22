using System;
using System.Collections.Generic;

namespace IPCManagement.Api.Models.Entities;

public partial class Purchaselinesupplierdecision
{
    public byte[] PurchaseLineSupplierDecisionId { get; set; } = null!;

    public byte[] PurchaseRequestLineId { get; set; } = null!;

    public byte[] SupplierId { get; set; } = null!;

    public string EvidenceType { get; set; } = null!;

    public byte[] EvidenceId { get; set; } = null!;

    public DateOnly EvidenceDate { get; set; }

    public decimal EvidenceReferencePrice { get; set; }

    public decimal ProposedUnitPrice { get; set; }

    public DateOnly ProposedDeliveryDate { get; set; }

    public byte[] ConfirmedBy { get; set; } = null!;

    public DateTime ConfirmedAt { get; set; }

    public string DecisionFingerprint { get; set; } = null!;

    public int Version { get; set; }

    public string Status { get; set; } = "CURRENT";

    public byte[]? CurrentDecisionKey { get; set; }

    public byte[]? SupersededByDecisionId { get; set; }

    public int ConcurrencyVersion { get; set; } = 1;

    public virtual Purchaserequestline PurchaseRequestLine { get; set; } = null!;

    public virtual Supplier Supplier { get; set; } = null!;

    public virtual User ConfirmedByNavigation { get; set; } = null!;

    public virtual Purchaselinesupplierdecision? SupersededByDecision { get; set; }

    public virtual ICollection<Purchaselinesupplierdecision> SupersededDecisions { get; set; } = new List<Purchaselinesupplierdecision>();

    public virtual ICollection<Purchasepriceexception> Purchasepriceexceptions { get; set; } = new List<Purchasepriceexception>();
}
