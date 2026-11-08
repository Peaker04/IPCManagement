using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Shared.Contracts;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuImportHistoryService(
    IpcManagementContext context,
    WeeklyMenuAuditActorResolver actorResolver) : IWeeklyMenuImportHistoryService
{
    public async Task<PagedResponseDto<WeeklyMenuImportHistoryItemDto>> GetWeeklyMenuImportHistoryAsync(
        string? customerId,
        DateOnly? fromDate,
        DateOnly? toDate,
        PagedRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var query = context.Menuversions
            .AsNoTracking()
            .Include(version => version.Customer)
            .AsQueryable();
        if (!string.IsNullOrWhiteSpace(customerId))
        {
            var customerBytes = GuidHelper.ParseGuidString(customerId)
                ?? throw new ArgumentException("Khách hàng không hợp lệ.");
            query = query.Where(version => version.CustomerId.SequenceEqual(customerBytes));
        }

        if (fromDate.HasValue) query = query.Where(version => version.WeekStartDate >= fromDate.Value);
        if (toDate.HasValue) query = query.Where(version => version.WeekStartDate <= toDate.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var pageQuery = query
            .OrderByDescending(version => version.CreatedAt)
            .ThenByDescending(version => version.MenuVersionId)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize);
        var versionRows = await (
                from version in pageQuery
                join user in context.Users.AsNoTracking()
                    on version.CreatedBy equals user.UserId into creators
                from creator in creators.DefaultIfEmpty()
                select new { Version = version, CreatedByName = creator == null ? null : creator.FullName })
            .ToListAsync(cancellationToken);
        var versions = versionRows.Select(row => row.Version).ToList();
        var versionIds = versions.Select(version => version.MenuVersionId).ToList();
        var schedules = versionIds.Count == 0
            ? []
            : await context.Menuschedules
                .AsNoTracking()
                .Where(schedule =>
                    schedule.MenuVersionId != null &&
                    versionIds.Any(id => schedule.MenuVersionId.SequenceEqual(id)))
                .Select(schedule => new ScheduleRollbackSnapshot(
                    schedule.MenuScheduleId,
                    schedule.MenuVersionId!,
                    schedule.ServiceDate,
                    schedule.Status))
                .ToListAsync(cancellationToken);
        var scheduleIds = schedules.Select(schedule => schedule.MenuScheduleId).ToList();
        var scheduleIdsWithQuantity = scheduleIds.Count == 0
            ? []
            : await context.Mealquantityplanlines
            .AsNoTracking()
                .Where(line => scheduleIds.Any(id => line.MenuScheduleId.SequenceEqual(id)))
                .Select(line => line.MenuScheduleId)
                .Distinct()
                .ToListAsync(cancellationToken);
        var scheduleIdsWithQuantitySet = scheduleIdsWithQuantity
            .Select(GuidHelper.ToGuidString)
            .ToHashSet(StringComparer.Ordinal);
        var schedulesByVersionId = schedules
            .GroupBy(schedule => GuidHelper.ToGuidString(schedule.MenuVersionId!))
            .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.Ordinal);

        var items = new List<WeeklyMenuImportHistoryItemDto>();
        foreach (var row in versionRows)
        {
            var version = row.Version;
            var versionId = GuidHelper.ToGuidString(version.MenuVersionId);
            schedulesByVersionId.TryGetValue(versionId, out var versionSchedules);
            var (canRollback, reason) = EvaluateRollbackEligibility(
                version,
                versionSchedules ?? [],
                scheduleIdsWithQuantitySet);
            items.Add(new WeeklyMenuImportHistoryItemDto
            {
                MenuVersionId = versionId,
                CustomerId = GuidHelper.ToGuidString(version.CustomerId),
                CustomerCode = version.Customer.CustomerCode,
                CustomerName = version.Customer.CustomerName,
                WeekStartDate = version.WeekStartDate,
                VersionNo = version.VersionNo,
                Status = version.Status,
                SourceFileName = version.SourceFileName,
                CreatedByName = row.CreatedByName,
                CreatedAt = version.CreatedAt,
                SuccessRowCount = version.SuccessRowCount,
                ErrorRowCount = version.ErrorRowCount,
                WarningRowCount = version.WarningRowCount,
                CanRollback = canRollback,
                CannotRollbackReason = reason
            });
        }

        return PagedResponseDto<WeeklyMenuImportHistoryItemDto>.Create(
            items,
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    private static (bool CanRollback, string? Reason) EvaluateRollbackEligibility(
        MenuVersion version,
        IReadOnlyList<ScheduleRollbackSnapshot> schedules,
        IReadOnlySet<string> scheduleIdsWithQuantity)
    {
        if (!string.Equals(version.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
        {
            return (false, $"Phiên import đã ở trạng thái {version.Status}, không thể rollback.");
        }

        if (schedules.Count == 0)
        {
            return (false, "Không tìm thấy lịch thực đơn nào thuộc phiên import này.");
        }

        var lockedSchedule = schedules.FirstOrDefault(schedule =>
            !string.Equals(schedule.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedSchedule is not null)
        {
            return (false,
                $"Lịch {lockedSchedule.ServiceDate:dd/MM/yyyy} đã ở trạng thái {lockedSchedule.Status}.");
        }

        var hasQuantityLines = schedules.Any(schedule =>
            scheduleIdsWithQuantity.Contains(GuidHelper.ToGuidString(schedule.MenuScheduleId)));
        return hasQuantityLines
            ? (false, "Đã có số suất liên kết với lịch thực đơn này.")
            : (true, null);
    }

    private sealed record ScheduleRollbackSnapshot(
        byte[] MenuScheduleId,
        byte[] MenuVersionId,
        DateOnly ServiceDate,
        string Status);

    public async Task<RollbackWeeklyMenuImportResultDto> RollbackWeeklyMenuImportAsync(
        string menuVersionId,
        string? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var versionBytes = GuidHelper.ParseGuidString(menuVersionId)
            ?? throw new ArgumentException("Phiên import không hợp lệ.");
        var version = await context.Menuversions.FirstOrDefaultAsync(
                item => item.MenuVersionId.SequenceEqual(versionBytes),
                cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên import.");
        var (canRollback, reason) = await EvaluateRollbackEligibilityAsync(version, cancellationToken);
        if (!canRollback)
        {
            throw new BusinessRuleException(reason ?? "Không thể rollback phiên import này.");
        }

        var schedules = await context.Menuschedules
            .Where(schedule =>
                schedule.MenuVersionId != null &&
                schedule.MenuVersionId.SequenceEqual(version.MenuVersionId))
            .ToListAsync(cancellationToken);
        var scheduleCountForScope = await context.Menuschedules
            .AsNoTracking()
            .CountAsync(schedule =>
                schedule.CustomerId.SequenceEqual(version.CustomerId) &&
                schedule.WeekStartDate == version.WeekStartDate,
                cancellationToken);
        var menuIds = schedules.Select(schedule => schedule.MenuId).ToList();
        var menuItems = await context.Menuitems
            .Where(item => menuIds.Any(id => item.MenuId.SequenceEqual(id)))
            .ToListAsync(cancellationToken);
        context.Menuitems.RemoveRange(menuItems);
        context.Menuschedules.RemoveRange(schedules);
        var menus = await context.Menus
            .Where(menu => menuIds.Any(id => menu.MenuId.SequenceEqual(id)))
            .ToListAsync(cancellationToken);
        context.Menus.RemoveRange(menus);
        if (scheduleCountForScope == schedules.Count)
        {
            var tier = await context.Customerweekmenutiers.FirstOrDefaultAsync(item =>
                    item.CustomerId.SequenceEqual(version.CustomerId) &&
                    item.WeekStartDate == version.WeekStartDate,
                cancellationToken);
            if (tier is not null)
            {
                context.Customerweekmenutiers.Remove(tier);
            }
        }

        var oldStatus = version.Status;
        version.Status = "ROLLED_BACK";
        version.UpdatedAt = DateTime.UtcNow;
        var actorId = await actorResolver.ResolveAsync(actorUserId, cancellationToken);
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = actorId,
            BusinessArea = "Menu",
            EntityName = nameof(MenuVersion),
            EntityId = version.MenuVersionId,
            FieldName = "Status",
            OldValue = oldStatus,
            NewValue = "ROLLED_BACK",
            Reason = $"Rollback lần import {version.SourceImportBatch} theo yêu cầu người dùng."
        });
        await context.SaveChangesAsync(cancellationToken);

        return new RollbackWeeklyMenuImportResultDto
        {
            MenuVersionId = menuVersionId,
            MenuSchedulesRemoved = schedules.Count
        };
    }

    private async Task<(bool CanRollback, string? Reason)> EvaluateRollbackEligibilityAsync(
        MenuVersion version,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(version.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
        {
            return (false, $"Phiên import đã ở trạng thái {version.Status}, không thể rollback.");
        }

        var schedules = await context.Menuschedules
            .AsNoTracking()
            .Where(schedule =>
                schedule.MenuVersionId != null &&
                schedule.MenuVersionId.SequenceEqual(version.MenuVersionId))
            .ToListAsync(cancellationToken);
        if (schedules.Count == 0)
        {
            return (false, "Không tìm thấy lịch thực đơn nào thuộc phiên import này.");
        }

        var lockedSchedule = schedules.FirstOrDefault(schedule =>
            !string.Equals(schedule.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedSchedule is not null)
        {
            return (false,
                $"Lịch {lockedSchedule.ServiceDate:dd/MM/yyyy} đã ở trạng thái {lockedSchedule.Status}.");
        }

        var scheduleIds = schedules.Select(schedule => schedule.MenuScheduleId).ToList();
        var hasQuantityLines = await context.Mealquantityplanlines
            .AsNoTracking()
            .AnyAsync(
                line => scheduleIds.Any(id => line.MenuScheduleId.SequenceEqual(id)),
                cancellationToken);
        return hasQuantityLines
            ? (false, "Đã có số suất liên kết với lịch thực đơn này.")
            : (true, null);
    }
}
