using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace IPCManagement.Api.Features.Planning.Services;

public sealed class ServiceRunService(IpcManagementContext context) : IServiceRunService
{
    public async Task<ServiceRunLifecycleProjectionDto?> OpenAsync(OpenServiceRunRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var planId = GuidHelper.ParseGuidString(request.PlanId) ?? throw new ArgumentException("Kế hoạch sản xuất không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId) ?? throw new UnauthorizedAccessException("Không xác định được người mở ca phục vụ.");
        var shiftName = NormalizeShift(request.ShiftName);
        var plan = await context.Productionplans.Include(item => item.Productionplanlines)
            .FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(planId), cancellationToken)
            ?? throw new ArgumentException("Không tìm thấy kế hoạch sản xuất.");
        if (plan.SentToKitchenAt is null)
            throw new InvalidOperationException("Kế hoạch sản xuất chưa gửi Bếp nên chưa thể mở Ca phục vụ.");
        if (!plan.Productionplanlines.Any(line => line.ShiftName == shiftName)) throw new ArgumentException("Kế hoạch sản xuất không có ca phục vụ đã chọn.");

        var run = await context.Serviceruns.FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(planId) && item.ShiftName == shiftName, cancellationToken);
        if (run is null)
        {
            var now = DateTime.UtcNow;
            run = new ServiceRun { ServiceRunId = GuidHelper.NewId(), PlanId = planId, ShiftName = shiftName, OpenedBy = actorId, CreatedAt = now, UpdatedAt = now };
            context.Serviceruns.Add(run);
            context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRun), EntityId = run.ServiceRunId,
                FieldName = "Open", NewValue = $"{plan.PlanCode}|{shiftName}", Reason = "Mở hồ sơ thực thi Ca phục vụ từ kế hoạch sản xuất."
            });
            await context.SaveChangesAsync(cancellationToken);
        }
        return await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> GetProjectionAsync(string serviceRunId, CancellationToken cancellationToken = default)
    {
        var runId = GuidHelper.ParseGuidString(serviceRunId);
        if (runId is null) return null;
        var run = await context.Serviceruns.AsNoTracking().FirstOrDefaultAsync(item => item.ServiceRunId.SequenceEqual(runId), cancellationToken);
        if (run is null) return null;
        var plan = await context.Productionplans.AsNoTracking().FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(run.PlanId), cancellationToken);
        if (plan is null) return null;

        var planLines = await context.Productionplanlines.AsNoTracking()
            .Include(line => line.QuantityPlanLine).ThenInclude(line => line.QuantityPlan)
            .Include(line => line.QuantityPlanLine).ThenInclude(line => line.MenuSchedule)
            .Where(line => line.PlanId.SequenceEqual(run.PlanId) && line.ShiftName == run.ShiftName).ToListAsync(cancellationToken);
        var demandLines = await context.Materialrequestlines.AsNoTracking().Include(line => line.Request).Include(line => line.PlanLine)
            .Where(line => line.Request.PlanId.SequenceEqual(run.PlanId) && line.PlanLine.ShiftName == run.ShiftName).ToListAsync(cancellationToken);
        var issues = await context.Inventoryissues.AsNoTracking().Include(issue => issue.Inventoryissuelines).Include(issue => issue.Inventoryreturns)
            .Where(issue => issue.MaterialRequest.PlanId.SequenceEqual(run.PlanId) && issue.IssueDate == plan.PlanDate && issue.ShiftName == run.ShiftName).ToListAsync(cancellationToken);
        var openSupplementalCount = await context.Supplementalmaterialrequests.AsNoTracking()
            .Join(context.Inventoryissues.AsNoTracking(), request => request.IssueId, issue => issue.IssueId, (request, issue) => new { request, issue })
            .CountAsync(item => item.issue.MaterialRequest.PlanId.SequenceEqual(run.PlanId) && item.issue.IssueDate == plan.PlanDate && item.issue.ShiftName == run.ShiftName && item.request.Status != "FULFILLED" && item.request.Status != "REJECTED", cancellationToken);
        var hasReceiptDiscrepancy = await context.Auditlogs.AsNoTracking()
            .Join(context.Inventoryissues.AsNoTracking(), audit => audit.EntityId, issue => issue.IssueId, (audit, issue) => new { audit, issue })
            .AnyAsync(item => item.audit.BusinessArea == "KitchenReceipt" && item.audit.FieldName == "KitchenReceiptDiscrepancy" &&
                              item.issue.MaterialRequest.PlanId.SequenceEqual(run.PlanId) && item.issue.IssueDate == plan.PlanDate && item.issue.ShiftName == run.ShiftName, cancellationToken);
        var adjustmentCount = await context.Servicerunadjustments.AsNoTracking()
            .CountAsync(item => item.ServiceRunId.SequenceEqual(run.ServiceRunId), cancellationToken);
        var hasApprovedVarianceWaiver = await context.Servicerunvariancedeclarations.AsNoTracking()
            .Where(item => item.ServiceRunId.SequenceEqual(run.ServiceRunId))
            .Join(context.Servicerunvariancewaivers.AsNoTracking(), declaration => declaration.ServiceRunVarianceDeclarationId, waiver => waiver.ServiceRunVarianceDeclarationId, (declaration, waiver) => new { declaration, waiver })
            .AnyAsync(item => !item.declaration.DeclaredBy.SequenceEqual(item.waiver.ApprovedBy), cancellationToken);

        var hasBomBlocker = await HasBomBlockerAsync(plan.PlanDate, planLines, cancellationToken);
        var requiredByItem = demandLines.GroupBy(line => ItemKey(line.IngredientId, line.UnitId)).ToDictionary(group => group.Key, group => group.Sum(line => line.TotalRequiredQty));
        var issuedByItem = issues.SelectMany(issue => issue.Inventoryissuelines).GroupBy(line => ItemKey(line.IngredientId, line.UnitId)).ToDictionary(group => group.Key, group => group.Sum(line => line.IssuedQty));
        var input = new ServiceRunLifecycleInput(
            IsPlanSignedOff: planLines.Count > 0 && planLines.All(line => line.QuantityPlanLine.QuantityPlan.Status == "COMPLETED"),
            HasGeneratedMaterialDemand: demandLines.Count > 0,
            HasBomBlocker: hasBomBlocker,
            HasOpenSupply: requiredByItem.Any(item => issuedByItem.GetValueOrDefault(item.Key) < item.Value),
            HasUnreceivedIssue: issues.Any(issue => issue.ReceivedAt is null),
            HasOpenSupplemental: openSupplementalCount > 0,
            HasRecordedActualServings: run.ActualServingsRecordedAt is not null,
            HasUnresolvedVariance: issues.SelectMany(issue => issue.Inventoryreturns).Any(item => item.ReceivedAt is null) ||
                                  (hasReceiptDiscrepancy && run.VarianceResolvedAt is null),
            HasUnresolvedServingVariance: run.ActualServings is not null && run.ActualServings != planLines.GroupBy(line => Convert.ToBase64String(line.QuantityPlanLineId)).Sum(group => group.Max(line => line.TotalServings)) && run.ServingVarianceResolvedAt is null,
            HasServiceConfirmation: run.ServiceConfirmedAt is not null,
            IsServiceConfirmationWaived: run.ServiceConfirmationWaivedAt is not null,
            IsClosed: run.ClosedAt is not null,
            HasApprovedVarianceWaiver: hasApprovedVarianceWaiver);
        var lifecycle = ServiceRunLifecycle.Evaluate(input);
        var isConfirmationPending = run.ServiceConfirmedAt is null && run.ServiceConfirmationWaivedAt is null;
        var canSetConfirmationOutcome = run.ClosedAt is null && isConfirmationPending && CanConfirmOrWaive(lifecycle.Blockers);

        var status = run.StartedAt is not null && lifecycle.Status == ServiceRunStatus.ReadyToProduce
            ? ServiceRunStatus.InService
            : lifecycle.Status;
        return new ServiceRunLifecycleProjectionDto
        {
            ServiceRunId = GuidHelper.ToGuidString(run.ServiceRunId), PlanId = GuidHelper.ToGuidString(plan.PlanId), PlanCode = plan.PlanCode, ServiceDate = plan.PlanDate,
            ShiftName = run.ShiftName, Status = status, Blockers = lifecycle.Blockers,
            CanStartService = lifecycle.CanStartService && run.StartedAt is null,
            CanRecordActualServings = run.ClosedAt is null && (run.StartedAt is not null || lifecycle.CanStartService),
            CanConfirmService = canSetConfirmationOutcome,
            CanWaiveServiceConfirmation = canSetConfirmationOutcome && run.ServiceConfirmationPolicy == ServiceConfirmationPolicy.Waivable,
            CanResolveVariance = run.ClosedAt is null && lifecycle.Blockers.Contains(ServiceRunBlocker.UnresolvedVariance) && !issues.SelectMany(issue => issue.Inventoryreturns).Any(item => item.ReceivedAt is null),
            CanResolveServingVariance = run.ClosedAt is null && lifecycle.Blockers.Contains(ServiceRunBlocker.UnresolvedServingVariance),
            CanClose = lifecycle.CanClose,
            ServiceConfirmationOutcome = run.ServiceConfirmedAt is not null ? ServiceConfirmationOutcome.Confirmed : run.ServiceConfirmationWaivedAt is not null ? ServiceConfirmationOutcome.Waived : ServiceConfirmationOutcome.Pending,
            PlannedServings = planLines.GroupBy(line => Convert.ToBase64String(line.QuantityPlanLineId)).Sum(group => group.Max(line => line.TotalServings)), ActualServings = run.ActualServings,
            MaterialRequestLineCount = demandLines.Count, IssueCount = issues.Count, UnreceivedIssueCount = issues.Count(issue => issue.ReceivedAt is null),
            OpenSupplementalCount = openSupplementalCount, UnreceivedReturnCount = issues.SelectMany(issue => issue.Inventoryreturns).Count(item => item.ReceivedAt is null), HasBomBlocker = hasBomBlocker,
            AdjustmentCount = adjustmentCount,
        };
    }

    public async Task<ServiceRunLifecycleProjectionDto?> GetByPlanAsync(ServiceRunByPlanQuery query, CancellationToken cancellationToken = default)
    {
        var planId = GuidHelper.ParseGuidString(query.PlanId) ?? throw new ArgumentException("Kế hoạch sản xuất không hợp lệ.");
        var shiftName = NormalizeShift(query.ShiftName);
        var run = await context.Serviceruns.AsNoTracking()
            .FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(planId) && item.ShiftName == shiftName, cancellationToken);
        return run is null ? null : await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken);
    }

    public async Task<PagedResponseDto<ServiceRunOperationalRowDto>> GetPageAsync(ServiceRunPageQuery query, CancellationToken cancellationToken = default)
    {
        var runs = context.Serviceruns.AsNoTracking().Include(item => item.Plan).AsQueryable();
        if (query.ServiceDate is not null) runs = runs.Where(item => item.Plan.PlanDate == query.ServiceDate);
        if (!string.IsNullOrWhiteSpace(query.ShiftName)) runs = runs.Where(item => item.ShiftName == NormalizeShift(query.ShiftName));
        var hasStatusFilter = !string.IsNullOrWhiteSpace(query.Status);
        var orderedRuns = runs.OrderByDescending(item => item.UpdatedAt).ThenBy(item => item.ServiceRunId);
        var totalCount = hasStatusFilter ? 0 : await orderedRuns.CountAsync(cancellationToken);
        var candidateRuns = hasStatusFilter
            ? await orderedRuns.ToListAsync(cancellationToken)
            : await orderedRuns.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        var rows = new List<ServiceRunOperationalRowDto>(candidateRuns.Count);
        foreach (var run in candidateRuns)
        {
            var lifecycle = await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken) ?? throw new InvalidOperationException();
            var issues = await context.Inventoryissues.AsNoTracking().Include(item => item.Inventoryissuelines).Include(item => item.Inventoryreturns)
                .Where(item => item.MaterialRequest.PlanId.SequenceEqual(run.PlanId) && item.IssueDate == lifecycle.ServiceDate && item.ShiftName == run.ShiftName).ToListAsync(cancellationToken);
            var materialRequestLines = await context.Materialrequestlines.AsNoTracking().Include(item => item.Request).Include(item => item.PlanLine)
                .Where(item => item.Request.PlanId.SequenceEqual(run.PlanId) && item.PlanLine.ShiftName == run.ShiftName).ToListAsync(cancellationToken);
            var materialRequestCodes = materialRequestLines.Select(item => item.Request.RequestCode).Distinct().ToList();
            var purchaseCosts = await (
                from purchaseLine in context.Purchaserequestlines.AsNoTracking()
                join materialRequestLine in context.Materialrequestlines.AsNoTracking() on purchaseLine.MaterialRequestLineId equals materialRequestLine.RequestLineId
                join materialRequest in context.Materialrequests.AsNoTracking() on materialRequestLine.RequestId equals materialRequest.RequestId
                join planLine in context.Productionplanlines.AsNoTracking() on materialRequestLine.PlanLineId equals planLine.PlanLineId
                where materialRequest.PlanId.SequenceEqual(run.PlanId) && planLine.ShiftName == run.ShiftName
                select new { purchaseLine.PurchaseRequestLineId, EstimatedCost = purchaseLine.EstimatedUnitPrice * purchaseLine.PurchaseQty })
                .ToListAsync(cancellationToken);
            var actualReceivedCosts = await (
                from receiptLine in context.Inventoryreceiptlines.AsNoTracking()
                join purchaseCost in (
                    from purchaseLine in context.Purchaserequestlines.AsNoTracking()
                    join materialRequestLine in context.Materialrequestlines.AsNoTracking() on purchaseLine.MaterialRequestLineId equals materialRequestLine.RequestLineId
                    join materialRequest in context.Materialrequests.AsNoTracking() on materialRequestLine.RequestId equals materialRequest.RequestId
                    join planLine in context.Productionplanlines.AsNoTracking() on materialRequestLine.PlanLineId equals planLine.PlanLineId
                    where materialRequest.PlanId.SequenceEqual(run.PlanId) && planLine.ShiftName == run.ShiftName
                    select purchaseLine.PurchaseRequestLineId)
                    on receiptLine.PurchaseRequestLineId equals purchaseCost
                select receiptLine.Amount ?? receiptLine.Quantity * receiptLine.UnitPrice)
                .ToListAsync(cancellationToken);
            var supplementalCodes = await context.Supplementalmaterialrequests.AsNoTracking()
                .Join(context.Inventoryissues.AsNoTracking(), request => request.IssueId, issue => issue.IssueId, (request, issue) => new { request, issue })
                .Where(item => item.issue.MaterialRequest.PlanId.SequenceEqual(run.PlanId) && item.issue.IssueDate == lifecycle.ServiceDate && item.issue.ShiftName == run.ShiftName)
                .Select(item => item.request.RequestCode).Distinct().ToListAsync(cancellationToken);
            var operationalRow = new ServiceRunOperationalRowDto
            {
                Lifecycle = lifecycle, MaterialRequestCodes = materialRequestCodes, IssueCodes = issues.Select(item => item.IssueCode).ToList(),
                ReturnCodes = issues.SelectMany(item => item.Inventoryreturns).Select(item => item.ReturnCode).Distinct().ToList(), SupplementalRequestCodes = supplementalCodes,
                MaterialRequestLineIds = materialRequestLines.Select(item => GuidHelper.ToGuidString(item.RequestLineId)).ToList(),
                IssueLineIds = issues.SelectMany(item => item.Inventoryissuelines).Select(item => GuidHelper.ToGuidString(item.IssueLineId)).ToList(),
                EstimatedPurchaseCost = purchaseCosts.Sum(item => item.EstimatedCost),
                ActualReceivedCost = actualReceivedCosts.Count == 0 ? null : actualReceivedCosts.Sum(),
            };
            rows.Add(run.ClosedAt is not null && TryReadCloseSnapshot(run.CloseSnapshotJson, out var snapshotRow)
                ? ToClosedSnapshot(snapshotRow)
                : operationalRow);
        }
        if (hasStatusFilter)
        {
            rows = rows.Where(row => row.Lifecycle.Status == query.Status!.Trim().ToUpperInvariant()).ToList();
            totalCount = rows.Count;
            rows = rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToList();
        }
        return PagedResponseDto<ServiceRunOperationalRowDto>.Create(rows, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> StartAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        if (run.StartedAt is not null) return await GetProjectionAsync(serviceRunId, cancellationToken);
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        if (!projection.CanStartService) throw new InvalidOperationException("Ca chưa đủ điều kiện để bắt đầu phục vụ.");
        var now = DateTime.UtcNow;
        run.StartedAt = now;
        run.StartedBy = actorId;
        await SaveTransitionAsync(run, actorId, "Start", null, ServiceRunStatus.InService, "Bếp bắt đầu thực thi Ca phục vụ.", cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> RecordActualServingsAsync(string serviceRunId, RecordActualServingsRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        if (request.ActualServings < 0) throw new ArgumentException("Số suất thực tế phải lớn hơn hoặc bằng 0.");
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        if (run.StartedAt is null && !projection.CanStartService) throw new InvalidOperationException("Ca chưa đủ điều kiện để ghi nhận phục vụ thực tế.");
        var reason = NormalizeOptionalReason(request.Reason);
        if (request.ActualServings != projection.PlannedServings && reason is null)
            throw new ArgumentException("Cần nêu lý do khi số suất thực tế chênh lệch kế hoạch.");
        var outcomeChanged = run.ServiceConfirmedAt is not null || run.ServiceConfirmationWaivedAt is not null;
        if (outcomeChanged && run.ActualServings == request.ActualServings) return projection;
        if (outcomeChanged && reason is null)
            throw new ArgumentException("Cần nêu lý do khi sửa số suất sau xác nhận giao suất.");
        var oldValue = run.ActualServings?.ToString();
        var now = DateTime.UtcNow;
        if (outcomeChanged)
        {
            var outcome = run.ServiceConfirmedAt is not null ? ServiceConfirmationOutcome.Confirmed : ServiceConfirmationOutcome.Waived;
            run.ServiceConfirmedAt = null; run.ServiceConfirmedBy = null;
            run.ServiceConfirmationWaivedAt = null; run.ServiceConfirmationWaivedBy = null; run.ServiceConfirmationWaiverReason = null;
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRun), EntityId = run.ServiceRunId, FieldName = "ServiceConfirmationInvalidated", OldValue = outcome, NewValue = ServiceConfirmationOutcome.Pending, Reason = reason! });
        }
        if (run.ServingVarianceResolvedAt is not null)
        {
            run.ServingVarianceResolvedAt = null; run.ServingVarianceResolvedBy = null; run.ServingVarianceResolutionReason = null;
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRun), EntityId = run.ServiceRunId, FieldName = "ServingVarianceDecisionInvalidated", OldValue = "RESOLVED", NewValue = "PENDING", Reason = reason ?? "Số suất thực tế thay đổi." });
        }
        run.ActualServings = request.ActualServings;
        run.ActualServingsReason = reason;
        run.ActualServingsRecordedAt = now;
        run.ActualServingsRecordedBy = actorId;
        await SaveTransitionAsync(run, actorId, "ActualServings", oldValue, request.ActualServings.ToString(), reason ?? "Số suất thực tế khớp kế hoạch.", cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> ConfirmServiceAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        if (run.ServiceConfirmedAt is not null) return await GetProjectionAsync(serviceRunId, cancellationToken);
        if (run.ServiceConfirmationWaivedAt is not null) throw new InvalidOperationException("Ca đã được miễn xác nhận; không thể xác nhận đồng thời.");
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        EnsureReadyForConfirmation(projection);
        var now = DateTime.UtcNow;
        run.ServiceConfirmedAt = now;
        run.ServiceConfirmedBy = actorId;
        await SaveTransitionAsync(run, actorId, "ServiceConfirmed", null, now.ToString("O"), "Xác nhận đã phục vụ/giao suất theo chính sách ca.", cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> WaiveServiceConfirmationAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var reason = RequireReason(request.Reason, "Cần nêu lý do miễn xác nhận giao suất.");
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        if (run.ServiceConfirmationWaivedAt is not null) return await GetProjectionAsync(serviceRunId, cancellationToken);
        if (run.ServiceConfirmedAt is not null) throw new InvalidOperationException("Ca đã được xác nhận; không thể miễn xác nhận đồng thời.");
        if (run.ServiceConfirmationPolicy != ServiceConfirmationPolicy.Waivable) throw new InvalidOperationException("Chính sách Ca phục vụ yêu cầu xác nhận giao suất.");
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        EnsureReadyForConfirmation(projection);
        var now = DateTime.UtcNow;
        run.ServiceConfirmationWaivedAt = now;
        run.ServiceConfirmationWaivedBy = actorId;
        run.ServiceConfirmationWaiverReason = reason;
        await SaveTransitionAsync(run, actorId, "ServiceConfirmationWaived", null, now.ToString("O"), reason, cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> ResolveVarianceAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var reason = RequireReason(request.Reason, "Cần nêu quyết định xử lý chênh lệch.");
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        if (projection.UnreceivedReturnCount > 0) throw new InvalidOperationException("Kho phải xác nhận nhận lại phiếu trả trước khi quyết toán chênh lệch.");
        var now = DateTime.UtcNow;
        run.VarianceResolvedAt = now;
        run.VarianceResolvedBy = actorId;
        run.VarianceResolutionReason = reason;
        await SaveTransitionAsync(run, actorId, "VarianceResolved", null, now.ToString("O"), reason, cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> ResolveServingVarianceAsync(string serviceRunId, ReasonRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var reason = RequireReason(request.Reason, "Cần nêu quyết định xử lý chênh lệch suất phục vụ.");
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        if (!projection.Blockers.Contains(ServiceRunBlocker.UnresolvedServingVariance))
            throw new InvalidOperationException("Ca không có chênh lệch suất phục vụ cần quyết định.");
        var now = DateTime.UtcNow;
        run.ServingVarianceResolvedAt = now;
        run.ServingVarianceResolvedBy = actorId;
        run.ServingVarianceResolutionReason = reason;
        await SaveTransitionAsync(run, actorId, "ServingVarianceResolved", null, now.ToString("O"), reason, cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> DeclareVarianceAsync(string serviceRunId, DeclareServiceRunVarianceRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        var reason = RequireReason(request.Reason, "Cần nêu lý do khai báo ngoại lệ.");
        var track = request.Track?.Trim().ToUpperInvariant();
        if (track is not ("PLANNING" or "MATERIAL_SUPPLY" or "SERVICE_EXECUTION" or "RECONCILIATION")) throw new ArgumentException("Track ngoại lệ không hợp lệ.");
        var sourceLines = request.SourceLineIds.Where(id => GuidHelper.ParseGuidString(id) is not null).Distinct(StringComparer.Ordinal).ToArray();
        if (sourceLines.Length == 0) throw new ArgumentException("Cần chỉ rõ ít nhất một source-line chứng cứ.");
        var now = DateTime.UtcNow;
        var declaration = new ServiceRunVarianceDeclaration { ServiceRunVarianceDeclarationId = GuidHelper.NewId(), ServiceRunId = run.ServiceRunId, Track = track, SourceLineEvidenceJson = JsonSerializer.Serialize(sourceLines), Reason = reason, DeclaredBy = actorId, DeclaredAt = now };
        context.Servicerunvariancedeclarations.Add(declaration);
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRunVarianceDeclaration), EntityId = declaration.ServiceRunVarianceDeclarationId, FieldName = "Declared", NewValue = track, Reason = reason });
        await context.SaveChangesAsync(cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> ApproveVarianceWaiverAsync(string serviceRunId, string declarationId, ApproveServiceRunVarianceWaiverRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        EnsureOpen(run);
        var id = GuidHelper.ParseGuidString(declarationId) ?? throw new ArgumentException("Khai báo ngoại lệ không hợp lệ.");
        var declaration = await context.Servicerunvariancedeclarations.FirstOrDefaultAsync(item => item.ServiceRunVarianceDeclarationId.SequenceEqual(id) && item.ServiceRunId.SequenceEqual(run.ServiceRunId), cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy khai báo ngoại lệ.");
        if (declaration.DeclaredBy.SequenceEqual(actorId)) throw new InvalidOperationException("Người khai báo không được tự phê duyệt waiver.");
        if (await context.Servicerunvariancewaivers.AnyAsync(item => item.ServiceRunVarianceDeclarationId.SequenceEqual(id), cancellationToken)) return await GetProjectionAsync(serviceRunId, cancellationToken);
        var reason = RequireReason(request.Reason, "Cần nêu lý do phê duyệt waiver.");
        var now = DateTime.UtcNow;
        var waiver = new ServiceRunVarianceWaiver { ServiceRunVarianceWaiverId = GuidHelper.NewId(), ServiceRunVarianceDeclarationId = id, ApprovedBy = actorId, ApprovedAt = now, Reason = reason };
        context.Servicerunvariancewaivers.Add(waiver);
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRunVarianceWaiver), EntityId = waiver.ServiceRunVarianceWaiverId, FieldName = "Approved", NewValue = declaration.Track, Reason = reason });
        await context.SaveChangesAsync(cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> CloseAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        if (run.ClosedAt is not null) return await GetProjectionAsync(serviceRunId, cancellationToken);
        var projection = await GetProjectionAsync(serviceRunId, cancellationToken) ?? throw new InvalidOperationException();
        if (!projection.CanClose) throw new InvalidOperationException("Ca chưa đủ điều kiện đóng. Hãy xử lý toàn bộ blocker trước.");
        var snapshotRows = await GetPageAsync(new ServiceRunPageQuery { ServiceDate = projection.ServiceDate, ShiftName = run.ShiftName, PageSize = 100 }, cancellationToken);
        var snapshotRow = snapshotRows.Items.Single(item => item.Lifecycle.ServiceRunId == serviceRunId);
        snapshotRow.IsCloseSnapshot = true;
        snapshotRow.Lifecycle.Status = ServiceRunStatus.Closed;
        snapshotRow.Lifecycle.Blockers = [];
        snapshotRow.Lifecycle.CanStartService = false;
        snapshotRow.Lifecycle.CanRecordActualServings = false;
        snapshotRow.Lifecycle.CanConfirmService = false;
        snapshotRow.Lifecycle.CanWaiveServiceConfirmation = false;
        snapshotRow.Lifecycle.CanResolveVariance = false;
        snapshotRow.Lifecycle.CanResolveServingVariance = false;
        snapshotRow.Lifecycle.CanClose = false;
        var now = DateTime.UtcNow;
        run.ClosedAt = now;
        run.ClosedBy = actorId;
        run.CloseSnapshotJson = JsonSerializer.Serialize(new ServiceRunCloseSnapshotDto { OperationalRow = snapshotRow });
        await SaveTransitionAsync(run, actorId, "Close", null, ServiceRunStatus.Closed, "Đóng Ca phục vụ và khóa snapshot đối soát.", cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunAdjustmentDto?> CreateAdjustmentAsync(string serviceRunId, CreateServiceRunAdjustmentRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        if (request.CorrectedActualServings < 0) throw new ArgumentException("Số suất điều chỉnh phải lớn hơn hoặc bằng 0.");
        var actorId = ParseActor(userId);
        var reason = RequireReason(request.Reason, "Cần nêu lý do điều chỉnh sau đóng ca.");
        var run = await LoadTrackedAsync(serviceRunId, cancellationToken);
        if (run is null) return null;
        if (run.ClosedAt is null)
            throw new InvalidOperationException("Chỉ tạo điều chỉnh sau khi Ca phục vụ đã đóng.");

        var now = DateTime.UtcNow;
        var adjustment = new ServiceRunAdjustment
        {
            ServiceRunAdjustmentId = GuidHelper.NewId(), ServiceRunId = run.ServiceRunId,
            CorrectedActualServings = request.CorrectedActualServings, Reason = reason,
            CreatedBy = actorId, CreatedAt = now,
        };
        context.Servicerunadjustments.Add(adjustment);
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRunAdjustment), EntityId = adjustment.ServiceRunAdjustmentId,
            FieldName = "ActualServingsCorrection", OldValue = run.ActualServings?.ToString(), NewValue = request.CorrectedActualServings.ToString(),
            Reason = reason,
        });
        await context.SaveChangesAsync(cancellationToken);
        return ToAdjustmentDto(adjustment);
    }

    public async Task<IReadOnlyList<ServiceRunAdjustmentDto>> GetAdjustmentsAsync(string serviceRunId, CancellationToken cancellationToken = default)
    {
        var runId = GuidHelper.ParseGuidString(serviceRunId) ?? throw new ArgumentException("Ca phục vụ không hợp lệ.");
        var adjustments = await context.Servicerunadjustments.AsNoTracking()
            .Where(item => item.ServiceRunId.SequenceEqual(runId)).OrderByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);
        return adjustments.Select(ToAdjustmentDto).ToList();
    }

    private async Task<ServiceRun?> LoadTrackedAsync(string serviceRunId, CancellationToken cancellationToken)
    {
        var runId = GuidHelper.ParseGuidString(serviceRunId) ?? throw new ArgumentException("Ca phục vụ không hợp lệ.");
        return await context.Serviceruns.FirstOrDefaultAsync(item => item.ServiceRunId.SequenceEqual(runId), cancellationToken);
    }

    private async Task SaveTransitionAsync(ServiceRun run, byte[] actorId, string fieldName, string? oldValue, string? newValue, string reason, CancellationToken cancellationToken)
    {
        run.UpdatedAt = DateTime.UtcNow;
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = run.UpdatedAt, ChangedBy = actorId, BusinessArea = "ServiceRun", EntityName = nameof(ServiceRun), EntityId = run.ServiceRunId,
            FieldName = fieldName, OldValue = oldValue, NewValue = newValue, Reason = reason,
        });
        await context.SaveChangesAsync(cancellationToken);
    }

    private static void EnsureOpen(ServiceRun run)
    {
        if (run.ClosedAt is not null) throw new InvalidOperationException("Ca đã đóng; hãy dùng luồng điều chỉnh có audit.");
    }

    private static void EnsureReadyForConfirmation(ServiceRunLifecycleProjectionDto projection)
    {
        var unresolved = projection.Blockers.Where(blocker => blocker != ServiceRunBlocker.ServiceConfirmationRequired).ToList();
        if (unresolved.Count > 0) throw new InvalidOperationException("Ca còn blocker nghiệp vụ nên chưa thể xác nhận phục vụ.");
    }

    private static byte[] ParseActor(string? userId) => GuidHelper.ParseGuidString(userId) ?? throw new UnauthorizedAccessException("Không xác định được người thao tác.");
    private static string RequireReason(string? reason, string message) => NormalizeOptionalReason(reason) ?? throw new ArgumentException(message);
    private static string? NormalizeOptionalReason(string? reason) => string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    private static bool CanConfirmOrWaive(IReadOnlyList<string> blockers)
        => blockers.Count == 1 && blockers[0] == ServiceRunBlocker.ServiceConfirmationRequired;

    private static bool TryReadCloseSnapshot(string? json, out ServiceRunOperationalRowDto row)
    {
        row = new ServiceRunOperationalRowDto();
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            var snapshot = JsonSerializer.Deserialize<ServiceRunCloseSnapshotDto>(json);
            if (snapshot is null || snapshot.Version < 2 || string.IsNullOrWhiteSpace(snapshot.OperationalRow.Lifecycle.ServiceRunId)) return false;
            row = snapshot.OperationalRow;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static ServiceRunOperationalRowDto ToClosedSnapshot(ServiceRunOperationalRowDto row)
    {
        row.IsCloseSnapshot = true;
        row.Lifecycle.Status = ServiceRunStatus.Closed;
        row.Lifecycle.Blockers = [];
        row.Lifecycle.CanStartService = false;
        row.Lifecycle.CanRecordActualServings = false;
        row.Lifecycle.CanConfirmService = false;
        row.Lifecycle.CanWaiveServiceConfirmation = false;
        row.Lifecycle.CanResolveVariance = false;
        row.Lifecycle.CanResolveServingVariance = false;
        row.Lifecycle.CanClose = false;
        return row;
    }

    private async Task<bool> HasBomBlockerAsync(DateOnly serviceDate, IReadOnlyCollection<ProductionPlanLine> planLines, CancellationToken cancellationToken)
    {
        if (planLines.Count == 0) return false;
        var dishIds = planLines.Select(line => line.DishId).ToList();
        var boms = await context.Dishboms.AsNoTracking().Where(bom => dishIds.Contains(bom.DishId) && bom.BomStatus == "PUBLISHED" && bom.EffectiveFrom <= serviceDate && (bom.EffectiveTo == null || bom.EffectiveTo >= serviceDate)).ToListAsync(cancellationToken);
        return planLines.Any(line => !boms.Any(bom => bom.DishId.SequenceEqual(line.DishId) && bom.PriceTierAmount == line.QuantityPlanLine.MenuSchedule.MenuPrice && (bom.CustomerId is null || bom.CustomerId.SequenceEqual(line.CustomerId))));
    }

    private static string NormalizeShift(string? shiftName) => (shiftName ?? string.Empty).Trim().ToUpperInvariant() switch
    {
        "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
        "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
        _ => throw new ArgumentException("Ca phục vụ không hợp lệ."),
    };

    private static string ItemKey(byte[] ingredientId, byte[] unitId) => $"{Convert.ToBase64String(ingredientId)}:{Convert.ToBase64String(unitId)}";
    private static ServiceRunAdjustmentDto ToAdjustmentDto(ServiceRunAdjustment item) => new()
    {
        ServiceRunAdjustmentId = GuidHelper.ToGuidString(item.ServiceRunAdjustmentId), ServiceRunId = GuidHelper.ToGuidString(item.ServiceRunId),
        CorrectedActualServings = item.CorrectedActualServings, Reason = item.Reason, CreatedAt = item.CreatedAt,
    };
}
