using System.ComponentModel.DataAnnotations;

namespace IPCManagement.Api.Models.DTOs.SampleData;

public sealed class PurchaseHistoryPreviewRequestDto;

public sealed class PurchaseHistoryPreviewDto
{
    public PurchaseHistoryManifestDto Manifest { get; set; } = new();
    public List<PurchaseHistoryActionDto> Actions { get; set; } = [];
    public List<PurchaseHistoryBlockerDto> Blockers { get; set; } = [];
}

public sealed class PurchaseHistoryManifestDto
{
    public string ManifestId { get; set; } = string.Empty;
    public string ManifestHash { get; set; } = string.Empty;
    public string SourceSha256 { get; set; } = string.Empty;
    public string PolicyVersion { get; set; } = string.Empty;
    public DateOnly AsOfDate { get; set; }
    public int CandidateCount { get; set; }
    public int ActionCount { get; set; }
    public int BlockerCount { get; set; }
}

public sealed class PurchaseHistoryActionDto
{
    public string ActionId { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string SourceKey { get; set; } = string.Empty;
    public string? BusinessKey { get; set; }
}

public sealed class PurchaseHistoryBlockerDto
{
    public string Code { get; set; } = string.Empty;
    public string Field { get; set; } = string.Empty;
    public string RawValue { get; set; } = string.Empty;
    public string SourceSheet { get; set; } = string.Empty;
    public int SourceRow { get; set; }
    public Dictionary<string, string> RawCells { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class PurchaseHistoryApplyRequestDto
{
    [Required]
    public string ManifestId { get; set; } = string.Empty;

    [Required]
    public string ManifestHash { get; set; } = string.Empty;

    [MinLength(1)]
    public List<string> AcceptedActionIds { get; set; } = [];

    [Required]
    public BackupRestoreEvidenceDto? BackupRestoreEvidence { get; set; }
}

public sealed class PurchaseHistoryApplyResultDto
{
    public string ManifestId { get; set; } = string.Empty;
    public bool Applied { get; set; }
    public bool NoOp { get; set; }
    public int AppliedActionCount { get; set; }
    public List<PurchaseHistoryBlockerDto> Blockers { get; set; } = [];
}

public sealed class BackupRestoreEvidenceDto
{
    [Required]
    public string BackupIdentifier { get; set; } = string.Empty;

    [Required]
    public string TargetFingerprint { get; set; } = string.Empty;

    [Required]
    public string RestoreFingerprint { get; set; } = string.Empty;

    public bool RestoreVerified { get; set; }
}
