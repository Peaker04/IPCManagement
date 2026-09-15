using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using static IPCManagement.Api.Features.Planning.Services.ServiceRunRules;

namespace IPCManagement.Api.Features.Planning.Services;

public sealed partial class ServiceRunService
{
    private async Task<ServiceRunProjectionData> LoadProjectionDataAsync(
        IReadOnlyCollection<ServiceRun> runs,
        bool includeOperationalFields,
        CancellationToken cancellationToken)
    {
        var planIds = runs.Select(run => run.PlanId).ToList();
        var runIds = runs.Select(run => run.ServiceRunId).ToList();
        var serviceDates = runs.Select(run => run.Plan.PlanDate).Distinct().ToList();
        var minServiceDate = serviceDates.Min();
        var maxServiceDate = serviceDates.Max();

        var planLines = await context.Productionplanlines.AsNoTracking()
            .Include(line => line.QuantityPlanLine).ThenInclude(line => line.QuantityPlan)
            .Include(line => line.QuantityPlanLine).ThenInclude(line => line.MenuSchedule)
            .Where(line => planIds.Contains(line.PlanId)).ToListAsync(cancellationToken);
        var demandLines = await context.Materialrequestlines.AsNoTracking()
            .Include(line => line.Request).Include(line => line.PlanLine)
            .Include(line => line.Ingredient).Include(line => line.Unit)
            .Where(line => planIds.Contains(line.Request.PlanId)).ToListAsync(cancellationToken);
        var sourceLines = await context.Servicerunsourcelines.AsNoTracking()
            .Where(item => runIds.Contains(item.ServiceRunId)).ToListAsync(cancellationToken);
        var requestIds = demandLines.Select(line => line.RequestId).Distinct().ToList();
        var issues = await context.Inventoryissues.AsNoTracking()
            .Include(issue => issue.Inventoryissuelines).Include(issue => issue.Inventoryreturns)
            .Where(issue => issue.MaterialRequestId != null && requestIds.Contains(issue.MaterialRequestId) &&
                            issue.ReconciliationBatchId == null && serviceDates.Contains(issue.IssueDate))
            .ToListAsync(cancellationToken);
        var issueIds = issues.Select(issue => issue.IssueId).ToList();
        var supplementalRows = await context.Supplementalmaterialrequests.AsNoTracking()
            .Where(item => issueIds.Contains(item.IssueId))
            .Select(item => new SupplementalRow(item.IssueId, item.RequestCode, item.Status))
            .ToListAsync(cancellationToken);
        var discrepancyIssueIds = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "KitchenReceipt" && item.FieldName == "KitchenReceiptDiscrepancy" &&
                           item.EntityId != null && issueIds.Contains(item.EntityId))
            .Select(item => item.EntityId)
            .ToListAsync(cancellationToken);
        var adjustments = await context.Servicerunadjustments.AsNoTracking()
            .Where(item => runIds.Contains(item.ServiceRunId)).ToListAsync(cancellationToken);
        var declarations = await (
            from declaration in context.Servicerunvariancedeclarations.AsNoTracking()
            join actor in context.Users.AsNoTracking() on declaration.DeclaredBy equals actor.UserId
            where runIds.Contains(declaration.ServiceRunId)
            select new VarianceDeclarationRow(declaration, actor.FullName))
            .ToListAsync(cancellationToken);
        var declarationIds = declarations.Select(item => item.Declaration.ServiceRunVarianceDeclarationId).ToList();
        var waivers = declarationIds.Count == 0
            ? []
            : await context.Servicerunvariancewaivers.AsNoTracking()
                .Where(item => declarationIds.Contains(item.ServiceRunVarianceDeclarationId))
                .ToListAsync(cancellationToken);
        var dishIds = planLines.Select(line => line.DishId).Distinct().ToList();
        var boms = await context.Dishboms.AsNoTracking()
            .Where(bom => dishIds.Contains(bom.DishId) && bom.BomStatus == "PUBLISHED" && bom.EffectiveFrom <= maxServiceDate &&
                          (bom.EffectiveTo == null || bom.EffectiveTo >= minServiceDate))
            .ToListAsync(cancellationToken);

        var purchaseCosts = new List<PurchaseCostRow>();
        var receivedCosts = new List<ReceivedCostRow>();
        if (includeOperationalFields)
        {
            purchaseCosts = await (
                from purchaseLine in context.Purchaserequestlines.AsNoTracking()
                join materialRequestLine in context.Materialrequestlines.AsNoTracking() on purchaseLine.MaterialRequestLineId equals materialRequestLine.RequestLineId
                join materialRequest in context.Materialrequests.AsNoTracking() on materialRequestLine.RequestId equals materialRequest.RequestId
                join planLine in context.Productionplanlines.AsNoTracking() on materialRequestLine.PlanLineId equals planLine.PlanLineId
                where planIds.Contains(materialRequest.PlanId)
                select new PurchaseCostRow(materialRequest.PlanId, planLine.ShiftName, purchaseLine.PurchaseRequestLineId,
                    purchaseLine.EstimatedUnitPrice * purchaseLine.PurchaseQty))
                .ToListAsync(cancellationToken);
            receivedCosts = await (
                from receiptLine in context.Inventoryreceiptlines.AsNoTracking()
                join purchaseLine in context.Purchaserequestlines.AsNoTracking() on receiptLine.PurchaseRequestLineId equals purchaseLine.PurchaseRequestLineId
                join materialRequestLine in context.Materialrequestlines.AsNoTracking() on purchaseLine.MaterialRequestLineId equals materialRequestLine.RequestLineId
                join materialRequest in context.Materialrequests.AsNoTracking() on materialRequestLine.RequestId equals materialRequest.RequestId
                join planLine in context.Productionplanlines.AsNoTracking() on materialRequestLine.PlanLineId equals planLine.PlanLineId
                where planIds.Contains(materialRequest.PlanId)
                select new ReceivedCostRow(materialRequest.PlanId, planLine.ShiftName,
                    receiptLine.Amount ?? receiptLine.Quantity * receiptLine.UnitPrice))
                .ToListAsync(cancellationToken);
        }

        return new ServiceRunProjectionData(planLines, demandLines, sourceLines, issues, supplementalRows,
            discrepancyIssueIds, adjustments, declarations, waivers, boms, purchaseCosts, receivedCosts);
    }

    private static ServiceRunMappedRow BuildProjection(ServiceRun run, ProductionPlan plan, ServiceRunProjectionData data)
    {
        var planLines = data.PlanLines.Where(line => SameId(line.PlanId, run.PlanId) && line.ShiftName == run.ShiftName).ToList();
        var demandLines = data.DemandLines.Where(line => SameId(line.Request.PlanId, run.PlanId) && line.PlanLine.ShiftName == run.ShiftName).ToList();
        var scopedSourceLineIds = data.SourceLines.Where(item => SameId(item.ServiceRunId, run.ServiceRunId)).Select(item => item.MaterialRequestLineId);
        var scopedDemandLines = SelectScopedDemandLines(demandLines, scopedSourceLineIds);
        var scopedPlanLineIds = scopedDemandLines.Select(line => line.PlanLineId).ToList();
        var scopedPlanLines = planLines.Where(line => scopedPlanLineIds.Any(id => SameId(id, line.PlanLineId))).ToList();
        var planRequestIds = scopedDemandLines.Select(line => line.RequestId).ToList();
        var issues = data.Issues.Where(issue => issue.IssueDate == plan.PlanDate && issue.MaterialRequestId is not null &&
            planRequestIds.Any(id => SameId(id, issue.MaterialRequestId))).ToList();
        var relevantIssueLines = SelectRelevantIssueLines(issues, scopedDemandLines, run.ShiftName);
        var relevantIssues = issues.Where(issue => issue.Inventoryissuelines.Any(relevantIssueLines.Contains)).ToList();
        var relevantIssueIds = relevantIssues.Select(issue => issue.IssueId).ToList();
        var openSupplementalCount = data.SupplementalRows.Count(item => item.Status != "FULFILLED" && item.Status != "REJECTED" &&
            relevantIssueIds.Any(id => SameId(id, item.IssueId)));
        var hasReceiptDiscrepancy = data.DiscrepancyIssueIds.Any(issueId => issueId is not null && relevantIssueIds.Any(id => SameId(id, issueId)));
        var runDeclarations = data.Declarations.Where(item => SameId(item.Declaration.ServiceRunId, run.ServiceRunId)).ToList();
        var pendingDeclarations = runDeclarations
            .Where(item => !data.Waivers.Any(waiver => SameId(waiver.ServiceRunVarianceDeclarationId, item.Declaration.ServiceRunVarianceDeclarationId)))
            .OrderByDescending(item => item.Declaration.DeclaredAt)
            .Select(item => new ServiceRunVarianceDeclarationOptionDto
            {
                DeclarationId = GuidHelper.ToGuidString(item.Declaration.ServiceRunVarianceDeclarationId),
                TrackLabel = item.Declaration.Track,
                Reason = item.Declaration.Reason,
                DeclaredByLabel = item.DeclaredByLabel,
                DeclaredAt = item.Declaration.DeclaredAt,
            }).ToList();
        var hasApprovedVarianceWaiver = runDeclarations.Any(item => data.Waivers.Any(waiver =>
            SameId(waiver.ServiceRunVarianceDeclarationId, item.Declaration.ServiceRunVarianceDeclarationId) &&
            !item.Declaration.DeclaredBy.SequenceEqual(waiver.ApprovedBy)));
        var scopedSourceLineOptions = scopedDemandLines
            .Where(line => run.CustomerId is not null && SameId(line.PlanLine.CustomerId, run.CustomerId) && line.PriceTierAmount == run.PriceTierAmount)
            .Select(line => new ServiceRunSourceLineOptionDto
            {
                SourceLineId = GuidHelper.ToGuidString(line.RequestLineId),
                IngredientLabel = line.Ingredient.IngredientName,
                RequiredQuantity = line.TotalRequiredQty,
                UnitLabel = line.Unit.UnitName,
            })
            .OrderBy(line => line.IngredientLabel).ThenBy(line => line.SourceLineId).ToList();
        var hasBomBlocker = scopedPlanLines.Any(line => !data.Boms.Any(bom =>
            SameId(bom.DishId, line.DishId) && bom.PriceTierAmount == line.QuantityPlanLine.MenuSchedule.MenuPrice &&
            bom.EffectiveFrom <= plan.PlanDate && (bom.EffectiveTo == null || bom.EffectiveTo >= plan.PlanDate) &&
            (bom.CustomerId is null || SameId(bom.CustomerId, line.CustomerId))));
        var requiredByItem = scopedDemandLines.GroupBy(line => ItemKey(line.IngredientId, line.UnitId)).ToDictionary(group => group.Key, group => group.Sum(line => line.TotalRequiredQty));
        var issuedByItem = relevantIssueLines.GroupBy(line => ItemKey(line.IngredientId, line.UnitId)).ToDictionary(group => group.Key, group => group.Sum(line => line.IssuedQty));
        var plannedServings = scopedPlanLines.GroupBy(line => Convert.ToBase64String(line.QuantityPlanLineId)).Sum(group => group.Max(line => line.TotalServings));
        var input = new ServiceRunLifecycleInput(
            IsPlanSignedOff: scopedPlanLines.Count > 0 && scopedPlanLines.All(line => line.QuantityPlanLine.QuantityPlan.Status == "COMPLETED"),
            HasGeneratedMaterialDemand: scopedDemandLines.Count > 0,
            HasBomBlocker: hasBomBlocker,
            HasOpenSupply: requiredByItem.Any(item => issuedByItem.GetValueOrDefault(item.Key) < item.Value),
            HasUnreceivedIssue: relevantIssues.Any(issue => issue.ReceivedAt is null),
            HasOpenSupplemental: openSupplementalCount > 0,
            HasRecordedActualServings: run.ActualServingsRecordedAt is not null,
            HasUnresolvedVariance: issues.SelectMany(issue => issue.Inventoryreturns).Any(item => item.ReceivedAt is null) ||
                                   (hasReceiptDiscrepancy && run.VarianceResolvedAt is null) || pendingDeclarations.Count > 0,
            HasUnresolvedServingVariance: run.ActualServings is not null && run.ActualServings != plannedServings && run.ServingVarianceResolvedAt is null,
            HasServiceConfirmation: run.ServiceConfirmedAt is not null,
            IsServiceConfirmationWaived: run.ServiceConfirmationWaivedAt is not null,
            IsClosed: run.ClosedAt is not null,
            HasApprovedVarianceWaiver: hasApprovedVarianceWaiver);
        var lifecycle = ServiceRunLifecycle.Evaluate(input);
        var isConfirmationPending = run.ServiceConfirmedAt is null && run.ServiceConfirmationWaivedAt is null;
        var canSetConfirmationOutcome = run.ClosedAt is null && isConfirmationPending && CanConfirmOrWaive(lifecycle.Blockers);
        var status = run.StartedAt is not null && lifecycle.Status == ServiceRunStatus.ReadyToProduce ? ServiceRunStatus.InService : lifecycle.Status;
        var runAdjustments = data.Adjustments.Where(item => SameId(item.ServiceRunId, run.ServiceRunId)).ToList();
        var latestCorrection = runAdjustments.OrderByDescending(item => item.CreatedAt).FirstOrDefault();
        var projection = new ServiceRunLifecycleProjectionDto
        {
            ServiceRunId = GuidHelper.ToGuidString(run.ServiceRunId), PlanId = GuidHelper.ToGuidString(plan.PlanId), PlanCode = plan.PlanCode, ServiceDate = plan.PlanDate,
            CustomerId = run.CustomerId is null ? string.Empty : GuidHelper.ToGuidString(run.CustomerId),
            CustomerLabel = run.CustomerId is null ? "Phạm vi chưa xác định" : GuidHelper.ToGuidString(run.CustomerId),
            ShiftName = run.ShiftName, PriceTierAmount = run.PriceTierAmount ?? 0m, CurrentVersion = run.ConcurrencyVersion, Status = status, Blockers = lifecycle.Blockers,
            Tracks = BuildTracks(lifecycle.Blockers, status), AllowedActions = BuildAllowedActions(run, lifecycle, canSetConfirmationOutcome),
            CloseSnapshot = new ServiceRunCloseSnapshotViewDto { IsImmutable = run.ClosedAt is not null, ClosedAt = run.ClosedAt, ActualServings = run.ActualServings },
            CorrectionOverlay = latestCorrection is null
                ? new ServiceRunCorrectionOverlayDto()
                : new ServiceRunCorrectionOverlayDto { State = "PENDING", CorrectedActualServings = latestCorrection.CorrectedActualServings, ActualServingsDelta = latestCorrection.CorrectedActualServings - (run.ActualServings ?? 0), Reason = latestCorrection.Reason },
            CanStartService = lifecycle.CanStartService && run.StartedAt is null,
            CanRecordActualServings = run.ClosedAt is null && (run.StartedAt is not null || lifecycle.CanStartService),
            CanConfirmService = canSetConfirmationOutcome,
            CanWaiveServiceConfirmation = canSetConfirmationOutcome && run.ServiceConfirmationPolicy == ServiceConfirmationPolicy.Waivable,
            CanResolveVariance = run.ClosedAt is null && lifecycle.Blockers.Contains(ServiceRunBlocker.UnresolvedVariance) && !issues.SelectMany(issue => issue.Inventoryreturns).Any(item => item.ReceivedAt is null),
            CanResolveServingVariance = run.ClosedAt is null && lifecycle.Blockers.Contains(ServiceRunBlocker.UnresolvedServingVariance),
            CanClose = lifecycle.CanClose,
            ServiceConfirmationOutcome = run.ServiceConfirmedAt is not null ? ServiceConfirmationOutcome.Confirmed : run.ServiceConfirmationWaivedAt is not null ? ServiceConfirmationOutcome.Waived : ServiceConfirmationOutcome.Pending,
            PlannedServings = plannedServings, ActualServings = run.ActualServings,
            MaterialRequestLineCount = scopedDemandLines.Count, IssueCount = relevantIssues.Count, UnreceivedIssueCount = relevantIssues.Count(issue => issue.ReceivedAt is null),
            OpenSupplementalCount = openSupplementalCount, UnreceivedReturnCount = issues.SelectMany(issue => issue.Inventoryreturns).Count(item => item.ReceivedAt is null), HasBomBlocker = hasBomBlocker,
            AdjustmentCount = runAdjustments.Count,
            SourceLineOptions = scopedSourceLineOptions,
            PendingVarianceDeclarations = pendingDeclarations,
        };
        return new ServiceRunMappedRow(projection, demandLines);
    }

    private static bool SameId(byte[] left, byte[] right) => left.SequenceEqual(right);

    private sealed record SupplementalRow(byte[] IssueId, string RequestCode, string Status);
    private sealed record VarianceDeclarationRow(ServiceRunVarianceDeclaration Declaration, string DeclaredByLabel);
    private sealed record PurchaseCostRow(byte[] PlanId, string ShiftName, byte[] PurchaseRequestLineId, decimal EstimatedCost);
    private sealed record ReceivedCostRow(byte[] PlanId, string ShiftName, decimal Cost);
    private sealed record ServiceRunMappedRow(ServiceRunLifecycleProjectionDto Lifecycle, List<MaterialRequestLine> DemandLines);
    private sealed record ServiceRunProjectionData(
        List<ProductionPlanLine> PlanLines,
        List<MaterialRequestLine> DemandLines,
        List<ServiceRunSourceLine> SourceLines,
        List<InventoryIssue> Issues,
        List<SupplementalRow> SupplementalRows,
        List<byte[]?> DiscrepancyIssueIds,
        List<ServiceRunAdjustment> Adjustments,
        List<VarianceDeclarationRow> Declarations,
        List<ServiceRunVarianceWaiver> Waivers,
        List<DishBom> Boms,
        List<PurchaseCostRow> PurchaseCosts,
        List<ReceivedCostRow> ReceivedCosts);
}
