using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using static IPCManagement.Api.Features.Planning.Services.ServiceRunRules;
namespace IPCManagement.Api.Features.Planning.Services;
public sealed partial class ServiceRunService(IpcManagementContext context) : IServiceRunService
{
    internal static IQueryable<MaterialRequestLine> SelectRequestSourceLines(IQueryable<MaterialRequestLine> sourceLines, byte[] requestId)
        => ServiceRunSourceSelection.SelectRequestSourceLines(sourceLines, requestId);
    internal static IQueryable<MaterialRequestLine> SelectPlanSourceLines(IQueryable<MaterialRequestLine> sourceLines, IQueryable<MaterialRequest> requests, byte[] planId)
        => sourceLines.Where(line => requests.Any(request => request.PlanId.SequenceEqual(planId) && request.RequestId.SequenceEqual(line.RequestId)));
    internal static IReadOnlyList<InventoryIssueLine> SelectRelevantIssueLines(IEnumerable<InventoryIssue> issues, IEnumerable<MaterialRequestLine> demandLines, string shiftName)
        => ServiceRunSourceSelection.SelectRelevantIssueLines(issues, demandLines);
    internal static List<MaterialRequestLine> SelectScopedDemandLines(IEnumerable<MaterialRequestLine> demandLines, IEnumerable<byte[]> sourceLineIds)
    {
        var ids = sourceLineIds.ToList();
        return demandLines.Where(line => ids.Any(id => id.SequenceEqual(line.RequestLineId))).ToList();
    }
    public async Task<ServiceRunLifecycleProjectionDto?> OpenAsync(OpenServiceRunRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var planId = GuidHelper.ParseGuidString(request.PlanId) ?? throw new ArgumentException("Kế hoạch sản xuất không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(userId) ?? throw new UnauthorizedAccessException("Không xác định được người mở ca phục vụ.");
        var shiftName = NormalizeShift(request.ShiftName);
        var plan = await context.Productionplans.Include(item => item.Productionplanlines)
            .FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(planId), cancellationToken)
            ?? throw new ArgumentException("Không tìm thấy kế hoạch sản xuất.");
        if (plan.SentToKitchenAt is null)
            throw new BusinessRuleException("Kế hoạch sản xuất chưa gửi Bếp nên chưa thể mở Ca phục vụ.");
        var requestedCustomerId = GuidHelper.ParseGuidString(request.CustomerId)
            ?? throw new ArgumentException("Phải chọn khách hàng cho Ca phục vụ.");
        if (!plan.Productionplanlines.Any(line => line.ShiftName == shiftName && line.CustomerId.SequenceEqual(requestedCustomerId)))
            throw new ArgumentException("Kế hoạch sản xuất không có ca phục vụ của khách hàng đã chọn.");
        var planSourceLines = await SelectPlanSourceLines(context.Materialrequestlines, context.Materialrequests, planId)
            .ToListAsync(cancellationToken);
        var scopedPlanLineIds = plan.Productionplanlines
            .Where(line => line.CustomerId.SequenceEqual(requestedCustomerId) && line.ShiftName == shiftName)
            .Select(line => line.PlanLineId)
            .ToList();
        var sourceLines = planSourceLines
            .Where(line => scopedPlanLineIds.Any(planLineId => planLineId.SequenceEqual(line.PlanLineId)))
            .ToList();
        var tiers = sourceLines.Select(item => item.PriceTierAmount).Distinct().ToList();
        var priceTier = request.PriceTierAmount ?? (tiers.Count == 1 ? tiers[0] : throw await CreateScopeDecisionAsync(plan, requestedCustomerId, shiftName, null, "Không thể suy ra duy nhất tier giá từ source-line.", cancellationToken));
        var scopedSourceLines = sourceLines.Where(item => item.PriceTierAmount == priceTier).ToList();
        if (scopedSourceLines.Count == 0)
            throw await CreateScopeDecisionAsync(plan, requestedCustomerId, shiftName, priceTier, "Không có source-line material khớp customer/date/shift/tier.", cancellationToken);
        var run = await context.Serviceruns.FirstOrDefaultAsync(item =>
            item.CustomerId != null && item.CustomerId.SequenceEqual(requestedCustomerId) && item.ServiceDate == plan.PlanDate && item.ShiftName == shiftName && item.PriceTierAmount == priceTier,
            cancellationToken);
        if (run is null)
        {
            var now = DateTime.UtcNow;
            run = new ServiceRun
            {
                ServiceRunId = GuidHelper.NewId(), PlanId = planId, CustomerId = requestedCustomerId, ServiceDate = plan.PlanDate,
                ShiftName = shiftName, PriceTierAmount = priceTier, OpenedBy = actorId, CreatedAt = now, UpdatedAt = now,
            };
            context.Serviceruns.Add(run);
            context.Servicerunsourcelines.AddRange(scopedSourceLines.Select(line => new ServiceRunSourceLine
            {
                ServiceRunSourceLineId = GuidHelper.NewId(), ServiceRunId = run.ServiceRunId, MaterialRequestLineId = line.RequestLineId, RecordedAt = now,
            }));
            StageLifecycle(run, actorId, "Open", null, ServiceRunStatus.Planned, "Mở hồ sơ thực thi Ca phục vụ từ source-line canonical.");
            await context.SaveChangesAsync(cancellationToken);
        }
        return await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken);
    }
    private async Task<BusinessRuleException> CreateScopeDecisionAsync(ProductionPlan plan, byte[] customerId, string shiftName, decimal? priceTierAmount, string reason, CancellationToken cancellationToken)
    {
        var existing = await context.Servicerundecisionitems.FirstOrDefaultAsync(item =>
            item.PlanId.SequenceEqual(plan.PlanId) && item.CustomerId != null && item.CustomerId.SequenceEqual(customerId) && item.ShiftName == shiftName &&
            item.PriceTierAmount == priceTierAmount && item.Reason == reason, cancellationToken);
        if (existing is null)
        {
            context.Servicerundecisionitems.Add(new ServiceRunDecisionItem
            {
                ServiceRunDecisionItemId = GuidHelper.NewId(), PlanId = plan.PlanId, CustomerId = customerId, ServiceDate = plan.PlanDate,
                ShiftName = shiftName, PriceTierAmount = priceTierAmount, Reason = reason, CreatedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync(cancellationToken);
        }
        return new BusinessRuleException(reason);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> GetProjectionAsync(string serviceRunId, CancellationToken cancellationToken = default)
    {
        var runId = GuidHelper.ParseGuidString(serviceRunId);
        if (runId is null) return null;
        var run = await context.Serviceruns.AsNoTracking()
            .FirstOrDefaultAsync(item => item.ServiceRunId.SequenceEqual(runId), cancellationToken);
        if (run is null) return null;
        var plan = await context.Productionplans.AsNoTracking()
            .FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(run.PlanId), cancellationToken);
        if (plan is null) return null;
        run.Plan = plan;
        var data = await LoadProjectionDataAsync([run], includeProjectionFields: true, includeOperationalFields: false, cancellationToken);
        return BuildProjection(run, plan, data).Lifecycle;
    }

    public async Task<ServiceRunLifecycleProjectionDto?> GetByPlanAsync(ServiceRunByPlanQuery query, CancellationToken cancellationToken = default)
    {
        var planId = GuidHelper.ParseGuidString(query.PlanId) ?? throw new ArgumentException("Kế hoạch sản xuất không hợp lệ.");
        var shiftName = NormalizeShift(query.ShiftName);
        var run = await context.Serviceruns.AsNoTracking()
            .FirstOrDefaultAsync(item => item.PlanId.SequenceEqual(planId) && item.ShiftName == shiftName, cancellationToken);
        return run is null ? null : await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> GetByScopeAsync(ServiceRunScopeQuery query, CancellationToken cancellationToken = default)
    {
        if (query.AllCustomers) throw new ArgumentException("Phạm vi All customers chỉ dùng cho danh sách chỉ đọc.");
        var customerId = GuidHelper.ParseGuidString(query.CustomerId) ?? throw new ArgumentException("Phải chọn khách hàng cho Ca phục vụ.");
        if (query.ServiceDate is null || query.PriceTierAmount is null) throw new ArgumentException("Phải chọn ngày phục vụ và tier giá.");
        var shiftName = NormalizeShift(query.ShiftName);
        var run = await context.Serviceruns.AsNoTracking().SingleOrDefaultAsync(item =>
            item.CustomerId != null && item.CustomerId.SequenceEqual(customerId) && item.ServiceDate == query.ServiceDate &&
            item.ShiftName == shiftName && item.PriceTierAmount == query.PriceTierAmount, cancellationToken);
        return run is null ? null : await GetProjectionAsync(GuidHelper.ToGuidString(run.ServiceRunId), cancellationToken);
    }

    public async Task<PagedResponseDto<ServiceRunOperationalRowDto>> GetPageAsync(ServiceRunPageQuery query, CancellationToken cancellationToken = default)
    {
        var runs = context.Serviceruns.AsNoTracking().Include(item => item.Plan).AsQueryable();
        if (!query.AllCustomers && !string.IsNullOrWhiteSpace(query.CustomerId))
        {
            var customerId = GuidHelper.ParseGuidString(query.CustomerId) ?? throw new ArgumentException("Khách hàng không hợp lệ.");
            runs = runs.Where(item => item.CustomerId != null && item.CustomerId.SequenceEqual(customerId));
        }
        if (query.ServiceDate is not null) runs = runs.Where(item => item.Plan.PlanDate == query.ServiceDate);
        if (!string.IsNullOrWhiteSpace(query.ShiftName)) runs = runs.Where(item => item.ShiftName == NormalizeShift(query.ShiftName));
        if (query.PriceTierAmount is not null) runs = runs.Where(item => item.PriceTierAmount == query.PriceTierAmount);
        var hasStatusFilter = !string.IsNullOrWhiteSpace(query.Status);
        var orderedRuns = runs.OrderByDescending(item => item.UpdatedAt).ThenBy(item => item.ServiceRunId);
        var totalCount = hasStatusFilter ? 0 : await orderedRuns.CountAsync(cancellationToken);
        List<ServiceRun> pageRuns;
        if (hasStatusFilter)
        {
            var candidateRuns = await orderedRuns.ToListAsync(cancellationToken);
            if (candidateRuns.Count == 0)
                return PagedResponseDto<ServiceRunOperationalRowDto>.Create([], 0, query.PageNumber, query.PageSize);
            var statusData = await LoadProjectionDataAsync(candidateRuns, includeProjectionFields: false, includeOperationalFields: false, cancellationToken);
            var requestedStatus = query.Status!.Trim().ToUpperInvariant();
            var matchingRunIds = candidateRuns
                .Where(run => MapLifecycleStatus(run, run.Plan, statusData).Status == requestedStatus)
                .Select(run => run.ServiceRunId)
                .ToList();
            totalCount = matchingRunIds.Count;
            var pageRunIds = matchingRunIds.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToList();
            pageRuns = candidateRuns.Where(run => pageRunIds.Any(id => id.SequenceEqual(run.ServiceRunId))).ToList();
        }
        else
        {
            pageRuns = await orderedRuns.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToListAsync(cancellationToken);
        }
        if (pageRuns.Count == 0)
            return PagedResponseDto<ServiceRunOperationalRowDto>.Create([], totalCount, query.PageNumber, query.PageSize);
        var data = await LoadProjectionDataAsync(pageRuns, includeProjectionFields: true, includeOperationalFields: true, cancellationToken);
        var rows = pageRuns.Select(run =>
        {
            var mapped = BuildProjection(run, run.Plan, data);
            var materialRequestIds = mapped.DemandLines.Select(item => item.RequestId).ToList();
            var operationalIssues = data.Issues.Where(issue => issue.IssueDate == mapped.Lifecycle.ServiceDate &&
                issue.ShiftName == run.ShiftName && issue.MaterialRequestId is not null &&
                materialRequestIds.Any(id => SameId(id, issue.MaterialRequestId))).ToList();
            var supplementalCodes = data.SupplementalRows
                .Where(item => operationalIssues.Any(issue => SameId(issue.IssueId, item.IssueId)))
                .Select(item => item.RequestCode).Distinct().ToList();
            var purchaseCosts = data.PurchaseCosts.Where(item => SameId(item.PlanId, run.PlanId) && item.ShiftName == run.ShiftName).ToList();
            var receivedCosts = data.ReceivedCosts.Where(item => SameId(item.PlanId, run.PlanId) && item.ShiftName == run.ShiftName).ToList();
            var operationalRow = new ServiceRunOperationalRowDto
            {
                Lifecycle = mapped.Lifecycle,
                MaterialRequestCodes = mapped.DemandLines.Select(item => item.Request.RequestCode).Distinct().ToList(),
                IssueCodes = operationalIssues.Select(item => item.IssueCode).ToList(),
                ReturnCodes = operationalIssues.SelectMany(item => item.Inventoryreturns).Select(item => item.ReturnCode).Distinct().ToList(),
                SupplementalRequestCodes = supplementalCodes,
                MaterialRequestLineIds = mapped.DemandLines.Select(item => GuidHelper.ToGuidString(item.RequestLineId)).ToList(),
                IssueLineIds = operationalIssues.SelectMany(item => item.Inventoryissuelines).Select(item => GuidHelper.ToGuidString(item.IssueLineId)).ToList(),
                EstimatedPurchaseCost = purchaseCosts.Sum(item => item.EstimatedCost),
                ActualReceivedCost = receivedCosts.Count == 0 ? null : receivedCosts.Sum(item => item.Cost),
            };
            return run.ClosedAt is not null && TryReadCloseSnapshot(run.CloseSnapshotJson, out var snapshotRow)
                ? ToClosedSnapshot(snapshotRow)
                : operationalRow;
        }).ToList();
        return PagedResponseDto<ServiceRunOperationalRowDto>.Create(rows, totalCount, query.PageNumber, query.PageSize);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> StartAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
        if (run is null) return null;
        var recorder = new LifecycleTransitionRecorder(context);
        var commandId = RequireCommandId(request.CommandId);
        if (await recorder.FindExistingCommandAsync(commandId, nameof(ServiceRun), run.ServiceRunId, cancellationToken) is not null)
            return await GetProjectionAsync(serviceRunId, cancellationToken);
        EnsureOpen(run);
        EnsureExpectedVersion(run, request.ExpectedVersion);
        var reason = RequireReason(request.Reason, "Cần nêu lý do khai báo ngoại lệ.");
        var track = request.Track?.Trim().ToUpperInvariant();
        if (track is not ("PLANNING" or "MATERIAL_SUPPLY" or "SERVICE_EXECUTION" or "RECONCILIATION")) throw new ArgumentException("Track ngoại lệ không hợp lệ.");
        var sourceLines = request.SourceLineIds.Where(id => GuidHelper.ParseGuidString(id) is not null).Distinct(StringComparer.Ordinal).ToArray();
        if (sourceLines.Length == 0) throw new ArgumentException("Cần chỉ rõ ít nhất một source-line chứng cứ.");
        var now = DateTime.UtcNow;
        var declaration = new ServiceRunVarianceDeclaration { ServiceRunVarianceDeclarationId = GuidHelper.NewId(), ServiceRunId = run.ServiceRunId, Track = track, SourceLineEvidenceJson = JsonSerializer.Serialize(sourceLines), Reason = reason, DeclaredBy = actorId, DeclaredAt = now };
        context.Servicerunvariancedeclarations.Add(declaration);
        StageCommand(run, recorder, actorId, commandId, "VarianceDeclared", request.ExpectedVersion, reason,
            request.CorrelationId, request.CausationId, new { declaration.ServiceRunVarianceDeclarationId, track, sourceLines });
        await context.SaveChangesAsync(cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> ApproveVarianceWaiverAsync(string serviceRunId, string declarationId, ApproveServiceRunVarianceWaiverRequest request, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
        if (run is null) return null;
        var recorder = new LifecycleTransitionRecorder(context);
        var commandId = RequireCommandId(request.CommandId);
        if (await recorder.FindExistingCommandAsync(commandId, nameof(ServiceRun), run.ServiceRunId, cancellationToken) is not null)
            return await GetProjectionAsync(serviceRunId, cancellationToken);
        EnsureOpen(run);
        EnsureExpectedVersion(run, request.ExpectedVersion);
        var id = GuidHelper.ParseGuidString(declarationId) ?? throw new ArgumentException("Khai báo ngoại lệ không hợp lệ.");
        var declaration = await context.Servicerunvariancedeclarations.FirstOrDefaultAsync(item => item.ServiceRunVarianceDeclarationId.SequenceEqual(id) && item.ServiceRunId.SequenceEqual(run.ServiceRunId), cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy khai báo ngoại lệ.");
        if (declaration.DeclaredBy.SequenceEqual(actorId)) throw new InvalidOperationException("Người khai báo không được tự phê duyệt waiver.");
        if (await context.Servicerunvariancewaivers.AnyAsync(item => item.ServiceRunVarianceDeclarationId.SequenceEqual(id), cancellationToken)) return await GetProjectionAsync(serviceRunId, cancellationToken);
        var reason = RequireReason(request.Reason, "Cần nêu lý do phê duyệt waiver.");
        var now = DateTime.UtcNow;
        var waiver = new ServiceRunVarianceWaiver { ServiceRunVarianceWaiverId = GuidHelper.NewId(), ServiceRunVarianceDeclarationId = id, ApprovedBy = actorId, ApprovedAt = now, Reason = reason };
        context.Servicerunvariancewaivers.Add(waiver);
        StageCommand(run, recorder, actorId, commandId, "VarianceWaiverApproved", request.ExpectedVersion, reason,
            request.CorrelationId, request.CausationId, new { waiver.ServiceRunVarianceWaiverId, declaration.ServiceRunVarianceDeclarationId, declaration.Track });
        await context.SaveChangesAsync(cancellationToken);
        return await GetProjectionAsync(serviceRunId, cancellationToken);
    }

    public async Task<ServiceRunLifecycleProjectionDto?> CloseAsync(string serviceRunId, string? userId, CancellationToken cancellationToken = default)
    {
        var actorId = ParseActor(userId);
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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
        var run = await LoadTrackedAsync(context, serviceRunId, cancellationToken);
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

    private async Task SaveTransitionAsync(ServiceRun run, byte[] actorId, string fieldName, string? oldValue, string? newValue, string reason, CancellationToken cancellationToken)
    {
        run.UpdatedAt = DateTime.UtcNow;
        StageLifecycle(run, actorId, fieldName, oldValue, newValue ?? fieldName, reason);
        await context.SaveChangesAsync(cancellationToken);
    }

    private void StageLifecycle(ServiceRun run, byte[] actorId, string commandName, string? fromState, string toState, string reason)
    {
        var sequence = checked((int)run.ConcurrencyVersion + 1);
        new LifecycleTransitionRecorder(context).Stage(new LifecycleTransitionRequest(
            nameof(ServiceRun), run.ServiceRunId, $"service-run:{Convert.ToBase64String(run.ServiceRunId)}:{sequence}:{commandName}", sequence,
            fromState, toState, actorId, run.ConcurrencyVersion, reason,
            $"service-run:{Convert.ToBase64String(run.ServiceRunId)}", null,
            JsonSerializer.Serialize(new { commandName, run.CustomerId, run.ServiceDate, run.ShiftName, run.PriceTierAmount }),
            JsonSerializer.Serialize(new { run.ServiceRunId, toState })));
        run.ConcurrencyVersion++;
    }

    private static void StageCommand(ServiceRun run, LifecycleTransitionRecorder recorder, byte[] actorId,
        string commandId, string commandName, long expectedVersion, string reason, string? correlationId,
        string? causationId, object evidence)
    {
        var sequence = checked((int)run.ConcurrencyVersion + 1);
        recorder.Stage(new LifecycleTransitionRequest(
            nameof(ServiceRun), run.ServiceRunId, commandId, sequence,
            run.Status, run.Status, actorId, expectedVersion, reason,
            correlationId, causationId,
            JsonSerializer.Serialize(new { commandName, evidence }),
            JsonSerializer.Serialize(new { run.ServiceRunId, commandName, version = sequence })));
        run.ConcurrencyVersion++;
        run.UpdatedAt = DateTime.UtcNow;
    }


}
