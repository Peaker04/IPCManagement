namespace IPCManagement.Api.Models.Entities;

public sealed class Unitnormalizationreview
{
    public byte[] ReviewId { get; set; } = null!;

    public byte[] IngredientId { get; set; } = null!;

    public byte[] SourceUnitId { get; set; } = null!;

    public byte[] CatalogUnitId { get; set; } = null!;

    public byte[]? RecommendedUnitId { get; set; }

    public decimal? ObservedStockQty { get; set; }

    public int SourceReceiptCount { get; set; }

    public int CatalogReceiptCount { get; set; }

    public int BomLineCount { get; set; }

    /// <summary>Quantity in catalog unit produced by one source-unit quantity.</summary>
    public decimal? ProposedSourceToCatalogFactor { get; set; }

    public string Confidence { get; set; } = "BLOCKED";

    public string Status { get; set; } = "NEEDS_CONFIRMATION";

    public string EvidenceSource { get; set; } = null!;

    public string EvidenceNote { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? ReviewedAt { get; set; }

    public byte[]? ReviewedBy { get; set; }

    public Ingredient Ingredient { get; set; } = null!;

    public Unit SourceUnit { get; set; } = null!;

    public Unit CatalogUnit { get; set; } = null!;

    public Unit? RecommendedUnit { get; set; }

    public User? Reviewer { get; set; }
}
