using System.Collections.ObjectModel;
using IPCManagement.Api.Features.SystemOperation.Contracts;

namespace IPCManagement.Api.Features.SystemOperation.Services;

public static class SystemOperationEligibility
{
    public const string Default = "DEFAULT";
    public const string MaterialReconciliation = "MATERIAL_RECONCILIATION";

    private static readonly SystemOperationCapabilitiesDto DefaultCapabilities = CreateCapabilities(
        ["dashboard", "weekly-menu", "meal-orders", "approvals", "purchasing", "warehouse", "chef-dashboard", "reports", "admin-data", "approval-rules"],
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["weekly-menu"] = ["schedule", "demand", "production-plan", "purchase-summary", "cost", "dish-materials"],
            ["warehouse"] = ["movement", "demand", "exceptions"],
            ["approvals"] = ["queue", "history"],
            ["purchasing"] = ["workflow", "supplemental", "quotations"],
            ["chef"] = ["production", "documents"],
            ["reports"] = ["price", "demand", "purchase", "stock", "movement", "kitchen", "usage", "audit", "data-quality"],
            ["admin-data"] = ["bom-import", "contracts", "cleanup", "inventory", "statistics", "audit", "employees"]
        });

    private static readonly SystemOperationCapabilitiesDto MaterialReconciliationCapabilities = CreateCapabilities(
        ["dashboard", "weekly-menu", "purchasing", "warehouse", "reports", "admin-data"],
        new Dictionary<string, string[]>(StringComparer.Ordinal)
        {
            ["weekly-menu"] = ["schedule", "purchase-summary"]
        });

    private static readonly HashSet<string> ExcludedControllers = new(StringComparer.OrdinalIgnoreCase)
    {
        "Approvals", "ApprovalHistory", "ApprovalRules", "Coordination", "CustomerContracts",
        "MealQuantityPlans", "MenuSchedules", "OrderAdjustments", "OrderPlans", "OrderSignoffs",
        "PortionRules", "Production", "ServiceRuns"
    };

    private static readonly HashSet<string> NeutralControllers = new(StringComparer.OrdinalIgnoreCase)
    {
        "Auth", "SystemOperationMode", "LifecycleOutbox"
    };

    public static bool IsValidMode(string? mode) => mode is Default or MaterialReconciliation;

    public static SystemOperationCapabilitiesDto CapabilitiesFor(string mode) => mode switch
    {
        Default => DefaultCapabilities,
        MaterialReconciliation => MaterialReconciliationCapabilities,
        _ => throw new ArgumentException("Chế độ vận hành không hợp lệ.", nameof(mode))
    };

    public static string OperationKey(string controller, string action) =>
        $"{controller}.{action}".ToLowerInvariant();

    public static OperationDisposition Classify(string controller, string action)
    {
        if (NeutralControllers.Contains(controller)) return OperationDisposition.Neutral;
        if (ExcludedControllers.Contains(controller)) return OperationDisposition.ExcludedInMaterialReconciliation;
        return OperationDisposition.Retained;
    }

    public static bool IsAllowed(string mode, OperationDisposition disposition) =>
        mode == Default || disposition != OperationDisposition.ExcludedInMaterialReconciliation;

    private static SystemOperationCapabilitiesDto CreateCapabilities(
        string[] navigation,
        IReadOnlyDictionary<string, string[]> pageTabs)
    {
        var readOnlyNavigation = Array.AsReadOnly(navigation);
        var readOnlyPageTabs = new ReadOnlyDictionary<string, IReadOnlyList<string>>(
            pageTabs.ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<string>)Array.AsReadOnly(group.Value),
                StringComparer.Ordinal));
        return new(readOnlyNavigation, readOnlyPageTabs);
    }
}

public enum OperationDisposition
{
    Neutral,
    Retained,
    ExcludedInMaterialReconciliation
}
