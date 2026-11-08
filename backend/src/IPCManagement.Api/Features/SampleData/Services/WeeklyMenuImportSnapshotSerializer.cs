using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class WeeklyMenuImportSnapshotSerializer
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static WeeklyMenuImportSnapshotDto FromPlan(
        MenuVersion version,
        WeeklyMenuImportPlan plan,
        decimal priceTierAmount) =>
        new()
        {
            MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId),
            CustomerId = GuidHelper.ToGuidString(version.CustomerId),
            WeekStartDate = version.WeekStartDate,
            PriceTierAmount = DecimalPolicy.RoundMoney(priceTierAmount),
            Rows = Order(plan.Items.Select(item => new WeeklyMenuImportSnapshotRowDto
            {
                ServiceDate = item.ServiceDate,
                ShiftName = item.DbShiftName,
                DishSlot = $"{item.VariantKey}-{item.Slot}",
                DishId = item.DishId ?? throw new InvalidOperationException("Committed import snapshot requires persisted dish identity."),
                DishName = item.DishName,
                SourceOrder = item.SourceOrder
            }))
        };

    public static async Task<WeeklyMenuImportSnapshotDto> FromSchedulesAsync(
        IpcManagementContext context,
        MenuVersion version,
        IEnumerable<MenuSchedule> schedules,
        CancellationToken token)
    {
        var scheduleList = schedules.ToList();
        var dishIds = scheduleList.SelectMany(schedule => schedule.Menu.Menuitems)
            .Select(item => item.DishId).DistinctBy(Convert.ToHexString).ToList();
        var dishNames = await context.Dishes.AsNoTracking().Where(dish => dishIds.Contains(dish.DishId))
            .ToDictionaryAsync(dish => Convert.ToHexString(dish.DishId), dish => dish.DishName, StringComparer.Ordinal, token);
        return FromSchedules(version, scheduleList, dishNames);
    }

    public static WeeklyMenuImportSnapshotDto FromSchedules(
        MenuVersion version,
        IEnumerable<MenuSchedule> schedules,
        IReadOnlyDictionary<string, string> dishNames) =>
        new()
        {
            MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId),
            CustomerId = GuidHelper.ToGuidString(version.CustomerId),
            WeekStartDate = version.WeekStartDate,
            PriceTierAmount = schedules.Select(schedule => (decimal?)schedule.MenuPrice).Distinct().SingleOrDefault(),
            Rows = Order(schedules.SelectMany(schedule => schedule.Menu.Menuitems.Select(item =>
                new WeeklyMenuImportSnapshotRowDto
                {
                    ServiceDate = schedule.ServiceDate,
                    ShiftName = schedule.ShiftName,
                    DishSlot = item.DishSlot ?? string.Empty,
                    DishId = GuidHelper.ToGuidString(item.DishId!),
                    DishName = dishNames.GetValueOrDefault(Convert.ToHexString(item.DishId!), "Không rõ tên món"),
                    SourceOrder = item.DisplayOrder
                })))
        };

    public static async Task<WeeklyMenuImportSnapshotDto> FromPersistedProjectionAsync(
        IpcManagementContext context,
        MenuVersion version,
        CancellationToken token)
    {
        var schedules = await context.Menuschedules.AsNoTracking()
            .Where(schedule => schedule.MenuVersionId != null && schedule.MenuVersionId == version.MenuVersionId)
            .Include(schedule => schedule.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
            .ToListAsync(token);
        var tier = await context.Customerweekmenutiers.AsNoTracking()
            .Where(item => item.CustomerId == version.CustomerId && item.WeekStartDate == version.WeekStartDate)
            .Select(item => (decimal?)item.PriceTierAmount)
            .SingleOrDefaultAsync(token);
        return new WeeklyMenuImportSnapshotDto
        {
            MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId),
            CustomerId = GuidHelper.ToGuidString(version.CustomerId),
            WeekStartDate = version.WeekStartDate,
            PriceTierAmount = tier,
            Rows = Order(schedules.SelectMany(schedule => schedule.Menu.Menuitems.Select(item =>
                new WeeklyMenuImportSnapshotRowDto
                {
                    ServiceDate = schedule.ServiceDate,
                    ShiftName = schedule.ShiftName,
                    DishSlot = item.DishSlot ?? string.Empty,
                    DishId = GuidHelper.ToGuidString(item.DishId!),
                    DishName = item.Dish.DishName,
                    SourceOrder = item.DisplayOrder
                })))
        };
    }

    public static string Serialize(WeeklyMenuImportSnapshotDto snapshot) =>
        JsonSerializer.Serialize(snapshot, Options);

    public static WeeklyMenuImportSnapshotDto Deserialize(string json) =>
        JsonSerializer.Deserialize<WeeklyMenuImportSnapshotDto>(json, Options)
        ?? throw new InvalidOperationException("Snapshot nguồn import không hợp lệ.");

    private static IReadOnlyList<WeeklyMenuImportSnapshotRowDto> Order(
        IEnumerable<WeeklyMenuImportSnapshotRowDto> rows) => rows
        .OrderBy(row => row.ServiceDate)
        .ThenBy(row => row.ShiftName, StringComparer.Ordinal)
        .ThenBy(row => row.SourceOrder)
        .ThenBy(row => row.DishSlot, StringComparer.Ordinal)
        .ToList();
}
