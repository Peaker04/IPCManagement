using System.Globalization;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuQueryService(
    IpcManagementContext context,
    WeeklyMenuCustomerResolver customerResolver) : IWeeklyMenuQueryService
{
    public async Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default)
        => await context.Customers
            .Where(customer => customer.IsActive != false)
            .OrderBy(customer => customer.CustomerCode)
            .Select(customer => new CoordinationCustomerOptionDto
            {
                CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
                CustomerCode = customer.CustomerCode,
                CustomerName = customer.CustomerName
            })
            .ToListAsync(cancellationToken);

    public async Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customer = await customerResolver.ResolveAsync(customerId, cancellationToken);
        var customerSchedules = context.Menuschedules
            .AsNoTracking()
            .Where(schedule => schedule.CustomerId.SequenceEqual(customer.CustomerId));

        var resolvedWeekStart = weekStartDate;
        if (resolvedWeekStart is null)
        {
            var latestSchedule = await customerSchedules
                .OrderByDescending(schedule => schedule.WeekStartDate)
                .ThenByDescending(schedule => schedule.ServiceDate)
                .FirstOrDefaultAsync(cancellationToken);
            if (latestSchedule is null)
            {
                return null;
            }

            resolvedWeekStart = latestSchedule.WeekStartDate;
        }

        var schedules = await customerSchedules
            .Where(schedule => schedule.WeekStartDate == resolvedWeekStart.Value)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(menuItem => menuItem.Dish)
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToListAsync(cancellationToken);
        if (schedules.Count == 0)
        {
            return null;
        }

        var parsedItems = new List<ParsedWeeklyMenuItem>();
        var rows = new List<WeeklyMenuImportRowDto>();
        foreach (var schedule in schedules)
        {
            var dayKey = WeeklyMenuImportProjection.DayKey(schedule.ServiceDate.DayOfWeek);
            foreach (var menuItem in schedule.Menu.Menuitems.OrderBy(item => item.DisplayOrder))
            {
                var slotInfo = WeeklyMenuImportProjection.ParsePersistedDishSlot(menuItem.DishSlot);
                var sourceShiftLabel = WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(schedule.ShiftName);
                var item = new ParsedWeeklyMenuItem
                {
                    SourceOrder = menuItem.DisplayOrder,
                    ServiceDate = schedule.ServiceDate,
                    DayKey = dayKey,
                    SectionLabel = $"MENU {slotInfo.VariantLabel.ToUpperInvariant()} {sourceShiftLabel.ToUpperInvariant()}",
                    SectionKey = $"{slotInfo.VariantKey}-{schedule.ShiftName.ToLowerInvariant()}",
                    SourceShift = schedule.ShiftName,
                    SourceShiftLabel = sourceShiftLabel,
                    DbShiftName = schedule.ShiftName,
                    VariantKey = slotInfo.VariantKey,
                    VariantLabel = slotInfo.VariantLabel,
                    Slot = slotInfo.Slot,
                    SlotLabel = slotInfo.SlotLabel,
                    DishName = menuItem.Dish.DishName,
                    DishId = GuidHelper.ToGuidString(menuItem.DishId),
                    ExistingDish = true
                };
                parsedItems.Add(item);
                rows.Add(ToRow(item));
            }
        }

        var result = new WeeklyMenuImportResultDto
        {
            Committed = true,
            FileName = "Persisted weekly menu",
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = resolvedWeekStart,
            WeekEndDate = schedules.Max(schedule => schedule.ServiceDate),
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = "Backend",
                LabelColumn = "DB",
                DayColumns = schedules
                    .GroupBy(schedule => schedule.ServiceDate)
                    .OrderBy(group => group.Key)
                    .Select(group => new WeeklyMenuImportColumnDto
                    {
                        Column = WeeklyMenuImportProjection.DayKey(group.Key.DayOfWeek),
                        ServiceDate = group.Key,
                        Label = group.Key.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                    })
                    .ToList(),
                Sections = parsedItems
                    .Select(item => item.SectionLabel)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                RowsScanned = parsedItems.Count,
                RowsImported = parsedItems.Count
            },
            Rows = rows
        };

        var version = await GetLatestMenuVersionAsync(
            customer.CustomerId,
            resolvedWeekStart.Value,
            cancellationToken);
        WeeklyMenuImportProjection.ApplyMenuVersion(result, version);
        WeeklyMenuImportProjection.BuildImportedWeeklyMenu(result, parsedItems);
        return result;
    }

    private async Task<MenuVersion?> GetLatestMenuVersionAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        CancellationToken cancellationToken)
    {
        var versions = await context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync(cancellationToken);
        return versions.FirstOrDefault(version => version.CustomerId.SequenceEqual(customerId));
    }

    private static WeeklyMenuImportRowDto ToRow(ParsedWeeklyMenuItem item)
        => new()
        {
            ServiceDate = item.ServiceDate,
            DayKey = item.DayKey,
            SourceRowNumber = item.SourceRowNumber,
            SourceColumn = item.SourceColumn,
            SourceSection = item.SectionLabel,
            SourceShift = item.SourceShift,
            DbShiftName = item.DbShiftName,
            Variant = item.VariantLabel,
            Slot = item.Slot,
            SlotLabel = item.SlotLabel,
            DishName = item.DishName,
            RowSpan = item.RowSpan,
            IsMergedContinuation = item.IsMergedContinuation,
            DishId = item.DishId,
            ExistingDish = true
        };
}
