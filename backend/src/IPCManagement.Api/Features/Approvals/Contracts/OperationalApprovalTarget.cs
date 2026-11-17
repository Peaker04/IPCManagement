namespace IPCManagement.Api.Features.Approvals.Contracts;

public sealed record OperationalApprovalTarget(string TargetType, string Label, string Mode, string Permission);
