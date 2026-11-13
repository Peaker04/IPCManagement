using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class MrxEditScopeQuery(IpcManagementContext context)
{
    public async Task<MrxEditScopeDto?> GetAsync(
        string customerId,
        DateOnly weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customerKey = GuidHelper.ParseGuidString(customerId)
            ?? throw new ArgumentException("CustomerId không hợp lệ.");
        var batches = await (
                from candidate in context.Reconciliationbatches.AsNoTracking()
                join sourceVersion in context.Menuversions.AsNoTracking() on candidate.MenuVersionId equals sourceVersion.MenuVersionId
                where sourceVersion.CustomerId == customerKey && sourceVersion.WeekStartDate == weekStartDate
                select candidate)
            .ToListAsync(cancellationToken);
        if (batches.Count > 1)
            throw new BusinessRuleException("Tuần có nhiều lô đối soát; không xác định được nguồn chỉnh sửa.");

        var batch = batches.SingleOrDefault();
        var version = batch is null
            ? await context.Menuversions.AsNoTracking()
                .Where(item => item.CustomerId == customerKey && item.WeekStartDate == weekStartDate)
                .OrderByDescending(item => item.VersionNo)
                .FirstOrDefaultAsync(cancellationToken)
            : await context.Menuversions.AsNoTracking()
                .SingleAsync(item => item.MenuVersionId == batch.MenuVersionId, cancellationToken);
        if (version is null) return null;

        var schedules = await context.Menuschedules.AsNoTracking()
            .Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
            .Include(item => item.Mealquantityplanlines).ThenInclude(line => line.QuantityPlan)
            .Where(item => item.CustomerId == customerKey
                && item.WeekStartDate == weekStartDate
                && item.MenuVersionId == version.MenuVersionId)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        IReadOnlySet<DateOnly> lockedDates = batch is null
            ? new HashSet<DateOnly>()
            : batch.Status == "COMPLETED"
                ? schedules.Select(item => item.ServiceDate).ToHashSet()
                : await MrxDayLockReader.GetLockedDatesAsync(context, batch.BatchId, cancellationToken);

        var days = schedules
            .GroupBy(item => item.ServiceDate)
            .OrderBy(group => group.Key)
            .Select(dayGroup =>
            {
                var historicalSunday = !ServiceCalendar.IsServiceDay(dayGroup.Key);
                var isLocked = historicalSunday || batch?.Status == "COMPLETED" || lockedDates.Contains(dayGroup.Key);
                var reason = historicalSunday ? "Chủ nhật lịch sử · Chỉ xem" : !isLocked ? null : batch?.Status == "COMPLETED" ? "Lô đã hoàn tất" : "Đã xuất kho";
                var shifts = dayGroup
                    .GroupBy(item => item.ShiftName, StringComparer.OrdinalIgnoreCase)
                    .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(shiftGroup =>
                    {
                        var quantity = shiftGroup.SelectMany(item => item.Mealquantityplanlines)
                            .Where(line => batch?.QuantityImportBatchId is null
                                || (line.QuantityPlan?.ImportBatchId is not null
                                    && line.QuantityPlan.ImportBatchId.AsSpan().SequenceEqual(batch.QuantityImportBatchId)))
                            .OrderByDescending(item => item.UpdatedAt)
                            .FirstOrDefault();
                        var slots = shiftGroup.SelectMany(item => item.Menu.Menuitems)
                            .OrderBy(item => item.DisplayOrder)
                            .Select(item =>
                            {
                                var slot = WeeklyMenuImportProjection.ParsePersistedDishSlot(item.DishSlot);
                                return new MrxEditScopeSlotDto(
                                    item.DishSlot ?? $"{slot.VariantKey}-{slot.Slot}",
                                    slot.VariantKey,
                                    slot.SlotLabel,
                                    GuidHelper.ToGuidString(item.DishId),
                                    item.Dish?.DishCode,
                                    item.Dish?.DishName);
                            }).ToList();
                        return new MrxEditScopeShiftDto(
                            shiftGroup.Key,
                            quantity?.SavoryServings,
                            quantity?.VegetarianServings,
                            slots);
                    }).ToList();
                return new MrxEditScopeDayDto(dayGroup.Key, isLocked, reason, shifts);
            }).ToList();

        return new MrxEditScopeDto(
            batch is null ? null : GuidHelper.ToGuidString(batch.BatchId),
            batch?.Status,
            batch?.Version,
            GuidHelper.ToGuidString(version.MenuVersionId),
            days);
    }
}
