namespace IPCManagement.Api.Features.SystemOperation.Contracts;

public sealed record SystemOperationModeDto(string Mode, string Label, long Version, DateTime UpdatedAt, bool ReasonRequired);
public sealed record ChangeSystemOperationModeRequest(string Mode, long ExpectedVersion, bool Confirmed, string? Reason);
