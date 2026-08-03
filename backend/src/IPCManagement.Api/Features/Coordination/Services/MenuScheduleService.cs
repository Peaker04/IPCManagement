using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class MenuScheduleService : IMenuScheduleService
{
    private const decimal FixedBomRatePercent = 100m;
    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;

    public MenuScheduleService(IpcManagementContext context, IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _transactionRunner = transactionRunner;
    }

    public async Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query)
    {
        var schedulesQuery = _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
            .AsNoTracking()
            .AsSplitQuery()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            var customerId = GuidHelper.ParseGuidString(query.CustomerId);
            if (customerId is null)
            {
                return [];
            }

            schedulesQuery = schedulesQuery.Where(schedule => schedule.CustomerId == customerId);
        }

        if (!string.IsNullOrWhiteSpace(query.ServiceDate) &&
            DateOnly.TryParse(query.ServiceDate, out var serviceDate))
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ServiceDate == serviceDate);
        }
        else if (!string.IsNullOrWhiteSpace(query.DayOfWeek))
        {
            var resolvedDate = MenuSchedulePolicy.ResolveServiceDate(null, query.DayOfWeek);
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ServiceDate == resolvedDate);
        }
        else
        {
            var weekStart = MenuSchedulePolicy.ResolveWeekStartDate(query.WeekStartDate);
            var weekEnd = weekStart.AddDays(6);
            schedulesQuery = schedulesQuery.Where(schedule =>
                schedule.ServiceDate >= weekStart &&
                schedule.ServiceDate <= weekEnd);
        }

        var shiftName = MenuSchedulePolicy.NormalizeShiftName(query.ShiftName);
        if (!string.IsNullOrWhiteSpace(query.ShiftName) && shiftName is null)
        {
            return [];
        }

        if (shiftName is not null)
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ShiftName == shiftName);
        }

        var schedules = await schedulesQuery
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ThenBy(schedule => schedule.Customer.CustomerCode)
            .ToListAsync();

        var versions = await LoadMenuVersionsAsync(schedules);
        return schedules
            .Select(schedule => MenuSchedulePolicy.MapMenuSchedule(
                schedule,
                MenuSchedulePolicy.ResolveMenuVersion(versions, schedule)))
            .ToList();
    }

    public async Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
        string menuScheduleId,
        UpdateMenuScheduleRulesRequest request,
        string? userId,
        string? correlationId = null)
    {
        var schedule = await FindMenuScheduleForUpdateAsync(menuScheduleId);
        if (schedule is null)
        {
            return null;
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var auditCorrelationId = ResolveCorrelationId(correlationId);
        var reason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Cập nhật quy tắc contract/suất ăn"
            : request.Reason.Trim();

        if (request.MenuPrice is not null)
        {
            var nextPrice = DecimalPolicy.RoundMoney(request.MenuPrice.Value);
            if (nextPrice < 0)
            {
                throw new ArgumentException("Đơn giá menu không được âm.");
            }

            if (schedule.MenuPrice != nextPrice)
            {
                await CustomerWeekMenuTierInvariant.RequireAsync(
                    _context,
                    schedule.CustomerId,
                    schedule.WeekStartDate,
                    nextPrice);
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.MenuPrice), schedule.MenuPrice.ToString(), nextPrice.ToString(), reason, auditCorrelationId);
                schedule.MenuPrice = nextPrice;
            }
        }

        if (schedule.BomRatePercent != FixedBomRatePercent)
        {
            AddAudit(actorId, changedAt, "PortionRule", nameof(MenuSchedule), schedule.MenuScheduleId,
                nameof(MenuSchedule.BomRatePercent), schedule.BomRatePercent.ToString(), FixedBomRatePercent.ToString(), reason, auditCorrelationId);
            schedule.BomRatePercent = FixedBomRatePercent;
        }

        var status = MenuSchedulePolicy.NormalizeMenuScheduleStatus(request.Status);
        if (status is not null && !string.Equals(schedule.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuSchedule), schedule.MenuScheduleId,
                nameof(MenuSchedule.Status), schedule.Status, status, reason, auditCorrelationId);
            schedule.Status = status;
        }

        await _context.SaveChangesAsync();
        var version = await GetLatestMenuVersionAsync(schedule.CustomerId, schedule.WeekStartDate);
        return MenuSchedulePolicy.MapMenuSchedule(schedule, version);
    }

    public async Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
        string menuScheduleId,
        UpdateMenuScheduleVersionRequest request,
        string? userId,
        string? correlationId = null)
    {
        var schedule = await FindMenuScheduleForUpdateAsync(menuScheduleId);
        if (schedule is null)
        {
            return null;
        }

        var status = MenuSchedulePolicy.NormalizeMenuScheduleStatus(request.Status);
        if (status is null)
        {
            throw new ArgumentException("Trạng thái version thực đơn không hợp lệ.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var auditCorrelationId = ResolveCorrelationId(correlationId);
        var version = await EnsureMenuVersionAsync(schedule.CustomerId, schedule.WeekStartDate, actorId, changedAt);
        var oldVersionStatus = version.Status;

        if (status == "ACTIVE")
        {
            var activeVersions = (await _context.Menuversions
                .Where(item => item.WeekStartDate == schedule.WeekStartDate && item.Status == "ACTIVE")
                .ToListAsync())
                .Where(item =>
                    item.CustomerId.SequenceEqual(schedule.CustomerId) &&
                    !item.MenuVersionId.SequenceEqual(version.MenuVersionId))
                .ToList();
            foreach (var activeVersion in activeVersions)
            {
                activeVersion.Status = "SUPERSEDED";
                activeVersion.UpdatedAt = changedAt;
            }

            version.PublishedBy = actorId;
            version.PublishedAt = changedAt;
        }

        var reason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Cập nhật version thực đơn"
            : request.Reason.Trim();
        if (!string.Equals(version.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            AddAudit(
                actorId,
                changedAt,
                "MenuVersion",
                nameof(MenuVersion),
                version.MenuVersionId,
                nameof(MenuVersion.Status),
                version.Status,
                status,
                reason,
                auditCorrelationId);
            version.Status = status;
            version.UpdatedAt = changedAt;
        }

        var weekSchedules = (await _context.Menuschedules
            .Where(item => item.WeekStartDate == schedule.WeekStartDate)
            .ToListAsync())
            .Where(item => item.CustomerId.SequenceEqual(schedule.CustomerId))
            .ToList();

        if (!string.Equals(oldVersionStatus, status, StringComparison.OrdinalIgnoreCase) ||
            weekSchedules.Any(item => !string.Equals(item.Status, status, StringComparison.OrdinalIgnoreCase)))
        {
            var weekRange = $"{schedule.WeekStartDate:yyyy-MM-dd}..{schedule.WeekStartDate.AddDays(6):yyyy-MM-dd}";
            AddAudit(
                actorId,
                changedAt,
                "MenuVersion",
                nameof(MenuVersion),
                version.MenuVersionId,
                "EffectiveRange",
                $"{weekRange}|{oldVersionStatus}",
                $"{weekRange}|{status}",
                reason,
                auditCorrelationId);
        }

        foreach (var weekSchedule in weekSchedules)
        {
            if (string.Equals(weekSchedule.Status, status, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            AddAudit(
                actorId,
                changedAt,
                "MenuVersion",
                nameof(MenuSchedule),
                weekSchedule.MenuScheduleId,
                nameof(MenuSchedule.Status),
                weekSchedule.Status,
                status,
                reason,
                auditCorrelationId);
            weekSchedule.Status = status;
        }

        await _context.SaveChangesAsync();
        return MenuSchedulePolicy.MapMenuSchedule(schedule, version);
    }

    public async Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(
        RollbackMenuVersionRequest request,
        string? userId)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId)
            ?? throw new ArgumentException("Khách hàng không hợp lệ.");
        if (!DateOnly.TryParse(request.WeekStartDate, out var weekStartDate))
        {
            throw new ArgumentException("Tuần bắt đầu không hợp lệ.");
        }

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Vui lòng nhập lý do rollback thực đơn.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        MenuVersionRollbackResultDto? transactionResult = null;
        return await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var versions = (await _context.Menuversions
                    .Where(version => version.WeekStartDate == weekStartDate)
                    .OrderByDescending(version => version.VersionNo)
                    .ToListAsync(cancellationToken))
                    .Where(version => version.CustomerId.SequenceEqual(customerId))
                    .ToList();
                if (versions.Count == 0)
                {
                    throw new ArgumentException("Chưa có version thực đơn cho khách hàng và tuần đã chọn.");
                }

                var current = versions
                    .Where(version => MenuSchedulePolicy.IsPublishedMenuVersionStatus(version.Status))
                    .OrderByDescending(version => version.PublishedAt.HasValue)
                    .ThenByDescending(version => version.VersionNo)
                    .FirstOrDefault()
                    ?? versions.OrderByDescending(version => version.VersionNo).First();
                var target = MenuSchedulePolicy.ResolveRollbackTarget(versions, current, request);
                if (target is null)
                {
                    throw new ArgumentException("Không tìm thấy version trước đó để rollback.");
                }

                if (current.MenuVersionId.SequenceEqual(target.MenuVersionId))
                {
                    throw new ArgumentException("Version rollback phải khác version đang dùng.");
                }

                foreach (var activeVersion in versions.Where(version =>
                    MenuSchedulePolicy.IsPublishedMenuVersionStatus(version.Status) &&
                    !version.MenuVersionId.SequenceEqual(target.MenuVersionId)))
                {
                    AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), activeVersion.MenuVersionId,
                        nameof(MenuVersion.Status), activeVersion.Status, "SUPERSEDED", reason);
                    activeVersion.Status = "SUPERSEDED";
                    activeVersion.UpdatedAt = changedAt;
                }

                if (!string.Equals(target.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
                {
                    AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), target.MenuVersionId,
                        nameof(MenuVersion.Status), target.Status, "PUBLISHED", reason);
                }

                target.Status = "PUBLISHED";
                target.PublishedBy = actorId;
                target.PublishedAt = changedAt;
                target.UpdatedAt = changedAt;
                AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), target.MenuVersionId,
                    "Rollback", current.VersionNo.ToString(), target.VersionNo.ToString(), reason);

                var weekSchedules = (await _context.Menuschedules
                    .Where(schedule => schedule.WeekStartDate == weekStartDate)
                    .ToListAsync(cancellationToken))
                    .Where(schedule => schedule.CustomerId.SequenceEqual(customerId))
                    .ToList();
                foreach (var schedule in weekSchedules.Where(schedule =>
                    !string.Equals(schedule.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase)))
                {
                    AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuSchedule), schedule.MenuScheduleId,
                        nameof(MenuSchedule.Status), schedule.Status, "ACTIVE", reason);
                    schedule.Status = "ACTIVE";
                }

                var invalidated = await InvalidateWorkflowDocumentsForMenuRollbackAsync(
                    customerId,
                    weekStartDate,
                    target,
                    actorId,
                    changedAt,
                    reason);

                await _context.SaveChangesAsync(cancellationToken);

                transactionResult = new MenuVersionRollbackResultDto
                {
                    CustomerId = GuidHelper.ToGuidString(customerId),
                    WeekStartDate = weekStartDate.ToString("yyyy-MM-dd"),
                    ActiveMenuVersionId = GuidHelper.ToGuidString(target.MenuVersionId),
                    ActiveVersionNo = target.VersionNo,
                    RolledBackFromMenuVersionId = GuidHelper.ToGuidString(current.MenuVersionId),
                    RolledBackFromVersionNo = current.VersionNo,
                    CancelledDemandCount = invalidated.CancelledDemandCount,
                    CancelledPurchaseCount = invalidated.CancelledPurchaseCount,
                    Reason = reason
                };
                return transactionResult;
            },
            async cancellationToken =>
            {
                var targetId = GuidHelper.ParseGuidString(transactionResult?.ActiveMenuVersionId);
                if (targetId is null)
                {
                    return false;
                }

                var targetPublished = await _context.Menuversions
                    .AsNoTracking()
                    .AnyAsync(
                        version => version.MenuVersionId == targetId && version.Status == "PUBLISHED",
                        cancellationToken);
                var schedulesActive = await _context.Menuschedules
                    .AsNoTracking()
                    .Where(schedule => schedule.WeekStartDate == weekStartDate)
                    .Where(schedule => schedule.CustomerId.SequenceEqual(customerId))
                    .AllAsync(schedule => schedule.Status == "ACTIVE", cancellationToken);
                var hasActiveDemand = await _context.Materialrequests
                    .AsNoTracking()
                    .AnyAsync(request =>
                        request.Status != "CANCELLED" &&
                        request.Plan.WeekStartDate == weekStartDate &&
                        request.Plan.CustomerId != null &&
                        request.Plan.CustomerId.SequenceEqual(customerId),
                        cancellationToken);
                var hasActivePurchase = await _context.Purchaserequests
                    .AsNoTracking()
                    .AnyAsync(request =>
                        request.Status != "CANCELLED" &&
                        request.Purchaserequestlines.Any(line =>
                            line.MaterialRequestLine.Request.Plan.WeekStartDate == weekStartDate &&
                            line.MaterialRequestLine.Request.Plan.CustomerId != null &&
                            line.MaterialRequestLine.Request.Plan.CustomerId.SequenceEqual(customerId)),
                        cancellationToken);

                return targetPublished && schedulesActive && !hasActiveDemand && !hasActivePurchase;
            });
    }

    private async Task<MenuSchedule?> FindMenuScheduleForUpdateAsync(string menuScheduleId)
    {
        var scheduleIdBytes = GuidHelper.ParseGuidString(menuScheduleId);
        if (scheduleIdBytes is null)
        {
            return null;
        }

        return await _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
            .AsSplitQuery()
            .FirstOrDefaultAsync(schedule => schedule.MenuScheduleId == scheduleIdBytes);
    }

    private async Task<IReadOnlyList<MenuVersion>> LoadMenuVersionsAsync(IReadOnlyList<MenuSchedule> schedules)
    {
        if (schedules.Count == 0)
        {
            return [];
        }

        var minWeekStart = schedules.Min(schedule => schedule.WeekStartDate);
        var maxWeekStart = schedules.Max(schedule => schedule.WeekStartDate);
        var customerIds = schedules
            .Select(schedule => Convert.ToBase64String(schedule.CustomerId))
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);

        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate >= minWeekStart && version.WeekStartDate <= maxWeekStart)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();

        return versions
            .Where(version => customerIds.Contains(Convert.ToBase64String(version.CustomerId)))
            .ToList();
    }

    private async Task<MenuVersion?> GetLatestMenuVersionAsync(byte[] customerId, DateOnly weekStartDate)
    {
        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();

        return versions.FirstOrDefault(version => version.CustomerId.SequenceEqual(customerId));
    }

    private async Task<MenuVersion> EnsureMenuVersionAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        byte[] actorId,
        DateTime changedAt)
    {
        var versions = await _context.Menuversions
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();
        var customerVersions = versions
            .Where(version => version.CustomerId.SequenceEqual(customerId))
            .ToList();
        var version = customerVersions.FirstOrDefault();
        if (version is not null)
        {
            return version;
        }

        version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customerId,
            WeekStartDate = weekStartDate,
            VersionNo = customerVersions.Count == 0 ? 1 : customerVersions.Max(item => item.VersionNo) + 1,
            Status = "DRAFT",
            SourceImportBatch = $"LEGACY-{weekStartDate:yyyyMMdd}",
            CreatedBy = actorId,
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        _context.Menuversions.Add(version);
        AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), version.MenuVersionId,
            "VersionCreated", null, version.SourceImportBatch, "Tạo header version cho thực đơn tuần");
        return version;
    }

    private async Task<(int CancelledDemandCount, int CancelledPurchaseCount)> InvalidateWorkflowDocumentsForMenuRollbackAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        MenuVersion targetVersion,
        byte[] actorId,
        DateTime changedAt,
        string rollbackReason)
    {
        var reason = $"Rollback menu to V{targetVersion.VersionNo}: {rollbackReason}; regenerate demand required.";
        var materialRequests = await _context.Materialrequests
            .Include(request => request.Plan)
            .Where(request =>
                request.Status != "CANCELLED" &&
                request.Plan.WeekStartDate == weekStartDate &&
                request.Plan.CustomerId != null &&
                request.Plan.CustomerId.SequenceEqual(customerId))
            .ToListAsync();

        foreach (var request in materialRequests)
        {
            AddAudit(actorId, changedAt, "Demand", nameof(MaterialRequest), request.RequestId,
                nameof(MaterialRequest.Status), request.Status, "CANCELLED", reason);
            request.Status = "CANCELLED";
        }

        var purchaseRequests = await _context.Purchaserequests
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
                    .ThenInclude(line => line.Request)
                        .ThenInclude(materialRequest => materialRequest.Plan)
            .Where(request =>
                request.Status != "CANCELLED" &&
                request.Purchaserequestlines.Any(line =>
                    line.MaterialRequestLine.Request.Plan.WeekStartDate == weekStartDate &&
                    line.MaterialRequestLine.Request.Plan.CustomerId != null &&
                    line.MaterialRequestLine.Request.Plan.CustomerId.SequenceEqual(customerId)))
            .ToListAsync();

        foreach (var request in purchaseRequests)
        {
            AddAudit(actorId, changedAt, "Purchase", nameof(PurchaseRequest), request.PurchaseRequestId,
                nameof(PurchaseRequest.Status), request.Status, "CANCELLED", reason);
            request.Status = "CANCELLED";
        }

        return (materialRequests.Count, purchaseRequests.Count);
    }

    private static byte[] ResolveActorId(string? userId)
        => GuidHelper.ParseGuidString(userId) ?? GuidHelper.NewId();

    private void AddAudit(
        byte[] actorId,
        DateTime changedAt,
        string businessArea,
        string entityName,
        byte[] entityId,
        string fieldName,
        string? oldValue,
        string? newValue,
        string reason,
        string? correlationId = null)
    {
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = changedAt,
            ChangedBy = actorId,
            BusinessArea = businessArea,
            EntityName = entityName,
            EntityId = entityId,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason,
            CorrelationId = correlationId
        });
    }

    private static string ResolveCorrelationId(string? correlationId)
    {
        var value = string.IsNullOrWhiteSpace(correlationId)
            ? Guid.NewGuid().ToString("N")
            : correlationId.Trim();
        return value[..Math.Min(value.Length, 128)];
    }
}
