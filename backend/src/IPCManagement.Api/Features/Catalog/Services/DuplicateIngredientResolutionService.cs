using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed record DuplicateIngredientResolutionRequest(
    string GroupId,
    IReadOnlyList<string> MemberIds,
    string CurrentFingerprint,
    EvidencePackageInput Evidence,
    string? CanonicalMemberId,
    IReadOnlyList<string> ConsumerSurfaces,
    IReadOnlyDictionary<string, string> ForwardMap,
    string ForwardMapSha256,
    string RollbackMapSha256,
    bool SourceScanClosed,
    bool RuntimeScanClosed);

public interface IDuplicateIngredientResolutionService
{
    EvidenceResolutionState Preview(DuplicateIngredientResolutionRequest request, ResolutionCommandContext command);
    EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command);
    EvidenceResolutionState Apply(string resolutionId, DuplicateIngredientResolutionRequest current, ResolutionCommandContext command, DateTime nowUtc);
}

public sealed class DuplicateIngredientResolutionService : IDuplicateIngredientResolutionService
{
    public static readonly string[] RequiredConsumerSurfaces =
    [
        "dishbom", "materialrequestlines", "purchaserequestlines", "purchaseorderlines",
        "inventoryreceiptlines", "inventoryissuelines", "inventoryreturnlines", "stockmovements",
        "currentstocks", "currentstocklots", "stocksnapshots", "stocktakelines",
        "supplierquotations", "unitnormalizationreviews", "dataqualitydispositions"
    ];

    private readonly Dictionary<string, Entry> _entries = new(StringComparer.Ordinal);
    private readonly Dictionary<string, EvidenceResolutionState> _receipts = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public static string ValidatePlan(DuplicateIngredientResolutionRequest request, DateTime nowUtc)
    {
        EvidencePackageGuard.Validate(request.Evidence, "DUPLICATE_INGREDIENT", request.GroupId,
            request.CurrentFingerprint, "CATALOG_SOURCE_OWNER", "FULL_REFERENCE_MAP", nowUtc);
        if (request.MemberIds.Count < 2 || request.MemberIds.Any(id => !Guid.TryParse(id, out _)) ||
            request.MemberIds.Distinct(StringComparer.Ordinal).Count() != request.MemberIds.Count)
            throw new InvalidOperationException("Duplicate decision requires every unique stable member ID.");

        if (request.Evidence.Decision == "KEEP_DISTINCT") return "KEEP_DISTINCT";
        if (request.Evidence.Decision != "MERGE_PLAN")
            throw new InvalidOperationException("Duplicate decision must be KEEP_DISTINCT or MERGE_PLAN.");
        if (request.CanonicalMemberId is null || !request.MemberIds.Contains(request.CanonicalMemberId, StringComparer.Ordinal))
            throw new InvalidOperationException("Merge canonical member must be selected by stable ID.");
        if (request.ConsumerSurfaces.Count != RequiredConsumerSurfaces.Length ||
            RequiredConsumerSurfaces.Except(request.ConsumerSurfaces, StringComparer.Ordinal).Any())
            throw new InvalidOperationException("Merge plan must close all 15 consumer surfaces.");
        if (!request.SourceScanClosed || !request.RuntimeScanClosed)
            throw new InvalidOperationException("Merge plan requires source and runtime closure.");
        if (request.ForwardMap.Count != request.MemberIds.Count || request.MemberIds.Any(id => !request.ForwardMap.ContainsKey(id)))
            throw new InvalidOperationException("Forward map must cover every stable member.");
        if (!EvidencePackageGuard.IsSha256(request.ForwardMapSha256))
            throw new InvalidOperationException("Merge plan requires an exact forward digest.");
        if (!EvidencePackageGuard.IsSha256(request.RollbackMapSha256))
            throw new InvalidOperationException("Merge plan requires an exact rollback digest.");
        return "MERGE_PLAN";
    }

    public EvidenceResolutionState Preview(DuplicateIngredientResolutionRequest request, ResolutionCommandContext command)
    {
        RequireRole(command, "Catalog", "Admin");
        ValidatePlan(request, command.NowUtc);
        EvidencePackageGuard.RequireIndependentActor(request.Evidence, command.ActorId);
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var state = new EvidenceResolutionState(Guid.NewGuid().ToString(), request.GroupId,
                "PENDING_MANAGER_REVIEW", 0, command.ActorId, null, null, request.Evidence.Decision,
                request.CanonicalMemberId ?? request.Evidence.PackageId, 1);
            _entries.Add(state.ResolutionId, new Entry(request, state));
            _receipts.Add(command.CommandId, state);
            return state;
        }
    }

    public EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command)
    {
        RequireRole(command, "Manager");
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            Check(entry.State, command.ExpectedVersion, "PENDING_MANAGER_REVIEW");
            if (entry.State.PreviewedBy == command.ActorId) throw new InvalidOperationException("Duplicate review requires a different actor.");
            EvidencePackageGuard.RequireIndependentActor(entry.Request.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPROVED", Version = 1, ReviewedBy = command.ActorId, AuditCount = 2 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    public EvidenceResolutionState Apply(string resolutionId, DuplicateIngredientResolutionRequest current, ResolutionCommandContext command, DateTime nowUtc)
    {
        RequireRole(command, "Admin");
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            Check(entry.State, command.ExpectedVersion, "APPROVED");
            ValidatePlan(current, nowUtc);
            if (current.CurrentFingerprint != entry.Request.CurrentFingerprint ||
                current.ForwardMapSha256 != entry.Request.ForwardMapSha256 ||
                current.RollbackMapSha256 != entry.Request.RollbackMapSha256)
                throw new InvalidOperationException("Duplicate reference map changed after review.");
            EvidencePackageGuard.RequireIndependentActor(current.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPLIED", Version = 2, AppliedBy = command.ActorId, AuditCount = 3 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    private Entry Get(string id) => _entries.GetValueOrDefault(id) ?? throw new KeyNotFoundException("Duplicate resolution was not found.");
    private static void Check(EvidenceResolutionState state, long version, string status)
    {
        if (state.Version != version) throw new InvalidOperationException("Duplicate resolution version is stale.");
        if (state.Status != status) throw new InvalidOperationException($"Duplicate resolution must be {status}.");
    }
    private static void RequireRole(ResolutionCommandContext command, params string[] roles)
    {
        if (!roles.Contains(command.ActorRole, StringComparer.OrdinalIgnoreCase)) throw new UnauthorizedAccessException("Actor is not authorized for this duplicate command.");
    }
    private sealed class Entry(DuplicateIngredientResolutionRequest request, EvidenceResolutionState state)
    {
        public DuplicateIngredientResolutionRequest Request { get; } = request;
        public EvidenceResolutionState State { get; set; } = state;
    }
}
