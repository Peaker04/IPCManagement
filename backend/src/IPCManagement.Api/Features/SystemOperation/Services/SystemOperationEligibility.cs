namespace IPCManagement.Api.Features.SystemOperation.Services;

public static class SystemOperationEligibility
{
    public const string Default = "DEFAULT";
    public const string MaterialReconciliation = "MATERIAL_RECONCILIATION";

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
}

public enum OperationDisposition
{
    Neutral,
    Retained,
    ExcludedInMaterialReconciliation
}
