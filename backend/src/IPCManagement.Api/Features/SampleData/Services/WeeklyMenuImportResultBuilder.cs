using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuImportResultBuilder(IpcManagementContext context)
{
    public async Task<WeeklyMenuImportResultDto> BuildAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        bool committed,
        CancellationToken cancellationToken)
    {
        var existingDishes = await context.Dishes
            .Include(dish => dish.Dishboms)
            .ToListAsync(cancellationToken);
        var existingByName = existingDishes
            .GroupBy(
                dish => WeeklyMenuImportProjection.NormalizeDishMatchKey(dish.DishName),
                StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                WeeklyMenuImportProjection.SelectPreferredImportedDish,
                StringComparer.OrdinalIgnoreCase);

        var result = new WeeklyMenuImportResultDto
        {
            Committed = committed,
            FileName = plan.FileName,
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = plan.WeekStartDate,
            WeekEndDate = plan.WeekEndDate,
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = plan.SheetName,
                LabelColumn = plan.LabelColumn,
                DayColumns = plan.DayColumns
                    .Select(column => new WeeklyMenuImportColumnDto
                    {
                        Column = column.Column,
                        ServiceDate = column.ServiceDate,
                        Label = column.Label
                    })
                    .ToList(),
                Sections = plan.Sections.ToList(),
                RowsScanned = plan.RowsScanned,
                RowsImported = plan.Items.Count,
                RowsSkipped = plan.RowsSkipped
            },
            Warnings = plan.Warnings.ToList()
        };
        result.PreviewDiff = await BuildDiffAsync(plan, customer, cancellationToken);

        foreach (var parsedItem in plan.Items)
        {
            var key = WeeklyMenuImportProjection.NormalizeDishMatchKey(parsedItem.DishName);
            if (existingByName.TryGetValue(key, out var existingDish))
            {
                parsedItem.DishId = GuidHelper.ToGuidString(existingDish.DishId);
                parsedItem.ExistingDish = true;
            }

            result.Rows.Add(new WeeklyMenuImportRowDto
            {
                ServiceDate = parsedItem.ServiceDate,
                DayKey = parsedItem.DayKey,
                SourceRowNumber = parsedItem.SourceRowNumber,
                SourceColumn = parsedItem.SourceColumn,
                SourceSection = parsedItem.SectionLabel,
                SourceShift = parsedItem.SourceShift,
                DbShiftName = parsedItem.DbShiftName,
                Variant = parsedItem.VariantLabel,
                Slot = parsedItem.Slot,
                SlotLabel = parsedItem.SlotLabel,
                DishName = parsedItem.DishName,
                RowSpan = parsedItem.RowSpan,
                IsMergedContinuation = parsedItem.IsMergedContinuation,
                DishId = parsedItem.DishId,
                ExistingDish = parsedItem.ExistingDish
            });
        }

        result.Validation = WeeklyMenuImportValidationPolicy.Build(plan, result.Rows);
        WeeklyMenuImportProjection.BuildImportedWeeklyMenu(result, plan.Items);
        return result;
    }

    private async Task<WeeklyMenuImportDiffDto> BuildDiffAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        CancellationToken cancellationToken)
    {
        var existingSchedules = await context.Menuschedules
            .AsNoTracking()
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(menuItem => menuItem.Dish)
            .Where(schedule =>
                schedule.CustomerId.SequenceEqual(customer.CustomerId) &&
                schedule.WeekStartDate == plan.WeekStartDate)
            .ToListAsync(cancellationToken);

        var existingSlots = new Dictionary<string, WeeklyMenuImportDiffRowDto>(
            StringComparer.OrdinalIgnoreCase);
        foreach (var schedule in existingSchedules)
        {
            foreach (var item in schedule.Menu.Menuitems)
            {
                var slot = WeeklyMenuImportProjection.ParsePersistedDishSlot(item.DishSlot);
                var key = SlotKey(
                    schedule.ServiceDate,
                    schedule.ShiftName,
                    slot.VariantKey,
                    slot.Slot);
                existingSlots[key] = new WeeklyMenuImportDiffRowDto
                {
                    ServiceDate = schedule.ServiceDate.ToString("yyyy-MM-dd"),
                    ShiftName = schedule.ShiftName,
                    Variant = slot.VariantLabel,
                    Slot = slot.Slot,
                    CurrentDishName = item.Dish.DishName,
                    ChangeType = "removed"
                };
            }
        }

        var diff = new WeeklyMenuImportDiffDto();
        var importedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in plan.Items
            .OrderBy(item => item.ServiceDate)
            .ThenBy(item => item.DbShiftName)
            .ThenBy(item => item.SourceOrder))
        {
            var key = SlotKey(item.ServiceDate, item.DbShiftName, item.VariantKey, item.Slot);
            importedKeys.Add(key);
            var row = new WeeklyMenuImportDiffRowDto
            {
                ServiceDate = item.ServiceDate.ToString("yyyy-MM-dd"),
                ShiftName = item.DbShiftName,
                Variant = item.VariantLabel,
                Slot = item.Slot,
                ImportedDishName = item.DishName
            };

            if (!existingSlots.TryGetValue(key, out var existing))
            {
                row.ChangeType = "added";
                diff.AddedSlots++;
            }
            else if (string.Equals(
                existing.CurrentDishName,
                item.DishName,
                StringComparison.OrdinalIgnoreCase))
            {
                row.CurrentDishName = existing.CurrentDishName;
                row.ChangeType = "unchanged";
                diff.UnchangedSlots++;
            }
            else
            {
                row.CurrentDishName = existing.CurrentDishName;
                row.ChangeType = "changed";
                diff.ChangedSlots++;
            }

            diff.Rows.Add(row);
        }

        foreach (var removed in existingSlots
            .Where(slot => !importedKeys.Contains(slot.Key))
            .Select(slot => slot.Value))
        {
            diff.RemovedSlots++;
            diff.Rows.Add(removed);
        }

        return diff;
    }

    private static string SlotKey(
        DateOnly serviceDate,
        string shiftName,
        string variantKey,
        string slot)
        => $"{serviceDate:yyyyMMdd}|{shiftName.ToUpperInvariant()}|{variantKey.ToLowerInvariant()}|{slot.ToLowerInvariant()}";
}
