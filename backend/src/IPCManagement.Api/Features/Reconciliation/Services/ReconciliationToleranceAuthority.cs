using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class ReconciliationToleranceAuthority
{
    public const string SystemDefaultScope = "SYSTEM_DEFAULT";
    public const decimal SystemDefaultValue = 0.5m;
    public const long SystemDefaultVersion = 1;

    public static ReconciliationTolerance? ReadSystemDefault(IReadOnlyList<ReconciliationTolerance> tolerances)
    {
        var defaults = tolerances.Where(row => row.ScopeKind == SystemDefaultScope).Take(2).ToList();
        if (defaults.Count > 1)
            throw new ReconciliationToleranceAuthorityException("Có nhiều hơn một dung sai mặc định hệ thống.");
        if (defaults.Count == 0) return null;

        var row = defaults[0];
        if (row.ScopeId is not null || row.Value != SystemDefaultValue || row.Version != SystemDefaultVersion)
            throw new ReconciliationToleranceAuthorityException("Dung sai mặc định hệ thống hiện có không khớp authority đã khóa.");
        return row;
    }
}
