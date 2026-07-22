namespace IPCManagement.Api.Models.DTOs.Workflow;

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
