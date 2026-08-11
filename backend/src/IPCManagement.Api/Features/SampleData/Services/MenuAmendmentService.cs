using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class MenuAmendmentService(IpcManagementContext context) : IMenuAmendmentService
{
    public async Task CreateReconciliationCorrectionAsync(string amendmentId, CreateMenuAmendmentReconciliationCorrectionRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var amendmentKey = GuidHelper.ParseGuidString(amendmentId) ?? throw new ArgumentException("Mã amendment không hợp lệ.");
        var runKey = GuidHelper.ParseGuidString(request.ServiceRunId) ?? throw new ArgumentException("Mã ServiceRun không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId) ?? throw new UnauthorizedAccessException("Không xác định được người điều chỉnh.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nêu lý do điều chỉnh đối soát.");
        var reconciliationCase = await context.Menuamendmentreconciliationcases.SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(amendmentKey), cancellationToken) ?? throw new BusinessRuleException("Amendment không thuộc luồng đối soát vật lý.");
        var run = await context.Serviceruns.SingleOrDefaultAsync(item => item.ServiceRunId.SequenceEqual(runKey), cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy ServiceRun.");
        if (run.ClosedAt is null) throw new BusinessRuleException("Chỉ có thể ghi correction sau khi ServiceRun đã đóng.");
        var correction = new MenuAmendmentReconciliationCorrection { MenuAmendmentReconciliationCorrectionId = GuidHelper.NewId(), MenuAmendmentReconciliationCaseId = reconciliationCase.MenuAmendmentReconciliationCaseId, ServiceRunId = run.ServiceRunId, Reason = request.Reason.Trim(), CreatedBy = actorId, CreatedAt = DateTime.UtcNow };
        context.Menuamendmentreconciliationcorrections.Add(correction);
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = correction.CreatedAt, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(MenuAmendmentReconciliationCorrection), EntityId = correction.MenuAmendmentReconciliationCorrectionId, FieldName = "AppendOnlyCorrection", NewValue = GuidHelper.ToGuidString(run.ServiceRunId), Reason = correction.Reason });
        await context.SaveChangesAsync(cancellationToken);
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
        var sourceLineIds = await context.Materialrequestlines.Where(item => requestIds.Any(id => id.SequenceEqual(item.RequestId))).Select(item => item.RequestLineId).ToListAsync(cancellationToken);
        var result = new MenuAmendmentResultDto { Status = requiresReconciliation ? "RECONCILIATION_REQUIRED" : "PENDING_REVIEW", RequiresReconciliation = requiresReconciliation, AffectedDemandCount = materialRequests.Count, AffectedPurchaseRequestCount = purchaseRequestIds.Count, HasPurchaseOrder = hasPurchaseOrder, HasReceipt = hasReceipt, HasIssue = hasIssue, AffectedDocumentIds = documentIds, AffectedSourceLineIds = sourceLineIds.Select(GuidHelper.ToGuidString).ToArray() };
        var amendment = new MenuAmendment { MenuAmendmentId = GuidHelper.NewId(), CustomerId = customerId, WeekStartDate = request.WeekStartDate, BaseMenuVersionId = baseVersionId, Status = result.Status, Reason = request.Reason.Trim(), ImpactSnapshotJson = JsonSerializer.Serialize(result), CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Lines = mappedLines };
        context.Menuamendments.Add(amendment);
        if (requiresReconciliation)
        {
            var reconciliationCase = new MenuAmendmentReconciliationCase { MenuAmendmentReconciliationCaseId = GuidHelper.NewId(), MenuAmendmentId = amendment.MenuAmendmentId, ImpactSnapshotJson = amendment.ImpactSnapshotJson, CreatedAt = amendment.CreatedAt };
            context.Menuamendmentreconciliationcases.Add(reconciliationCase);
            result.ReconciliationCaseId = GuidHelper.ToGuidString(reconciliationCase.MenuAmendmentReconciliationCaseId);
        }
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = amendment.CreatedAt, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = "Status", NewValue = amendment.Status, Reason = amendment.Reason });
        await context.SaveChangesAsync(cancellationToken);
        result.MenuAmendmentId = GuidHelper.ToGuidString(amendment.MenuAmendmentId);
        return result;
    }
}
