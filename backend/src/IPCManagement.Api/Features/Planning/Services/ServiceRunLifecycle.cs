namespace IPCManagement.Api.Features.Planning.Services;

public static class ServiceRunStatus
{
    public const string Planned = "PLANNED";
    public const string Blocked = "BLOCKED";
    public const string MaterialsInProgress = "MATERIALS_IN_PROGRESS";
    public const string ReadyToProduce = "READY_TO_PRODUCE";
    public const string InService = "IN_SERVICE";
    public const string ReconciliationRequired = "RECONCILIATION_REQUIRED";
    public const string ReadyToClose = "READY_TO_CLOSE";
    public const string Closed = "CLOSED";
}

public static class ServiceConfirmationPolicy
{
    public const string Required = "REQUIRED";
    public const string Waivable = "WAIVABLE";
}

public static class ServiceConfirmationOutcome
{
    public const string Pending = "PENDING";
    public const string Confirmed = "CONFIRMED";
    public const string Waived = "WAIVED";
}

public static class ServiceRunBlocker
{
    public const string PlanNotSignedOff = "PLAN_NOT_SIGNED_OFF";
    public const string DemandNotGenerated = "DEMAND_NOT_GENERATED";
    public const string BomIncomplete = "BOM_INCOMPLETE";
    public const string OpenSupply = "OPEN_SUPPLY";
    public const string UnreceivedIssue = "UNRECEIVED_ISSUE";
    public const string OpenSupplemental = "OPEN_SUPPLEMENTAL";
    public const string ActualServingsNotRecorded = "ACTUAL_SERVINGS_NOT_RECORDED";
    public const string UnresolvedVariance = "UNRESOLVED_VARIANCE";
    public const string UnresolvedServingVariance = "UNRESOLVED_SERVING_VARIANCE";
    public const string ConfirmationOutcomeConflict = "CONFIRMATION_OUTCOME_CONFLICT";
    public const string ServiceConfirmationRequired = "SERVICE_CONFIRMATION_REQUIRED";
}

public sealed record ServiceRunLifecycleInput(
    bool IsPlanSignedOff,
    bool HasGeneratedMaterialDemand,
    bool HasBomBlocker,
    bool HasOpenSupply,
    bool HasUnreceivedIssue,
    bool HasOpenSupplemental,
    bool HasRecordedActualServings,
    bool HasUnresolvedVariance,
    bool HasServiceConfirmation,
    bool IsServiceConfirmationWaived,
    bool IsClosed,
    bool HasUnresolvedServingVariance = false,
    bool HasApprovedVarianceWaiver = false);

public sealed record ServiceRunLifecycleEvaluation(
    string Status,
    IReadOnlyList<string> Blockers,
    bool CanStartService,
    bool CanClose);

public static class ServiceRunLifecycle
{
    public static ServiceRunLifecycleEvaluation Evaluate(ServiceRunLifecycleInput input)
    {
        ArgumentNullException.ThrowIfNull(input);

        if (input.IsClosed)
        {
            return new(ServiceRunStatus.Closed, [], false, false);
        }

        var blockers = GetBlockers(input);
        var status = ResolveStatus(input, blockers);
        var canStartService = status == ServiceRunStatus.ReadyToProduce;
        var canClose = status == ServiceRunStatus.ReadyToClose
            && blockers.Count == 0;

        return new(status, blockers, canStartService, canClose);
    }

    private static List<string> GetBlockers(ServiceRunLifecycleInput input)
    {
        var blockers = new List<string>();
        if (!input.IsPlanSignedOff) blockers.Add(ServiceRunBlocker.PlanNotSignedOff);
        if (!input.HasGeneratedMaterialDemand) blockers.Add(ServiceRunBlocker.DemandNotGenerated);
        if (input.HasBomBlocker) blockers.Add(ServiceRunBlocker.BomIncomplete);
        if (input.HasOpenSupply) blockers.Add(ServiceRunBlocker.OpenSupply);
        if (input.HasUnreceivedIssue) blockers.Add(ServiceRunBlocker.UnreceivedIssue);
        if (input.HasOpenSupplemental) blockers.Add(ServiceRunBlocker.OpenSupplemental);
        if (!input.HasRecordedActualServings) blockers.Add(ServiceRunBlocker.ActualServingsNotRecorded);
        if (input.HasUnresolvedVariance && !input.HasApprovedVarianceWaiver) blockers.Add(ServiceRunBlocker.UnresolvedVariance);
        if (input.HasUnresolvedServingVariance) blockers.Add(ServiceRunBlocker.UnresolvedServingVariance);
        if (input.HasServiceConfirmation && input.IsServiceConfirmationWaived) blockers.Add(ServiceRunBlocker.ConfirmationOutcomeConflict);
        if (!input.HasServiceConfirmation && !input.IsServiceConfirmationWaived)
            blockers.Add(ServiceRunBlocker.ServiceConfirmationRequired);
        return blockers;
    }

    private static string ResolveStatus(ServiceRunLifecycleInput input, IReadOnlyCollection<string> blockers)
    {
        if (!input.IsPlanSignedOff || input.HasBomBlocker) return ServiceRunStatus.Blocked;
        if (!input.HasGeneratedMaterialDemand || input.HasOpenSupply || input.HasUnreceivedIssue || input.HasOpenSupplemental)
            return ServiceRunStatus.MaterialsInProgress;
        if (!input.HasRecordedActualServings) return ServiceRunStatus.ReadyToProduce;
        if ((input.HasUnresolvedVariance && !input.HasApprovedVarianceWaiver) || input.HasUnresolvedServingVariance || blockers.Contains(ServiceRunBlocker.ConfirmationOutcomeConflict)) return ServiceRunStatus.ReconciliationRequired;
        if (blockers.Contains(ServiceRunBlocker.ServiceConfirmationRequired)) return ServiceRunStatus.InService;
        return ServiceRunStatus.ReadyToClose;
    }
}
