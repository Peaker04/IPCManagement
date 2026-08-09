using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed record BomCoverageLine(
    string BomLineId,
    string DishId,
    string IngredientId,
    string UnitId,
    string IngredientUnitId,
    string? CustomerId,
    decimal PriceTier,
    int Version,
    decimal Quantity,
    bool Published,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string SourceDigest);

public sealed record BomResolutionRequest(
    string DishId,
    string? CustomerId,
    decimal PriceTier,
    DateOnly AsOf,
    string CurrentFingerprint,
    EvidencePackageInput Evidence,
    IReadOnlyList<BomCoverageLine> Lines);

public sealed record BomCoverage(string Diagnostic, string? ExemptionId, IReadOnlyList<string> BomLineIds);

public interface IBomEvidenceResolutionService
{
    EvidenceResolutionState Preview(BomResolutionRequest request, ResolutionCommandContext command);
    EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command);
    EvidenceResolutionState Apply(string resolutionId, ResolutionCommandContext command, DateTime nowUtc);
}

public sealed class BomEvidenceResolutionService : IBomEvidenceResolutionService
{
    private readonly DurableResolutionStore? _durable;
    private readonly Dictionary<string, Entry> _entries = new(StringComparer.Ordinal);
    private readonly Dictionary<string, EvidenceResolutionState> _receipts = new(StringComparer.Ordinal);
    private readonly object _sync = new();

    public BomEvidenceResolutionService() { }

    public BomEvidenceResolutionService(
        IPCManagement.Api.Data.IpcManagementContext context,
        IPCManagement.Api.Data.Transactions.IEfTransactionRunner transactionRunner,
        IPCManagement.Api.Infrastructure.Lifecycle.ILifecycleTransitionRecorder lifecycleRecorder)
        => _durable = new DurableResolutionStore(context, transactionRunner, lifecycleRecorder);

    public static BomCoverage EvaluateCoverage(BomResolutionRequest request, DateTime nowUtc)
    {
        EvidencePackageGuard.Validate(request.Evidence, "BOM_GAP", request.DishId, request.CurrentFingerprint,
            "CATALOG_SOURCE_OWNER", "BOM_WORKBOOK", nowUtc);
        if (request.Evidence.Decision == "BOM_EXEMPTION")
        {
            if (request.Evidence.ExpiresAtUtc is null || request.Evidence.ExpiresAtUtc <= nowUtc)
                throw new InvalidOperationException("BOM exemption is expired and the demand gap is open again.");
            return new BomCoverage("BOM_EXEMPTION", request.Evidence.PackageId, []);
        }
        if (request.Evidence.Decision != "PUBLISHED_BOM")
            throw new InvalidOperationException("BOM evidence decision is not terminal.");

        var scoped = request.Lines.Where(line => line.DishId == request.DishId &&
            line.CustomerId == request.CustomerId && line.PriceTier == request.PriceTier && line.Published &&
            line.EffectiveFrom <= request.AsOf && (line.EffectiveTo is null || line.EffectiveTo >= request.AsOf)).ToArray();
        if (scoped.Length == 0)
        {
            if (request.Lines.Count > 0)
                throw new InvalidOperationException("Published BOM does not match the exact customer/global scope, tier or effective date.");
            throw new InvalidOperationException("A silent BOM gap blocks demand generation.");
        }
        var version = scoped.Max(line => line.Version);
        scoped = scoped.Where(line => line.Version == version).ToArray();
        if (scoped.Any(line => line.Quantity <= 0))
            throw new InvalidOperationException("Every published BOM line requires a positive quantity.");
        if (scoped.Any(line => line.UnitId != line.IngredientUnitId))
            throw new InvalidOperationException("Every published BOM line must use the exact ingredient unit.");
        if (scoped.Any(line => !EvidencePackageGuard.IsSha256(line.SourceDigest)))
            throw new InvalidOperationException("Every published BOM line requires the exact workbook/spec digest.");
        return new BomCoverage("PUBLISHED_BOM", null, scoped.Select(line => line.BomLineId).Order().ToArray());
    }

    public EvidenceResolutionState Preview(BomResolutionRequest request, ResolutionCommandContext command)
    {
        RequireRole(command, "Catalog", "Admin");
        var coverage = EvaluateCoverage(request, command.NowUtc);
        EvidencePackageGuard.RequireIndependentActor(request.Evidence, command.ActorId);
        if (_durable is not null)
            return _durable.Preview("BOM_GAP", request.DishId, request.CurrentFingerprint, request.Evidence,
                command, coverage.ExemptionId ?? string.Join(',', coverage.BomLineIds));
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var outcome = coverage.ExemptionId ?? string.Join(',', coverage.BomLineIds);
            var state = new EvidenceResolutionState(Guid.NewGuid().ToString(), request.DishId,
                "PENDING_MANAGER_REVIEW", 0, command.ActorId, null, null, request.Evidence.Decision, outcome, 1);
            _entries.Add(state.ResolutionId, new Entry(request, state));
            _receipts.Add(command.CommandId, state);
            return state;
        }
    }

    public EvidenceResolutionState Review(string resolutionId, ResolutionCommandContext command)
    {
        RequireRole(command, "Manager");
        if (_durable is not null) return _durable.Review("BOM_GAP", resolutionId, command);
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            Check(entry.State, command.ExpectedVersion, "PENDING_MANAGER_REVIEW");
            if (entry.State.PreviewedBy == command.ActorId) throw new InvalidOperationException("BOM review requires a different actor.");
            EvidencePackageGuard.RequireIndependentActor(entry.Request.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPROVED", Version = 1, ReviewedBy = command.ActorId, AuditCount = 2 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    public EvidenceResolutionState Apply(string resolutionId, ResolutionCommandContext command, DateTime nowUtc)
    {
        RequireRole(command, "Admin");
        if (_durable is not null) return _durable.Apply("BOM_GAP", resolutionId, command, nowUtc);
        lock (_sync)
        {
            if (_receipts.TryGetValue(command.CommandId, out var replay)) return replay;
            var entry = Get(resolutionId);
            Check(entry.State, command.ExpectedVersion, "APPROVED");
            EvaluateCoverage(entry.Request, nowUtc);
            EvidencePackageGuard.RequireIndependentActor(entry.Request.Evidence, command.ActorId);
            entry.State = entry.State with { Status = "APPLIED", Version = 2, AppliedBy = command.ActorId, AuditCount = 3 };
            _receipts.Add(command.CommandId, entry.State);
            return entry.State;
        }
    }

    private Entry Get(string id) => _entries.GetValueOrDefault(id) ?? throw new KeyNotFoundException("BOM evidence resolution was not found.");
    private static void Check(EvidenceResolutionState state, long version, string status)
    {
        if (state.Version != version) throw new InvalidOperationException("BOM resolution version is stale.");
        if (state.Status != status) throw new InvalidOperationException($"BOM resolution must be {status}.");
    }
    private static void RequireRole(ResolutionCommandContext command, params string[] roles)
    {
        if (!roles.Contains(command.ActorRole, StringComparer.OrdinalIgnoreCase)) throw new UnauthorizedAccessException("Actor is not authorized for this BOM command.");
    }
    private sealed class Entry(BomResolutionRequest request, EvidenceResolutionState state)
    {
        public BomResolutionRequest Request { get; } = request;
        public EvidenceResolutionState State { get; set; } = state;
    }
}
