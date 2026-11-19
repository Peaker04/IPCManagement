using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed record MrxBomOccurrence(DateOnly ServiceDate, string ShiftName);
public sealed record MrxBomMissingInterval(DateOnly EffectiveFrom, DateOnly? EffectiveTo);
public sealed record MrxMissingBomDish(string DishId, string DishCode, string DishName,
    IReadOnlyList<MrxBomOccurrence> Occurrences, IReadOnlyList<MrxBomMissingInterval> Intervals)
{
    internal static MrxMissingBomDish Create(Dish dish, decimal tier, IEnumerable<MrxBomOccurrence> occurrences)
    {
        var ordered = occurrences.Distinct().OrderBy(item => item.ServiceDate)
            .ThenBy(item => item.ShiftName, StringComparer.Ordinal).ToList();
        var days = ordered.Select(item => item.ServiceDate).Distinct().ToArray();
        var intervals = new List<MrxBomMissingInterval>();
        for (var i = 0; i < days.Length;)
        {
            var start = days[i];
            var end = start;
            while (++i < days.Length && days[i].DayNumber == end.DayNumber + 1)
                end = days[i];
            if (i < days.Length)
            {
                intervals.Add(new(start, end));
                continue;
            }

            // The final gap can supply future menus until the next existing shared recipe.
            var nextStart = dish.Dishboms.Where(line => line.CustomerId is null && line.PriceTierAmount == tier
                && DishBomPolicy.IsPublished(line) && line.EffectiveFrom > end)
                .Select(line => (DateOnly?)line.EffectiveFrom).Min();
            intervals.Add(new(start, nextStart?.AddDays(-1)));
        }
        return new(GuidHelper.ToGuidString(dish.DishId), dish.DishCode, dish.DishName, ordered, intervals);
    }
}

public sealed record MrxWeeklyBomCoverage(string CustomerId, DateOnly WeekStartDate, string MenuVersionId,
    decimal PriceTierAmount, IReadOnlyList<MrxMissingBomDish> MissingDishes);

public sealed class MrxWeeklyBomCoverageQuery(IpcManagementContext context)
{
    public async Task<MrxWeeklyBomCoverage> ReadAsync(string? customerId,
        DateOnly? weekStartDate, string? menuVersionId, CancellationToken token)
    {
        var customer = GuidHelper.ParseGuidString(customerId);
        var version = GuidHelper.ParseGuidString(menuVersionId);
        if (customer is null || version is null || weekStartDate is null)
            throw new ArgumentException("Cần khách hàng, tuần và phiên bản thực đơn để kiểm tra BOM.");

        var schedules = await context.Menuschedules.AsNoTracking()
            .Where(schedule => schedule.CustomerId == customer && schedule.WeekStartDate == weekStartDate)
            .Include(schedule => schedule.Menu).ThenInclude(menu => menu.Menuitems)
                .ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms)
            .AsSplitQuery().ToListAsync(token);

        if (schedules.Count == 0 || schedules.Any(schedule =>
            schedule.MenuVersionId is null || !schedule.MenuVersionId.AsSpan().SequenceEqual(version)))
            throw new ArgumentException("Phiên bản thực đơn của tuần đã thay đổi hoặc chưa có. Vui lòng tải lại.");

        var tiers = schedules.Select(schedule => schedule.MenuPrice).Distinct().ToArray();
        if (tiers.Length != 1 || !MenuPriceTierPolicy.SupportedPriceTiers.Contains(tiers[0]))
            throw new ArgumentException("Các lịch trong tuần cần cùng một mốc giá BOM hợp lệ.");

        var missing = schedules.SelectMany(schedule => schedule.Menu.Menuitems
                .Where(item => BomSelectionResolver.Resolve(item.Dish.Dishboms, customer, tiers[0], schedule.ServiceDate).Count == 0)
                .Select(item => new { item.Dish, Occurrence = new MrxBomOccurrence(schedule.ServiceDate, schedule.ShiftName) }))
            .GroupBy(item => GuidHelper.ToGuidString(item.Dish.DishId))
            .Select(group => MrxMissingBomDish.Create(group.First().Dish, tiers[0], group.Select(item => item.Occurrence)))
            .OrderBy(item => item.Occurrences[0].ServiceDate).ThenBy(item => item.DishCode, StringComparer.Ordinal)
            .ToList();
        return new(GuidHelper.ToGuidString(customer), weekStartDate.Value, GuidHelper.ToGuidString(version), tiers[0], missing);
    }
}
