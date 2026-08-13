using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class MenuAmendmentService(IpcManagementContext context) : IMenuAmendmentService
{
    internal sealed record DecisionScopeSource(
        string CustomerId,
        string CustomerName,
        DateOnly ServiceDate,
        string ShiftName,
        decimal PriceTierAmount,
        string SourceLineId);

    internal static IReadOnlyList<MenuAmendmentDecisionScopeDto> BuildDecisionScopes(
        IEnumerable<DecisionScopeSource> sourceLines,
        IReadOnlyList<string> documentIds)
        => sourceLines
            .GroupBy(item => new { item.CustomerId, item.ServiceDate, item.ShiftName, item.PriceTierAmount })
            .Select(group => new MenuAmendmentDecisionScopeDto
            {
                CustomerId = group.Key.CustomerId,
                CustomerName = group.First().CustomerName,
                ServiceDate = group.Key.ServiceDate,
                ShiftName = group.Key.ShiftName,
                PriceTierAmount = group.Key.PriceTierAmount,
                DocumentIds = documentIds,
                SourceLineIds = group.Select(item => item.SourceLineId).ToArray(),
            }).ToList();

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
                .Where(item => item.MenuAmendment.CustomerId.SequenceEqual(decision.CustomerId!))
                .ToListAsync(cancellationToken))
            .SingleOrDefault(item => ReadImpact(item.ImpactSnapshotJson).DecisionScopes
                .Any(scope => string.Equals(scope.DecisionItemId, decisionItemId, StringComparison.OrdinalIgnoreCase)))
            ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ đối soát của quyết định.");
        var impact = ReadImpact(reconciliationCase.ImpactSnapshotJson);
        var scope = impact.DecisionScopes.SingleOrDefault(item => string.Equals(item.DecisionItemId, decisionItemId, StringComparison.OrdinalIgnoreCase))
            ?? throw new BusinessRuleException("Hồ sơ đối soát thiếu phạm vi source-line chính xác.");
        if (decision.CustomerId is null || !decision.CustomerId.SequenceEqual(reconciliationCase.MenuAmendment.CustomerId) ||
            decision.ServiceDate != scope.ServiceDate || !string.Equals(decision.ShiftName, scope.ShiftName, StringComparison.OrdinalIgnoreCase) || decision.PriceTierAmount != scope.PriceTierAmount)
            throw new BusinessRuleException("Quyết định không còn thuộc đúng phạm vi đối soát.");
        var currentVersion = reconciliationCase.Status == "RESOLVED" ? 1L : 0L;
        var recorder = new LifecycleTransitionRecorder(context);
        var existing = await recorder.FindExistingCommandAsync(request.CommandId, nameof(MenuAmendmentReconciliationCase), reconciliationCase.MenuAmendmentReconciliationCaseId, cancellationToken);
        if (existing is not null)
            return ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, reconciliationCase.Status, currentVersion);
        if (currentVersion != request.ExpectedVersion)
            throw new BusinessRuleException("Dữ liệu quyết định đã thay đổi; hãy dùng trạng thái hiện hành rồi thử lại.");
        if (reconciliationCase.Status != "OPEN")
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
        var correction = new MenuAmendmentReconciliationCorrection { MenuAmendmentReconciliationCorrectionId = GuidHelper.NewId(), MenuAmendmentReconciliationCaseId = reconciliationCase.MenuAmendmentReconciliationCaseId, ServiceRunId = run.ServiceRunId, Reason = request.Reason.Trim(), CreatedBy = actorId, CreatedAt = DateTime.UtcNow };
        context.Menuamendmentreconciliationcorrections.Add(correction);
        reconciliationCase.Status = "RESOLVED";
        recorder.Stage(new LifecycleTransitionRequest(nameof(MenuAmendmentReconciliationCase), reconciliationCase.MenuAmendmentReconciliationCaseId,
            request.CommandId, 1, "OPEN", "RESOLVED", actorId, request.ExpectedVersion, correction.Reason,
            request.CorrelationId, request.CausationId, JsonSerializer.Serialize(new { decisionItemId, correction.ServiceRunId, scope.SourceLineIds }),
            JsonSerializer.Serialize(new { decisionItemId, status = "RESOLVED", version = 1 })));
        await context.SaveChangesAsync(cancellationToken);
        return ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, reconciliationCase.Status, 1);
    }

    public async Task<MenuAmendmentDecisionPageDto> GetDecisionPageAsync(string? customerId, bool allCustomers, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new ArgumentOutOfRangeException(nameof(pageSize), "Phân trang quyết định không hợp lệ.");
        var selectedCustomerId = allCustomers ? null : GuidHelper.ParseGuidString(customerId) ?? throw new ArgumentException("Cần chọn khách hàng hoặc dùng All customers.");
        var casesQuery = context.Menuamendmentreconciliationcases.AsNoTracking().Include(item => item.MenuAmendment).ThenInclude(item => item.Customer).AsQueryable();
        if (selectedCustomerId is not null)
            casesQuery = casesQuery.Where(item => item.MenuAmendment.CustomerId.SequenceEqual(selectedCustomerId));
        var cases = await casesQuery.OrderBy(item => item.Status == "OPEN" ? 0 : 1).ThenBy(item => item.CreatedAt).ToListAsync(cancellationToken);
        var rows = new List<MenuAmendmentDecisionItemDto>();
        foreach (var reconciliationCase in cases)
        {
            var impact = ReadImpact(reconciliationCase.ImpactSnapshotJson);
            foreach (var scope in impact.DecisionScopes)
            {
                var decisionKey = GuidHelper.ParseGuidString(scope.DecisionItemId);
                if (decisionKey is null) continue;
                var decision = await context.Servicerundecisionitems.AsNoTracking().SingleOrDefaultAsync(item => item.ServiceRunDecisionItemId.SequenceEqual(decisionKey), cancellationToken);
                if (decision is not null)
                    rows.Add(ToDecisionDto(decision, reconciliationCase.MenuAmendment, scope, reconciliationCase.Status, reconciliationCase.Status == "RESOLVED" ? 1 : 0));
            }
        }
        return new MenuAmendmentDecisionPageDto { Items = rows.Skip((page - 1) * pageSize).Take(pageSize).ToList(), Page = page, PageSize = pageSize, TotalCount = rows.Count };
    }
    public async Task<IReadOnlyList<MenuAmendmentInboxItemDto>> GetInboxAsync(string? status, CancellationToken cancellationToken = default)
    {
        var items = await context.Menuamendments.AsNoTracking().Include(item => item.Customer)
            .Where(item => string.IsNullOrWhiteSpace(status) || item.Status == status)
            .OrderBy(item => item.CreatedAt).ToListAsync(cancellationToken);
        return items.Select(item =>
        {
            var impact = JsonSerializer.Deserialize<MenuAmendmentResultDto>(item.ImpactSnapshotJson) ?? new MenuAmendmentResultDto();
            return new MenuAmendmentInboxItemDto
            {
                MenuAmendmentId = GuidHelper.ToGuidString(item.MenuAmendmentId), CustomerId = GuidHelper.ToGuidString(item.CustomerId),
                CustomerName = item.Customer.CustomerName, WeekStartDate = item.WeekStartDate, Status = item.Status,
                Reason = item.Reason, CreatedAt = item.CreatedAt, RequiresReconciliation = impact.RequiresReconciliation,
                HasPurchaseOrder = impact.HasPurchaseOrder, HasReceipt = impact.HasReceipt, HasIssue = impact.HasIssue,
                AffectedDemandCount = impact.AffectedDemandCount, AffectedPurchaseRequestCount = impact.AffectedPurchaseRequestCount
            };
        }).ToList();
    }

    private static MenuAmendmentResultDto ReadImpact(string snapshot)
        => JsonSerializer.Deserialize<MenuAmendmentResultDto>(snapshot) ?? new MenuAmendmentResultDto();

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

    public Task<MenuAmendmentResultDto> ExecuteAsync(string amendmentId, string? actorUserId, CancellationToken cancellationToken = default)
        => ExecuteCoreAsync(amendmentId, actorUserId, null, cancellationToken);

    public Task<MenuAmendmentResultDto> BreakGlassExecuteAsync(string amendmentId, BreakGlassMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("Break-glass cần nêu lý do vận hành.");
        return ExecuteCoreAsync(amendmentId, actorUserId, request.Reason.Trim(), cancellationToken);
    }

    private async Task<MenuAmendmentResultDto> ExecuteCoreAsync(string amendmentId, string? actorUserId, string? breakGlassReason, CancellationToken cancellationToken)
    {
        var id = GuidHelper.ParseGuidString(amendmentId) ?? throw new ArgumentException("Mã yêu cầu thay đổi không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người thực thi.");
        var amendment = await context.Menuamendments.Include(item => item.Lines).SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(id), cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
        var isBreakGlass = breakGlassReason is not null;
        if (!isBreakGlass && amendment.Status != "APPROVED_FOR_EXECUTION") throw new BusinessRuleException("Yêu cầu thay đổi chưa đủ điều kiện thực thi.");
        if (isBreakGlass && amendment.Status is not ("PENDING_REVIEW" or "APPROVED_FOR_EXECUTION"))
            throw new BusinessRuleException("Break-glass chỉ áp dụng cho yêu cầu chưa có chứng từ vật lý và chưa bị đối soát.");
        if (!isBreakGlass && (amendment.ReviewedBy is null || amendment.ReviewedAt is null))
            throw new BusinessRuleException("Yêu cầu thay đổi chưa có hậu kiểm hợp lệ.");
        if (!isBreakGlass && (actorId.SequenceEqual(amendment.CreatedBy) || actorId.SequenceEqual(amendment.ReviewedBy!)))
            throw new BusinessRuleException("Người tạo hoặc người hậu kiểm không được tự thực thi thay đổi thực đơn.");
        var demands = await context.Materialrequests.Include(item => item.Plan).Where(item => item.RequestDate >= amendment.WeekStartDate && item.RequestDate < amendment.WeekStartDate.AddDays(7) && item.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(amendment.CustomerId))).ToListAsync(cancellationToken);
        var purchases = await context.Purchaserequests.Where(item => item.PurchaseForDate >= amendment.WeekStartDate && item.PurchaseForDate < amendment.WeekStartDate.AddDays(7) && item.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(amendment.CustomerId))).ToListAsync(cancellationToken);
        var purchaseIds = purchases.Select(item => item.PurchaseRequestId).ToList();
        var demandIds = demands.Select(item => item.RequestId).ToList();
        var hasPurchaseOrder = purchaseIds.Count > 0 && await context.Purchaseorders.AnyAsync(item => purchaseIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasReceipt = purchaseIds.Count > 0 && await context.Inventoryreceipts.AnyAsync(item => item.PurchaseRequestId != null && purchaseIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasIssue = demandIds.Count > 0 && await context.Inventoryissues.AnyAsync(item => demandIds.Any(id => id.SequenceEqual(item.MaterialRequestId)), cancellationToken);
        var hasPhysical = hasPurchaseOrder || hasReceipt || hasIssue;
        if (hasPhysical) throw new BusinessRuleException("Đã phát sinh PO, nhập hoặc xuất; cần đối soát append-only, không thể regeneration.");
        var now = DateTime.UtcNow;
        foreach (var demand in demands.Where(item => item.Status != "CANCELLED"))
        {
            var old = demand.Status; demand.Status = "CANCELLED";
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "Demand", EntityName = nameof(MaterialRequest), EntityId = demand.RequestId, FieldName = "Status", OldValue = old, NewValue = "CANCELLED", Reason = $"Menu amendment {amendmentId}; regenerate required." });
        }
        foreach (var purchase in purchases.Where(item => item.Status != "CANCELLED"))
        {
            var old = purchase.Status; purchase.Status = "CANCELLED";
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "Purchase", EntityName = nameof(PurchaseRequest), EntityId = purchase.PurchaseRequestId, FieldName = "Status", OldValue = old, NewValue = "CANCELLED", Reason = $"Menu amendment {amendmentId}; regenerate required." });
        }
        var schedules = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems)
            .Where(item => item.CustomerId.SequenceEqual(amendment.CustomerId) && item.WeekStartDate == amendment.WeekStartDate)
            .ToListAsync(cancellationToken);
        if (schedules.Count == 0) throw new BusinessRuleException("Không còn lịch thực đơn nguồn để thực thi thay đổi.");

        var version = await MaterializeAmendedVersionAsync(amendment, schedules, actorId, now, cancellationToken);
        foreach (var line in amendment.Lines)
        {
            var schedule = schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && item.ShiftName == line.ShiftName)
                ?? throw new BusinessRuleException("Lịch thực đơn nguồn không còn tồn tại.");
            var menuItem = schedule.Menu.Menuitems.SingleOrDefault(item => item.DishSlot == line.DishSlot)
                ?? ResolveLegacyMenuItem(schedule.Menu.Menuitems, line.DishSlot)
                ?? throw new BusinessRuleException("Không tìm thấy slot thực đơn nguồn.");
            menuItem.DishId = line.NewDishId;
        }
        var previousStatus = amendment.Status;
        amendment.Status = "EXECUTED";
        amendment.ExecutedBy = actorId;
        amendment.ExecutedAt = DateTime.UtcNow;
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = isBreakGlass ? "BreakGlassExecute" : "Status", OldValue = previousStatus, NewValue = "EXECUTED", Reason = breakGlassReason ?? amendment.Reason });
        await context.SaveChangesAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<MenuAmendmentResultDto>(amendment.ImpactSnapshotJson) ?? new(); result.MenuAmendmentId = amendmentId; result.Status = amendment.Status; result.AppliedMenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId); return result;
    }

    private async Task<MenuVersion> MaterializeAmendedVersionAsync(
        MenuAmendment amendment,
        IReadOnlyList<MenuSchedule> schedules,
        byte[] actorId,
        DateTime changedAt,
        CancellationToken cancellationToken)
    {
        var versions = await context.Menuversions
            .Where(item => item.CustomerId.SequenceEqual(amendment.CustomerId) && item.WeekStartDate == amendment.WeekStartDate)
            .ToListAsync(cancellationToken);
        var versionNo = versions.Count == 0 ? 1 : versions.Max(item => item.VersionNo) + 1;
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = amendment.CustomerId, WeekStartDate = amendment.WeekStartDate,
            VersionNo = versionNo, Status = "ACTIVE", SourceImportBatch = $"AMEND-{GuidHelper.ToGuidString(amendment.MenuAmendmentId)}",
            CreatedBy = actorId, CreatedAt = changedAt, PublishedBy = actorId, PublishedAt = changedAt, UpdatedAt = changedAt,
            SuccessRowCount = schedules.Count
        };
        context.Menuversions.Add(version);

        foreach (var sourceSchedule in schedules)
        {
            var sourceMenu = sourceSchedule.Menu;
            var menu = new Menu
            {
                MenuId = GuidHelper.NewId(),
                MenuCode = AmendmentMenuCode(sourceMenu.MenuCode, versionNo),
                MenuName = $"{sourceMenu.MenuName} · Điều chỉnh V{versionNo}",
                FromDate = sourceMenu.FromDate, ToDate = sourceMenu.ToDate, IsActive = sourceMenu.IsActive
            };
            context.Menus.Add(menu);
            foreach (var sourceItem in sourceMenu.Menuitems)
            {
                var menuItem = new MenuItem
                {
                    MenuItemId = GuidHelper.NewId(), MenuId = menu.MenuId, DishId = sourceItem.DishId,
                    DishSlot = sourceItem.DishSlot, DisplayOrder = sourceItem.DisplayOrder
                };
                menu.Menuitems.Add(menuItem);
            }
            sourceSchedule.MenuId = menu.MenuId;
            sourceSchedule.MenuVersionId = version.MenuVersionId;
            sourceSchedule.Menu = menu;
        }

        return version;
    }

    private static string AmendmentMenuCode(string sourceCode, int versionNo)
    {
        var suffix = $"-A{versionNo:00}";
        return sourceCode.Length + suffix.Length <= 50 ? sourceCode + suffix : sourceCode[..(50 - suffix.Length)] + suffix;
    }

    private static MenuItem? ResolveLegacyMenuItem(IEnumerable<MenuItem> items, string dishSlot)
        => dishSlot is "savory-main" or "vegetarian-main" or "main"
            ? items.SingleOrDefault(item => string.IsNullOrWhiteSpace(item.DishSlot) || item.DishSlot == "main")
            : null;
    public async Task<MenuAmendmentResultDto> ReviewAsync(string amendmentId, ReviewMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var id = GuidHelper.ParseGuidString(amendmentId) ?? throw new ArgumentException("Mã yêu cầu thay đổi không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người hậu kiểm.");
        var amendment = await context.Menuamendments.FindAsync([id], cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
        if (amendment.Status is not ("PENDING_REVIEW" or "RECONCILIATION_REQUIRED")) throw new BusinessRuleException("Yêu cầu thay đổi không còn chờ review.");
        if (actorId.SequenceEqual(amendment.CreatedBy))
            throw new BusinessRuleException("Người tạo không được tự hậu kiểm yêu cầu thay đổi thực đơn.");
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (!request.Approved && reason is null) throw new BusinessRuleException("Cần nêu lý do khi yêu cầu chỉnh sửa.");
        var oldStatus = amendment.Status;
        amendment.Status = request.Approved ? (oldStatus == "RECONCILIATION_REQUIRED" ? "RATIFIED_RECONCILIATION_REQUIRED" : "APPROVED_FOR_EXECUTION") : "CORRECTION_REQUIRED";
        amendment.ReviewedBy = actorId;
        amendment.ReviewedAt = DateTime.UtcNow;
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", OldValue = oldStatus, NewValue = amendment.Status, Reason = reason });
        await context.SaveChangesAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<MenuAmendmentResultDto>(amendment.ImpactSnapshotJson) ?? new MenuAmendmentResultDto();
        result.MenuAmendmentId = amendmentId;
        result.Status = amendment.Status;
        return result;
    }

    public async Task<MenuAmendmentResultDto> CreateAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId) ?? throw new ArgumentException("CustomerId không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người tạo thay đổi thực đơn.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Lines.Count == 0)
            throw new BusinessRuleException("Thay đổi thực đơn cần lý do và ít nhất một dòng thay đổi.");
        if (request.Lines.Select(line => $"{line.ServiceDate:yyyy-MM-dd}|{line.ShiftName}|{line.DishSlot}").Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Lines.Count)
            throw new BusinessRuleException("Mỗi ngày/ca/slot chỉ được xuất hiện một lần trong yêu cầu thay đổi.");

        var schedules = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems)
            .Where(item => item.CustomerId.SequenceEqual(customerId) && item.WeekStartDate == request.WeekStartDate)
            .ToListAsync(cancellationToken);
        var baseVersionId = schedules.Select(item => item.MenuVersionId).FirstOrDefault(item => item is not null);
        var mappedLines = new List<MenuAmendmentLine>();
        foreach (var line in request.Lines)
        {
            var newDishId = GuidHelper.ParseGuidString(line.NewDishId) ?? throw new ArgumentException("NewDishId không hợp lệ.");
            var schedule = schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && string.Equals(item.ShiftName, line.ShiftName, StringComparison.OrdinalIgnoreCase))
                ?? throw new BusinessRuleException("Không tìm thấy lịch thực đơn cho ngày/ca cần thay đổi.");
            if (!await context.Dishes.AnyAsync(item => item.DishId.SequenceEqual(newDishId) && item.IsActive == true, cancellationToken))
                throw new BusinessRuleException("Món thay thế không tồn tại hoặc đã ngừng hoạt động.");
            var oldDishId = (schedule.Menu.Menuitems.SingleOrDefault(item => string.Equals(item.DishSlot, line.DishSlot, StringComparison.OrdinalIgnoreCase))
                ?? ResolveLegacyMenuItem(schedule.Menu.Menuitems, line.DishSlot))?.DishId;
            mappedLines.Add(new MenuAmendmentLine { MenuAmendmentLineId = GuidHelper.NewId(), ServiceDate = line.ServiceDate, ShiftName = line.ShiftName, DishSlot = line.DishSlot, OldDishId = oldDishId, NewDishId = newDishId });
        }

        var materialRequests = await context.Materialrequests.Where(item => item.RequestDate >= request.WeekStartDate && item.RequestDate < request.WeekStartDate.AddDays(7) && item.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(customerId))).ToListAsync(cancellationToken);
        var purchaseRequestIds = await context.Purchaserequests.Where(item => item.PurchaseForDate >= request.WeekStartDate && item.PurchaseForDate < request.WeekStartDate.AddDays(7) && item.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customerId))).Select(item => item.PurchaseRequestId).ToListAsync(cancellationToken);
        var hasPurchaseOrder = purchaseRequestIds.Count > 0 && await context.Purchaseorders.AnyAsync(item => purchaseRequestIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasReceipt = purchaseRequestIds.Count > 0 && await context.Inventoryreceipts.AnyAsync(item => item.PurchaseRequestId != null && purchaseRequestIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var requestIds = materialRequests.Select(item => item.RequestId).ToList();
        var hasIssue = requestIds.Count > 0 && await context.Inventoryissues.AnyAsync(item => requestIds.Any(id => id.SequenceEqual(item.MaterialRequestId)), cancellationToken);
        var requiresReconciliation = hasPurchaseOrder || hasReceipt || hasIssue;
        var documentIds = materialRequests.Select(item => GuidHelper.ToGuidString(item.RequestId)).Concat(purchaseRequestIds.Select(GuidHelper.ToGuidString)).ToArray();
        var sourceLines = await context.Materialrequestlines
            .Include(item => item.PlanLine).ThenInclude(item => item.Customer)
            .Where(item => requestIds.Any(id => id.SequenceEqual(item.RequestId)))
            .ToListAsync(cancellationToken);
        var scopes = BuildDecisionScopes(sourceLines.Select(item => new DecisionScopeSource(
            GuidHelper.ToGuidString(item.PlanLine.CustomerId),
            item.PlanLine.Customer.CustomerName,
            item.Request.RequestDate,
            item.PlanLine.ShiftName,
            item.PriceTierAmount,
            GuidHelper.ToGuidString(item.RequestLineId))), documentIds);
        var result = new MenuAmendmentResultDto { Status = requiresReconciliation ? "RECONCILIATION_REQUIRED" : "PENDING_REVIEW", RequiresReconciliation = requiresReconciliation, AffectedDemandCount = materialRequests.Count, AffectedPurchaseRequestCount = purchaseRequestIds.Count, HasPurchaseOrder = hasPurchaseOrder, HasReceipt = hasReceipt, HasIssue = hasIssue, AffectedDocumentIds = documentIds, AffectedSourceLineIds = sourceLines.Select(item => GuidHelper.ToGuidString(item.RequestLineId)).ToArray(), DecisionScopes = scopes };
        var amendment = new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = request.WeekStartDate, BaseMenuVersionId = baseVersionId, Status = result.Status, Reason = request.Reason.Trim(), ImpactSnapshotJson = JsonSerializer.Serialize(result), CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Lines = mappedLines };
        context.Menuamendments.Add(amendment);
        if (requiresReconciliation)
        {
            var reconciliationCase = new MenuAmendmentReconciliationCase { MenuAmendmentReconciliationCaseId = GuidHelper.NewId(), MenuAmendmentId = amendment.MenuAmendmentId, ImpactSnapshotJson = amendment.ImpactSnapshotJson, CreatedAt = amendment.CreatedAt };
            context.Menuamendmentreconciliationcases.Add(reconciliationCase);
            result.ReconciliationCaseId = GuidHelper.ToGuidString(reconciliationCase.MenuAmendmentReconciliationCaseId);
            foreach (var scope in scopes)
            {
                var planId = sourceLines.First(item => item.RequestLineId.SequenceEqual(GuidHelper.ParseGuidString(scope.SourceLineIds[0])!)).Request.PlanId;
                var decision = new ServiceRunDecisionItem
                {
                    ServiceRunDecisionItemId = GuidHelper.NewId(), PlanId = planId,
                    CustomerId = GuidHelper.ParseGuidString(scope.CustomerId), ServiceDate = scope.ServiceDate,
                    ShiftName = scope.ShiftName, PriceTierAmount = scope.PriceTierAmount,
                    Reason = amendment.Reason, CreatedAt = amendment.CreatedAt,
                };
                scope.DecisionItemId = GuidHelper.ToGuidString(decision.ServiceRunDecisionItemId);
                context.Servicerundecisionitems.Add(decision);
            }
            amendment.ImpactSnapshotJson = JsonSerializer.Serialize(result);
            reconciliationCase.ImpactSnapshotJson = amendment.ImpactSnapshotJson;
        }
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = amendment.CreatedAt, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", NewValue = amendment.Status, Reason = amendment.Reason });
        await context.SaveChangesAsync(cancellationToken);
        result.MenuAmendmentId = GuidHelper.ToGuidString(amendment.MenuAmendmentId);
        return result;
    }
}
