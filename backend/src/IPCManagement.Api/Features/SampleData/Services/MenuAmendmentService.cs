using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class MenuAmendmentService(
    IpcManagementContext context,
    IEfTransactionRunner? transactionRunner = null,
    IReconciliationSourceRevisionStager? sourceRevisionStager = null,
    SystemOperationRequestContext? operationContext = null) : IMenuAmendmentService
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

    public Task<MenuAmendmentDecisionRemediationDto> RemediateDecisionFanAsync(string reconciliationCaseId, RemediateMenuAmendmentDecisionFanRequest request, string? actorUserId, CancellationToken cancellationToken = default)
        => new MenuAmendmentDecisionFanRemediator(context).RemediateDecisionFanAsync(reconciliationCaseId, request, actorUserId, cancellationToken);

    public Task<MenuAmendmentDecisionItemDto> ExecuteDecisionAsync(string decisionItemId, MenuAmendmentDecisionCommandRequest request, string? actorUserId, CancellationToken cancellationToken = default)
        => new MenuAmendmentDecisionFanRemediator(context).ExecuteDecisionAsync(decisionItemId, request, actorUserId, cancellationToken);

    public Task<MenuAmendmentDecisionPageDto> GetDecisionPageAsync(string? customerId, bool allCustomers, int page, int pageSize, CancellationToken cancellationToken = default)
        => new MenuAmendmentDecisionFanRemediator(context).GetDecisionPageAsync(customerId, allCustomers, page, pageSize, cancellationToken);

    public Task<IReadOnlyList<MenuAmendmentInboxItemDto>> GetMrxInboxAsync(CancellationToken cancellationToken = default)
        => CreateMrxCoordinator().GetMrxInboxAsync(cancellationToken);

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
                AffectedDemandCount = impact.AffectedDemandCount, AffectedPurchaseRequestCount = impact.AffectedPurchaseRequestCount,
                AffectedReconciliationBatchIds = impact.AffectedReconciliationBatchIds, ImpactLines = impact.ImpactLines
            };
        }).ToList();
    }

    private static MenuAmendmentResultDto ReadImpact(string snapshot)
        => JsonSerializer.Deserialize<MenuAmendmentResultDto>(snapshot) ?? new MenuAmendmentResultDto();

    public Task<MenuAmendmentResultDto> ExecuteAsync(string amendmentId, string? actorUserId, CancellationToken cancellationToken = default)
        => ExecuteCoreAsync(amendmentId, actorUserId, null, cancellationToken);

    public Task<MenuAmendmentResultDto> BreakGlassExecuteAsync(string amendmentId, BreakGlassMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new ArgumentException("Break-glass cần nêu lý do vận hành.");
        return ExecuteCoreAsync(amendmentId, actorUserId, request.Reason.Trim(), cancellationToken);
    }

    private async Task<MenuAmendmentResultDto> ExecuteCoreAsync(string amendmentId, string? actorUserId, string? breakGlassReason, CancellationToken cancellationToken, bool directAdminApproval = false)
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
        if (!isBreakGlass && !directAdminApproval && (actorId.SequenceEqual(amendment.CreatedBy) || actorId.SequenceEqual(amendment.ReviewedBy!)))
            throw new BusinessRuleException("Người tạo hoặc người hậu kiểm không được tự thực thi thay đổi thực đơn.");
        var demands = await context.Materialrequests.Include(item => item.Plan).Where(item => item.RequestDate >= amendment.WeekStartDate && item.RequestDate < amendment.WeekStartDate.AddDays(7) && item.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(amendment.CustomerId))).ToListAsync(cancellationToken);
        var purchases = await context.Purchaserequests.Where(item => item.PurchaseForDate >= amendment.WeekStartDate && item.PurchaseForDate < amendment.WeekStartDate.AddDays(7) && item.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(amendment.CustomerId))).ToListAsync(cancellationToken);
        var purchaseIds = purchases.Select(item => item.PurchaseRequestId).ToList();
        var demandIds = demands.Select(item => item.RequestId).ToList();
        var hasPurchaseOrder = purchaseIds.Count > 0 && await context.Purchaseorders.AnyAsync(item => purchaseIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasReceipt = purchaseIds.Count > 0 && await context.Inventoryreceipts.AnyAsync(item => item.PurchaseRequestId != null && purchaseIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasIssue = demandIds.Count > 0 && await context.Inventoryissues.AnyAsync(item =>
            item.MaterialRequestId != null && item.ReconciliationBatchId == null &&
            demandIds.Any(id => id.SequenceEqual(item.MaterialRequestId)), cancellationToken);
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

        if (amendment.BaseMenuVersionId is not null && schedules.Any(item => item.MenuVersionId is null || !item.MenuVersionId.SequenceEqual(amendment.BaseMenuVersionId)))
            throw new BusinessRuleException("Nguồn thực đơn đã thay đổi. Vui lòng tạo lại preview trước khi phê duyệt.");

        var version = await MenuAmendmentVersionMaterializer.MaterializeAmendedVersionAsync(context, amendment, schedules, actorId, now, cancellationToken);
        foreach (var line in amendment.Lines)
        {
            var schedule = schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && item.ShiftName == line.ShiftName)
                ?? throw new BusinessRuleException("Lịch thực đơn nguồn không còn tồn tại.");
            var menuItem = schedule.Menu.Menuitems.SingleOrDefault(item => item.DishSlot == line.DishSlot)
                ?? MenuAmendmentVersionMaterializer.ResolveLegacyMenuItem(schedule.Menu.Menuitems, line.DishSlot)
                ?? (line.OldDishId is null ? null : schedule.Menu.Menuitems.SingleOrDefault(item => item.DishId is not null && item.DishId.SequenceEqual(line.OldDishId)))
                ?? throw new BusinessRuleException("Không tìm thấy slot thực đơn nguồn.");
            menuItem.DishId = line.NewDishId;
        }
        var impact = ReadImpact(amendment.ImpactSnapshotJson);
        var quantityLines = await context.Mealquantityplanlines
            .Where(item => schedules.Select(schedule => schedule.MenuScheduleId).Contains(item.MenuScheduleId))
            .ToListAsync(cancellationToken);
        foreach (var quantityLine in quantityLines)
        {
            var schedule = schedules.Single(item => item.MenuScheduleId.SequenceEqual(quantityLine.MenuScheduleId));
            quantityLine.MenuId = schedule.MenuId;
            quantityLine.Menu = schedule.Menu;
        }
        foreach (var servingChange in impact.ImpactLines.Where(item => item.NewServings != item.CurrentServings))
        {
            var schedule = schedules.Single(item => item.ServiceDate == servingChange.ServiceDate && item.ShiftName == servingChange.ShiftName);
            var quantityLine = quantityLines.Single(item => item.MenuScheduleId.SequenceEqual(schedule.MenuScheduleId));
            if (quantityLine.FinalServings != servingChange.CurrentServings)
                throw new BusinessRuleException("Số suất nguồn đã thay đổi. Vui lòng tạo lại preview trước khi phê duyệt.");
            context.Quantityadjustments.Add(new QuantityAdjustment
            {
                AdjustmentId = GuidHelper.NewId(), QuantityPlanLineId = quantityLine.QuantityPlanLineId,
                OldServings = quantityLine.FinalServings, NewServings = servingChange.NewServings,
                Reason = amendment.Reason, AdjustedBy = actorId, AdjustedAt = now
            });
            var oldServings = quantityLine.FinalServings;
            quantityLine.ConfirmedServings = servingChange.NewServings;
            quantityLine.FinalServings = servingChange.NewServings;
            quantityLine.UpdatedAt = now;
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = nameof(MealQuantityPlanLine), EntityId = quantityLine.QuantityPlanLineId, FieldName = nameof(MealQuantityPlanLine.FinalServings), OldValue = oldServings.ToString(), NewValue = servingChange.NewServings.ToString(), Reason = amendment.Reason });
        }
        await context.SaveChangesAsync(cancellationToken);

        if (amendment.BaseMenuVersionId is not null)
        {
            if (sourceRevisionStager is not null)
            {
                await sourceRevisionStager.StageAffectedBatchesAsync(
                    amendmentId, amendment.BaseMenuVersionId, version.MenuVersionId,
                    actorUserId, amendment.Reason, schedules, cancellationToken);
            }
            else
            {
                var hasAffectedBatches = await context.Reconciliationbatches.AsNoTracking()
                    .AnyAsync(item => item.MenuVersionId == amendment.BaseMenuVersionId && item.Status != "COMPLETED", cancellationToken);
                if (hasAffectedBatches)
                {
                    throw new InvalidOperationException("Cần IReconciliationSourceRevisionStager để áp dụng thay đổi cho các lô đối soát bị ảnh hưởng.");
                }
            }
        }

        var previousStatus = amendment.Status;
        amendment.Status = "EXECUTED";
        amendment.ExecutedBy = actorId;
        amendment.ExecutedAt = DateTime.UtcNow;
        context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId, BusinessArea = "Coordination", EntityName = nameof(MenuAmendment), EntityId = amendment.MenuAmendmentId, FieldName = isBreakGlass ? "BreakGlassExecute" : "Status", OldValue = previousStatus, NewValue = "EXECUTED", Reason = breakGlassReason ?? amendment.Reason });
        await context.SaveChangesAsync(cancellationToken);
        var result = JsonSerializer.Deserialize<MenuAmendmentResultDto>(amendment.ImpactSnapshotJson) ?? new(); result.MenuAmendmentId = amendmentId; result.Status = amendment.Status; result.AppliedMenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId); return result;
    }

    private MrxMenuAmendmentCoordinator CreateMrxCoordinator()
        => new(context, transactionRunner, operationContext,
            CreateAsync,
            (amendmentId, actorUserId, breakGlassReason, token, directApproval) => ExecuteCoreAsync(amendmentId, actorUserId, breakGlassReason, token, directApproval),
            PreviewAsync);

    public Task<MenuAmendmentResultDto> ConfirmMrxAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
        => CreateMrxCoordinator().ConfirmMrxAsync(request, actorUserId, cancellationToken);

    public Task<MenuAmendmentResultDto> DecideMrxAsync(string amendmentId, ReviewMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
        => CreateMrxCoordinator().DecideMrxAsync(amendmentId, request, actorUserId, cancellationToken);

    public Task<MenuAmendmentResultDto> PreviewMrxAsync(CreateMenuAmendmentRequest request, CancellationToken cancellationToken = default)
        => CreateMrxCoordinator().PreviewMrxAsync(request, cancellationToken);

    public Task<MenuAmendmentResultDto> SubmitMrxAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
        => CreateMrxCoordinator().SubmitMrxAsync(request, actorUserId, cancellationToken);

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

    public async Task<MenuAmendmentResultDto> PreviewAsync(CreateMenuAmendmentRequest request, CancellationToken cancellationToken = default)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId) ?? throw new ArgumentException("CustomerId không hợp lệ.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Lines.Count == 0)
            throw new BusinessRuleException("Thay đổi thực đơn cần lý do và ít nhất một dòng thay đổi.");
        if (request.Lines.Select(line => $"{line.ServiceDate:yyyy-MM-dd}|{line.ShiftName}|{line.DishSlot}").Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Lines.Count)
            throw new BusinessRuleException("Mỗi ngày/ca/slot chỉ được xuất hiện một lần trong yêu cầu thay đổi.");

        var schedules = await context.Menuschedules.AsNoTracking().Include(item => item.Menu).ThenInclude(menu => menu.Menuitems)
            .Where(item => item.CustomerId.SequenceEqual(customerId) && item.WeekStartDate == request.WeekStartDate)
            .ToListAsync(cancellationToken);
        if (schedules.Count == 0) throw new BusinessRuleException("Không tìm thấy lịch thực đơn trong phạm vi thay đổi.");
        if (!string.IsNullOrWhiteSpace(request.ExpectedBaseMenuVersionId))
        {
            var expectedVersionId = GuidHelper.ParseGuidString(request.ExpectedBaseMenuVersionId) ?? throw new ArgumentException("ExpectedBaseMenuVersionId không hợp lệ.");
            if (schedules.Any(item => item.MenuVersionId is null || !item.MenuVersionId.SequenceEqual(expectedVersionId)))
                throw new BusinessRuleException("Nguồn thực đơn đã thay đổi. Vui lòng tải lại trước khi xác nhận.");
        }

        var scheduleIds = schedules.Select(item => item.MenuScheduleId).ToList();
        var quantityLines = await context.Mealquantityplanlines.AsNoTracking()
            .Where(item => scheduleIds.Contains(item.MenuScheduleId))
            .OrderByDescending(item => item.UpdatedAt)
            .ToListAsync(cancellationToken);
        var impactLines = new List<MenuAmendmentImpactLineDto>();
        foreach (var line in request.Lines)
        {
            if (line.NewServings is <= 0) throw new BusinessRuleException("Số suất mới phải lớn hơn 0.");
            var schedule = schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && string.Equals(item.ShiftName, line.ShiftName, StringComparison.OrdinalIgnoreCase))
                ?? throw new BusinessRuleException("Không tìm thấy lịch thực đơn cho ngày/ca cần thay đổi.");
            var sourceItem = schedule.Menu.Menuitems.SingleOrDefault(item => string.Equals(item.DishSlot, line.DishSlot, StringComparison.OrdinalIgnoreCase))
                ?? ResolveLegacyMenuItem(schedule.Menu.Menuitems, line.DishSlot)
                ?? throw new BusinessRuleException("Không tìm thấy slot thực đơn nguồn.");
            var oldDishId = sourceItem.DishId ?? throw new BusinessRuleException("Slot thực đơn nguồn chưa có món ăn.");
            var newDishId = string.IsNullOrWhiteSpace(line.NewDishId)
                ? oldDishId
                : GuidHelper.ParseGuidString(line.NewDishId) ?? throw new ArgumentException("NewDishId không hợp lệ.");
            var quantityLine = quantityLines.FirstOrDefault(item => item.MenuScheduleId.SequenceEqual(schedule.MenuScheduleId));
            var currentServings = quantityLine?.FinalServings ?? 0;
            var newServings = line.NewServings ?? currentServings;
            if (!string.IsNullOrWhiteSpace(request.ExpectedBaseMenuVersionId) && newDishId.SequenceEqual(oldDishId) && newServings == currentServings)
                throw new BusinessRuleException("Dòng thay đổi phải đổi món hoặc số suất.");
            if (!string.IsNullOrWhiteSpace(line.NewDishId))
            {
                var hasBom = await context.Dishboms.AsNoTracking().AnyAsync(item =>
                    item.DishId.SequenceEqual(newDishId) && item.BomStatus == "PUBLISHED" &&
                    item.EffectiveFrom <= line.ServiceDate && (item.EffectiveTo == null || item.EffectiveTo >= line.ServiceDate), cancellationToken);
                if (!hasBom) throw new BusinessRuleException("Món thay thế chưa có BOM hiệu lực cho ngày phục vụ.");
            }
            impactLines.Add(new MenuAmendmentImpactLineDto
            {
                ServiceDate = line.ServiceDate,
                ShiftName = schedule.ShiftName,
                DishSlot = line.DishSlot,
                OldDishId = GuidHelper.ToGuidString(oldDishId),
                NewDishId = GuidHelper.ToGuidString(newDishId),
                CurrentServings = currentServings,
                NewServings = newServings
            });
        }

        var affectedBatchIds = new List<byte[]>();
        if (!string.IsNullOrWhiteSpace(request.ExpectedBaseMenuVersionId))
        {
            affectedBatchIds = await (
                from batch in context.Reconciliationbatches.AsNoTracking()
                join version in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals version.MenuVersionId
                where version.CustomerId.SequenceEqual(customerId) && version.WeekStartDate == request.WeekStartDate
                select batch.BatchId)
                .ToListAsync(cancellationToken);
        }
        return new MenuAmendmentResultDto
        {
            Status = "PREVIEW",
            AffectedReconciliationBatchIds = affectedBatchIds.Select(GuidHelper.ToGuidString).ToArray(),
            ImpactLines = impactLines
        };
    }

    public async Task<MenuAmendmentResultDto> CreateAsync(CreateMenuAmendmentRequest request, string? actorUserId, CancellationToken cancellationToken = default)
    {
        var preview = await PreviewAsync(request, cancellationToken);
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
            var requestedDishId = string.IsNullOrWhiteSpace(line.NewDishId) ? null : GuidHelper.ParseGuidString(line.NewDishId) ?? throw new ArgumentException("NewDishId không hợp lệ.");
            var schedule = schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && string.Equals(item.ShiftName, line.ShiftName, StringComparison.OrdinalIgnoreCase))
                ?? throw new BusinessRuleException("Không tìm thấy lịch thực đơn cho ngày/ca cần thay đổi.");
            var oldDishId = (schedule.Menu.Menuitems.SingleOrDefault(item => string.Equals(item.DishSlot, line.DishSlot, StringComparison.OrdinalIgnoreCase))
                ?? ResolveLegacyMenuItem(schedule.Menu.Menuitems, line.DishSlot))?.DishId;
            var newDishId = requestedDishId ?? oldDishId ?? throw new BusinessRuleException("Slot thực đơn nguồn chưa có món ăn.");
            if (!await context.Dishes.AnyAsync(item => item.DishId.SequenceEqual(newDishId) && item.IsActive == true, cancellationToken))
                throw new BusinessRuleException("Món thay thế không tồn tại hoặc đã ngừng hoạt động.");
            mappedLines.Add(new MenuAmendmentLine { MenuAmendmentLineId = GuidHelper.NewId(), ServiceDate = line.ServiceDate, ShiftName = line.ShiftName, DishSlot = line.DishSlot, OldDishId = oldDishId, NewDishId = newDishId });
        }

        var materialRequests = await context.Materialrequests.Where(item => item.RequestDate >= request.WeekStartDate && item.RequestDate < request.WeekStartDate.AddDays(7) && item.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(customerId))).ToListAsync(cancellationToken);
        var purchaseRequestIds = await context.Purchaserequests.Where(item => item.PurchaseForDate >= request.WeekStartDate && item.PurchaseForDate < request.WeekStartDate.AddDays(7) && item.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customerId))).Select(item => item.PurchaseRequestId).ToListAsync(cancellationToken);
        var hasPurchaseOrder = purchaseRequestIds.Count > 0 && await context.Purchaseorders.AnyAsync(item => purchaseRequestIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var hasReceipt = purchaseRequestIds.Count > 0 && await context.Inventoryreceipts.AnyAsync(item => item.PurchaseRequestId != null && purchaseRequestIds.Any(id => id.SequenceEqual(item.PurchaseRequestId)), cancellationToken);
        var requestIds = materialRequests.Select(item => item.RequestId).ToList();
        var hasIssue = requestIds.Count > 0 && await context.Inventoryissues.AnyAsync(item =>
            item.MaterialRequestId != null && item.ReconciliationBatchId == null &&
            requestIds.Any(id => id.SequenceEqual(item.MaterialRequestId)), cancellationToken);
        var requiresReconciliation = hasPurchaseOrder || hasReceipt || hasIssue;
        var documentIds = materialRequests.Select(item => GuidHelper.ToGuidString(item.RequestId)).Concat(purchaseRequestIds.Select(GuidHelper.ToGuidString)).ToArray();
        var sourceLines = requestIds.Count == 0
            ? []
            : await context.Materialrequestlines
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
        var result = new MenuAmendmentResultDto { Status = requiresReconciliation ? "RECONCILIATION_REQUIRED" : "PENDING_REVIEW", RequiresReconciliation = requiresReconciliation, AffectedDemandCount = materialRequests.Count, AffectedPurchaseRequestCount = purchaseRequestIds.Count, HasPurchaseOrder = hasPurchaseOrder, HasReceipt = hasReceipt, HasIssue = hasIssue, AffectedDocumentIds = documentIds, AffectedSourceLineIds = sourceLines.Select(item => GuidHelper.ToGuidString(item.RequestLineId)).ToArray(), AffectedReconciliationBatchIds = preview.AffectedReconciliationBatchIds, ImpactLines = preview.ImpactLines, DecisionScopes = scopes };
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

    private static MenuItem? ResolveLegacyMenuItem(IEnumerable<MenuItem> items, string dishSlot)
        => MenuAmendmentVersionMaterializer.ResolveLegacyMenuItem(items, dishSlot);
}
