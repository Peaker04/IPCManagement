using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

public sealed class OperationalApprovalPage : ApprovalInboxPageDto
{
    public IReadOnlyList<OperationalApprovalUnavailableSource> UnavailableSources { get; set; } = [];
    public string Mode { get; set; } = string.Empty;
    public long ModeVersion { get; set; }
    public IReadOnlyList<OperationalApprovalTarget> Targets { get; set; } = [];
}

public sealed record OperationalApprovalDetail(
    string Mode, long ModeVersion, ApprovalInboxItemDto Item, string Fingerprint,
    IReadOnlyList<string> AllowedActions, IReadOnlyList<string> BlockedReasons,
    IReadOnlyList<MrxMaterialImpactDto> MaterialImpact)
{
    public MenuAmendmentResultDto? SourceChange { get; init; }
    public IReadOnlyDictionary<string, string> SourceDishNames { get; init; } = new Dictionary<string, string>();
    public ReconciliationSupplementalDemandDto? SupplementalDemand { get; init; }
    public MrxHistoricalPurposeDetail? HistoricalPurpose { get; init; }
    public IPCManagement.Api.Features.Inventory.Contracts.StocktakeDto? Stocktake { get; init; }
    public IPCManagement.Api.Features.Inventory.Contracts.LegacyLineageDispositionDto? LegacyLineage { get; init; }
}

public sealed class OperationalApprovalActionRequest
{
    public string CommandId { get; set; } = string.Empty;
    public long ExpectedModeVersion { get; set; }
    public string ExpectedFingerprint { get; set; } = string.Empty;
    public ApprovalDecision Decision { get; set; }
    public string? Action { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed record OperationalApprovalUnavailableSource(string TargetType, string Message);
