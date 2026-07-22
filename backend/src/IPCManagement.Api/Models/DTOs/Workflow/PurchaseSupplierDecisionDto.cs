using System.Text.Json.Serialization;

namespace IPCManagement.Api.Models.DTOs.Workflow;

[JsonConverter(typeof(JsonStringEnumConverter<SupplierEvidenceType>))]
public enum SupplierEvidenceType
{
    EffectiveQuotation,
    LatestValidReceipt
}

public class SupplierEvidenceResultDto
{
    public IReadOnlyList<SupplierEvidenceCandidateDto> Candidates { get; set; } = [];
    public string? Blocker { get; set; }
    public IReadOnlyList<string> Diagnostics { get; set; } = [];
}

public class SupplierEvidenceCandidateDto
{
    public SupplierEvidenceType EvidenceType { get; set; }
    public string EvidenceId { get; set; } = string.Empty;
    public string EvidenceDate { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string IngredientId { get; set; } = string.Empty;
    public string UnitId { get; set; } = string.Empty;
    public string UnitName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string? EffectiveFrom { get; set; }
    public string? EffectiveTo { get; set; }
}

public class ConfirmPurchaseLineSupplierDto
{
    public SupplierEvidenceType EvidenceType { get; set; }
    public string EvidenceId { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public decimal ProposedUnitPrice { get; set; }
    public string ProposedDeliveryDate { get; set; } = string.Empty;
    public int ExpectedDecisionVersion { get; set; }
    public string? Note { get; set; }
}

public class PurchaseLineSupplierDecisionDto
{
    public string PurchaseLineSupplierDecisionId { get; set; } = string.Empty;
    public string SupplierId { get; set; } = string.Empty;
    public SupplierEvidenceType EvidenceType { get; set; }
    public string EvidenceId { get; set; } = string.Empty;
    public string EvidenceDate { get; set; } = string.Empty;
    public decimal EvidenceReferencePrice { get; set; }
    public decimal ProposedUnitPrice { get; set; }
    public string ProposedDeliveryDate { get; set; } = string.Empty;
    public string ConfirmedBy { get; set; } = string.Empty;
    public string ConfirmedAt { get; set; } = string.Empty;
    public string DecisionFingerprint { get; set; } = string.Empty;
    public int Version { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? SupersededByDecisionId { get; set; }
    public int ConcurrencyVersion { get; set; }
}
