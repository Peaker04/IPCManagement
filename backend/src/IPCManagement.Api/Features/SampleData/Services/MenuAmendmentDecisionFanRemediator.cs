using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class MenuAmendmentDecisionFanRemediator(IpcManagementContext context)
{
    public async Task<MenuAmendmentDecisionRemediationDto> RemediateDecisionFanAsync(string reconciliationCaseId, RemediateMenuAmendmentDecisionFanRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var caseId = GuidHelper.ParseGuidString(reconciliationCaseId) ?? throw new ArgumentException("Mã hồ sơ đối soát không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người xử lý.");
        if (string.IsNullOrWhiteSpace(request.CommandId)) throw new ArgumentException("Cần mã lệnh để chống ghi trùng.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nêu lý do chuẩn hóa phạm vi.");

        var reconciliationCase = await context.Menuamendmentreconciliationcases
            .Include(item => item.MenuAmendment).ThenInclude(item => item.Lines)
            .Include(item => item.Remediations)
            .SingleOrDefaultAsync(item => item.MenuAmendmentReconciliationCaseId.SequenceEqual(caseId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ đối soát.");
        var replay = reconciliationCase.Remediations.SingleOrDefault(item => item.CommandId == request.CommandId);
        if (replay is not null)
        {
            return new MenuAmendmentDecisionRemediationDto
            {
                ReconciliationCaseId = reconciliationCaseId,
                RemediationId = GuidHelper.ToGuidString(replay.MenuAmendmentReconciliationRemediationId),
                PreservedDecisionCount = ReadImpact(reconciliationCase.ImpactSnapshotJson).DecisionScopes.Count,
                EffectiveDecisionCount = ReadImpact(replay.EffectiveImpactSnapshotJson).DecisionScopes.Count,
            };
        }
        if (reconciliationCase.Status != "OPEN") throw new BusinessRuleException("Hồ sơ không còn mở để chuẩn hóa phạm vi.");
        if (reconciliationCase.Remediations.Count > 0) throw new BusinessRuleException("Hồ sơ đã có bản chuẩn hóa phạm vi; không được ghi đè lịch sử.");

        var amendment = reconciliationCase.MenuAmendment;
        var sources = new List<MenuAmendmentService.DecisionScopeSource>();
        foreach (var amendmentLine in amendment.Lines)
        {
            var scopedLines = await context.Materialrequestlines
                .Include(item => item.Request)
                .Include(item => item.PlanLine).ThenInclude(item => item.Customer)
                .Where(item => item.Request.RequestDate == amendmentLine.ServiceDate &&
                    item.PlanLine.ShiftName == amendmentLine.ShiftName &&
                    item.PlanLine.CustomerId.SequenceEqual(amendment.CustomerId) &&
                    amendmentLine.OldDishId != null && item.PlanLine.DishId.SequenceEqual(amendmentLine.OldDishId) &&
                    item.Request.Status != "CANCELLED")
                .ToListAsync(cancellationToken);
            sources.AddRange(scopedLines.Select(item => new MenuAmendmentService.DecisionScopeSource(
                GuidHelper.ToGuidString(item.PlanLine.CustomerId), item.PlanLine.Customer.CustomerName,
                item.Request.RequestDate, item.PlanLine.ShiftName, item.PriceTierAmount,
                GuidHelper.ToGuidString(item.RequestLineId))));
        }
        if (sources.Count == 0) throw new BusinessRuleException("Không tìm thấy source-line đang hoạt động đúng ngày và ca cần chuẩn hóa.");

        var originalImpact = ReadImpact(reconciliationCase.ImpactSnapshotJson);
        var effectiveImpact = new MenuAmendmentResultDto
        {
            MenuAmendmentId = GuidHelper.ToGuidString(amendment.MenuAmendmentId), Status = amendment.Status,
            RequiresReconciliation = true, AffectedDemandCount = originalImpact.AffectedDemandCount,
            AffectedPurchaseRequestCount = originalImpact.AffectedPurchaseRequestCount,
            HasPurchaseOrder = originalImpact.HasPurchaseOrder, HasReceipt = originalImpact.HasReceipt, HasIssue = originalImpact.HasIssue,
            ReconciliationCaseId = reconciliationCaseId, AffectedDocumentIds = originalImpact.AffectedDocumentIds,
            AffectedSourceLineIds = sources.Select(item => item.SourceLineId).ToArray(),
            DecisionScopes = MenuAmendmentService.BuildDecisionScopes(sources, originalImpact.AffectedDocumentIds),
        };
        foreach (var scope in effectiveImpact.DecisionScopes)
        {
            var sourceKeys = scope.SourceLineIds.Select(GuidHelper.ParseGuidString).ToList();
            var candidateRuns = await context.Serviceruns
                .Include(run => run.SourceLines)
                .Where(run => run.CustomerId != null && run.CustomerId.SequenceEqual(amendment.CustomerId) &&
                    run.ServiceDate == scope.ServiceDate && run.ShiftName == scope.ShiftName &&
                    run.PriceTierAmount == scope.PriceTierAmount && run.ClosedAt != null)
                .ToListAsync(cancellationToken);
            var matchedRuns = candidateRuns.Where(run => sourceKeys.All(key => key is not null &&
                run.SourceLines.Any(source => source.MaterialRequestLineId.SequenceEqual(key)))).ToList();
            if (matchedRuns.Count != 1) throw new BusinessRuleException("Phạm vi chuẩn hóa chưa khớp duy nhất một Ca phục vụ đã đóng.");
            var planId = await context.Materialrequestlines.Where(item => item.RequestLineId.SequenceEqual(sourceKeys[0]!)).Select(item => item.Request.PlanId).SingleAsync(cancellationToken);
            var decision = new ServiceRunDecisionItem
            {
                ServiceRunDecisionItemId = GuidHelper.NewId(), PlanId = planId, CustomerId = amendment.CustomerId,
                ServiceDate = scope.ServiceDate, ShiftName = scope.ShiftName, PriceTierAmount = scope.PriceTierAmount,
                Reason = request.Reason.Trim(), CreatedAt = DateTime.UtcNow,
            };
            scope.DecisionItemId = GuidHelper.ToGuidString(decision.ServiceRunDecisionItemId);
            context.Servicerundecisionitems.Add(decision);
        }

        var remediation = new MenuAmendmentReconciliationRemediation
        {
            MenuAmendmentReconciliationRemediationId = GuidHelper.NewId(),
            MenuAmendmentReconciliationCaseId = reconciliationCase.MenuAmendmentReconciliationCaseId,
            CommandId = request.CommandId.Trim(), Reason = request.Reason.Trim(),
            EffectiveImpactSnapshotJson = JsonSerializer.Serialize(effectiveImpact),
            CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
        };
        context.Menuamendmentreconciliationremediations.Add(remediation);
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = remediation.CreatedAt, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendmentReconciliationRemediation), EntityId = remediation.MenuAmendmentReconciliationRemediationId, FieldName = "EffectiveDecisionScope", NewValue = effectiveImpact.DecisionScopes.Count.ToString(), Reason = remediation.Reason });
        await context.SaveChangesAsync(cancellationToken);
        return new MenuAmendmentDecisionRemediationDto { ReconciliationCaseId = reconciliationCaseId, RemediationId = GuidHelper.ToGuidString(remediation.MenuAmendmentReconciliationRemediationId), PreservedDecisionCount = originalImpact.DecisionScopes.Count, EffectiveDecisionCount = effectiveImpact.DecisionScopes.Count };
    }

    public async Task<MenuAmendmentDecisionItemDto> ExecuteDecisionAsync(string decisionItemId, MenuAmendmentDecisionCommandRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var decisionKey = GuidHelper.ParseGuidString(decisionItemId) ?? throw new ArgumentException("Mã quyết định không hợp lệ.");
        if (!string.Equals(decisionItemId, request.DecisionItemId, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Quyết định trên đường dẫn không khớp với nội dung lệnh.");
        if (!string.Equals(request.Action, "APPEND_CORRECTION", StringComparison.Ordinal))
            throw new BusinessRuleException("Thao tác quyết định không còn được phép.");
        if (string.IsNullOrWhiteSpace(request.CommandId)) throw new ArgumentException("Cần mã lệnh để chống ghi trùng.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nêu lý do điều chỉnh đối soát.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người điều chỉnh.");
        var decision = await context.Servicerundecisionitems.SingleOrDefaultAsync(item => item.ServiceRunDecisionItemId.SequenceEqual(decisionKey), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy quyết định hiện hành.");
        var reconciliationCase = (await context.Menuamendmentreconciliationcases
                .Include(item => item.MenuAmendment)
                .Include(item => item.Remediations)
                .Where(item => item.MenuAmendment.CustomerId.SequenceEqual(decision.CustomerId!))
                .ToListAsync(cancellationToken))
            .SingleOrDefault(item => ReadEffectiveImpact(item).DecisionScopes
                .Any(scope => string.Equals(scope.DecisionItemId, decisionItemId, StringComparison.OrdinalIgnoreCase)))
            ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ đối soát của quyết định.");
        var impact = ReadEffectiveImpact(reconciliationCase);
        var scope = impact.DecisionScopes.SingleOrDefault(item => string.Equals(item.DecisionItemId, decisionItemId, StringComparison.OrdinalIgnoreCase))
            ?? throw new BusinessRuleException("Hồ sơ đối soát thiếu phạm vi source-line chính xác.");
        if (decision.CustomerId is null || !decision.CustomerId.SequenceEqual(reconciliationCase.MenuAmendment.CustomerId) ||
            decision.ServiceDate != scope.ServiceDate || !string.Equals(decision.ShiftName, scope.ShiftName, StringComparison.OrdinalIgnoreCase) || decision.PriceTierAmount != scope.PriceTierAmount)
            throw new BusinessRuleException("Quyết định không còn thuộc đúng phạm vi đối soát.");
        var isDecisionCorrected = await context.Menuamendmentreconciliationcorrections.AnyAsync(item =>
            item.MenuAmendmentReconciliationCaseId.SequenceEqual(reconciliationCase.MenuAmendmentReconciliationCaseId) &&
            item.ServiceRunDecisionItemId != null && item.ServiceRunDecisionItemId.SequenceEqual(decision.ServiceRunDecisionItemId), cancellationToken);
        var currentVersion = isDecisionCorrected ? 1L : 0L;
        var recorder = new LifecycleTransitionRecorder(context);
        var existing = await recorder.FindExistingCommandAsync(request.CommandId, nameof(MenuAmendmentReconciliationCase), reconciliationCase.MenuAmendmentReconciliationCaseId, cancellationToken);
        if (existing is not null)
            return ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, isDecisionCorrected ? "RESOLVED" : "OPEN", currentVersion);
        if (currentVersion != request.ExpectedVersion)
            throw new BusinessRuleException("Dữ liệu quyết định đã thay đổi; hãy dùng trạng thái hiện hành rồi thử lại.");
        if (reconciliationCase.Status != "OPEN" || isDecisionCorrected)
            throw new BusinessRuleException("Quyết định không còn cho phép ghi correction.");

        var sourceLineKeys = scope.SourceLineIds.Select(GuidHelper.ParseGuidString).Where(id => id is not null).Select(id => id!).ToList();
        if (sourceLineKeys.Count != scope.SourceLineIds.Count)
            throw new BusinessRuleException("Bằng chứng source-line không hợp lệ.");
        var matchedRuns = await context.Serviceruns
            .Where(run => run.CustomerId != null && run.CustomerId.SequenceEqual(reconciliationCase.MenuAmendment.CustomerId) && run.ServiceDate == scope.ServiceDate && run.ShiftName == scope.ShiftName && run.PriceTierAmount == scope.PriceTierAmount && run.ClosedAt != null)
            .Where(run => run.SourceLines.Count(source => sourceLineKeys.Any(key => key.SequenceEqual(source.MaterialRequestLineId))) == sourceLineKeys.Count)
            .ToListAsync(cancellationToken);
        if (matchedRuns.Count != 1)
            throw new BusinessRuleException(matchedRuns.Count == 0
                ? "Chưa tìm được Ca phục vụ đã đóng khớp toàn bộ source-line; quyết định vẫn bị chặn."
                : "Có nhiều Ca phục vụ khớp source-line; cần quyết định lineage trước khi correction.");

        var run = matchedRuns.Single();
        var correction = new MenuAmendmentReconciliationCorrection { MenuAmendmentReconciliationCorrectionId = GuidHelper.NewId(), MenuAmendmentReconciliationCaseId = reconciliationCase.MenuAmendmentReconciliationCaseId, ServiceRunId = run.ServiceRunId, ServiceRunDecisionItemId = decision.ServiceRunDecisionItemId, Reason = request.Reason.Trim(), CreatedBy = actorId, CreatedAt = DateTime.UtcNow };
        context.Menuamendmentreconciliationcorrections.Add(correction);
        var effectiveDecisionKeys = impact.DecisionScopes.Select(item => GuidHelper.ParseGuidString(item.DecisionItemId)).Where(item => item is not null).ToList();
        var correctedDecisionKeys = await context.Menuamendmentreconciliationcorrections.Where(item => item.MenuAmendmentReconciliationCaseId.SequenceEqual(reconciliationCase.MenuAmendmentReconciliationCaseId) && item.ServiceRunDecisionItemId != null).Select(item => item.ServiceRunDecisionItemId!).ToListAsync(cancellationToken);
        var correctedDecisionIds = correctedDecisionKeys.Select(GuidHelper.ToGuidString)
            .Append(GuidHelper.ToGuidString(decision.ServiceRunDecisionItemId));
        var isResolved = DecisionCorrectionCompletionPolicy.IsComplete(
            impact.DecisionScopes.Select(item => item.DecisionItemId), correctedDecisionIds);
        reconciliationCase.Status = isResolved ? "RESOLVED" : "OPEN";
        recorder.Stage(new LifecycleTransitionRequest(nameof(MenuAmendmentReconciliationCase), reconciliationCase.MenuAmendmentReconciliationCaseId,
            request.CommandId, 1, "OPEN", reconciliationCase.Status, actorId, request.ExpectedVersion, correction.Reason,
            request.CorrelationId, request.CausationId, JsonSerializer.Serialize(new { decisionItemId, correction.ServiceRunId, scope.SourceLineIds }),
            JsonSerializer.Serialize(new { decisionItemId, status = reconciliationCase.Status, version = 1 })));
        await context.SaveChangesAsync(cancellationToken);
        return ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, "RESOLVED", 1);
    }

    public async Task<MenuAmendmentDecisionPageDto> GetDecisionPageAsync(string? customerId, bool allCustomers, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new ArgumentOutOfRangeException(nameof(pageSize), "Phân trang quyết định không hợp lệ.");
        var selectedCustomerId = allCustomers ? null : GuidHelper.ParseGuidString(customerId) ?? throw new ArgumentException("Cần chọn khách hàng hoặc dùng All customers.");
        var casesQuery = context.Menuamendmentreconciliationcases.AsNoTracking().Include(item => item.MenuAmendment).ThenInclude(item => item.Customer).Include(item => item.Remediations).AsQueryable();
        if (selectedCustomerId is not null)
            casesQuery = casesQuery.Where(item => item.MenuAmendment.CustomerId.SequenceEqual(selectedCustomerId));
        var cases = await casesQuery.OrderBy(item => item.Status == "OPEN" ? 0 : 1).ThenBy(item => item.CreatedAt).ToListAsync(cancellationToken);
        var rows = new List<MenuAmendmentDecisionItemDto>();
        foreach (var reconciliationCase in cases)
        {
            var impact = ReadEffectiveImpact(reconciliationCase);
            var correctedDecisionIds = (await context.Menuamendmentreconciliationcorrections.AsNoTracking()
                .Where(item => item.MenuAmendmentReconciliationCaseId.SequenceEqual(reconciliationCase.MenuAmendmentReconciliationCaseId) && item.ServiceRunDecisionItemId != null)
                .Select(item => item.ServiceRunDecisionItemId!).ToListAsync(cancellationToken))
                .Select(GuidHelper.ToGuidString).ToHashSet(StringComparer.OrdinalIgnoreCase);
            foreach (var scope in impact.DecisionScopes)
            {
                var decisionKey = GuidHelper.ParseGuidString(scope.DecisionItemId);
                if (decisionKey is null) continue;
                var decision = await context.Servicerundecisionitems.AsNoTracking().SingleOrDefaultAsync(item => item.ServiceRunDecisionItemId.SequenceEqual(decisionKey), cancellationToken);
                if (decision is not null)
                {
                    var corrected = correctedDecisionIds.Contains(scope.DecisionItemId);
                    rows.Add(ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, corrected ? "RESOLVED" : "OPEN", corrected ? 1 : 0));
                }
            }
        }
        return new MenuAmendmentDecisionPageDto { Items = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList(), Page = page, PageSize = pageSize, TotalCount = rows.Count };
    }

    private static MenuAmendmentResultDto ReadImpact(string? json)
        => string.IsNullOrWhiteSpace(json) ? new MenuAmendmentResultDto() : JsonSerializer.Deserialize<MenuAmendmentResultDto>(json) ?? new MenuAmendmentResultDto();

    private static MenuAmendmentResultDto ReadEffectiveImpact(MenuAmendmentReconciliationCase reconciliationCase)
        => reconciliationCase.Remediations.OrderByDescending(item => item.CreatedAt).ThenByDescending(item => GuidHelper.ToGuidString(item.MenuAmendmentReconciliationRemediationId)).Select(item => ReadImpact(item.EffectiveImpactSnapshotJson)).FirstOrDefault()
            ?? ReadImpact(reconciliationCase.ImpactSnapshotJson);

    private static MenuAmendmentDecisionItemDto ToDecisionDto(
        ServiceRunDecisionItem decision,
        MenuAmendment amendment,
        MenuAmendmentDecisionScopeDto scope,
        string caseStatus,
        long version)
        => new()
        {
            DecisionItemId = GuidHelper.ToGuidString(decision.ServiceRunDecisionItemId),
            MenuAmendmentId = GuidHelper.ToGuidString(amendment.MenuAmendmentId),
            CustomerId = scope.CustomerId,
            CustomerName = scope.CustomerName,
            ServiceDate = scope.ServiceDate,
            ShiftName = scope.ShiftName,
            PriceTierAmount = scope.PriceTierAmount,
            DocumentIds = scope.DocumentIds,
            SourceLineIds = scope.SourceLineIds,
            Reason = decision.Reason,
            AccountableRole = "Quản trị",
            DueAt = decision.CreatedAt.AddDays(1),
            Status = caseStatus,
            Version = version,
            AllowedActions = caseStatus == "OPEN" ? ["APPEND_CORRECTION"] : [],
        };
}
