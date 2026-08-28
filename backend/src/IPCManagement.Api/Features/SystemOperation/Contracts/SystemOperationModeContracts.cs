namespace IPCManagement.Api.Features.SystemOperation.Contracts;

public sealed record SystemOperationCapabilitiesDto(
    IReadOnlyList<string> Navigation,
    IReadOnlyDictionary<string, IReadOnlyList<string>> PageTabs);

public sealed record SystemOperationModeDto(
    string Mode,
    string Label,
    long Version,
    DateTime UpdatedAt,
    bool ReasonRequired,
    SystemOperationCapabilitiesDto Capabilities);

public sealed record ChangeSystemOperationModeRequest(string Mode, long ExpectedVersion, bool Confirmed, string? Reason);
