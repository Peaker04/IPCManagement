using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class OrderLifecyclePolicy
{
    private const decimal FixedBomRatePercent = 100m;

    internal static DateOnly ResolveServiceDate(string? serviceDate, string? dayOfWeek)
    {
        if (!string.IsNullOrWhiteSpace(serviceDate) &&
            DateOnly.TryParse(serviceDate, out var parsedServiceDate))
        {
            return parsedServiceDate;
        }

        var monday = ServiceCalendar.StartOfWeek(ServiceCalendar.Today());
        var dayOffset = (dayOfWeek ?? string.Empty).ToLowerInvariant() switch
        {
            "t2" => 0,
            "t3" => 1,
            "t4" => 2,
            "t5" => 3,
            "t6" => 4,
            "t7" => 5,
            "cn" => 6,
            _ => throw new ArgumentException("Ngày trong tuần không hợp lệ.")
        };

        return monday.AddDays(dayOffset);
    }

    internal static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    internal static string NormalizeScope(string? scope)
    {
        var normalized = (scope ?? string.Empty).Trim().ToUpperInvariant();
        return normalized is "MORNING" or "AFTERNOON" ? normalized : "FULLDAY";
    }

    internal static CoordinationOrderDto MapOrder(MealQuantityPlanLine line)
        => new()
        {
            Id = GuidHelper.ToGuidString(line.QuantityPlanLineId),
            QuantityPlanLineId = GuidHelper.ToGuidString(line.QuantityPlanLineId),
            QuantityPlanId = GuidHelper.ToGuidString(line.QuantityPlanId),
            MenuScheduleId = GuidHelper.ToGuidString(line.MenuScheduleId),
            CustomerId = GuidHelper.ToGuidString(line.CustomerId),
            CustomerCode = line.Customer.CustomerCode,
            CustomerName = line.Customer.CustomerName,
            MealType = line.Menu.MenuName,
            ForecastQuantity = line.ForecastServings,
            ActualQuantity = line.FinalServings,
            UnitPrice = line.MenuSchedule.MenuPrice,
            AppliedRate = FixedBomRatePercent,
            SpecialNotes = line.Customer.Note ?? string.Empty,
            ServiceDate = line.QuantityPlan.ServiceDate.ToString("yyyy-MM-dd"),
            DayOfWeek = ToDayCode(line.QuantityPlan.ServiceDate),
            ShiftName = line.ShiftName,
            Shift = ToDisplayShift(line.ShiftName),
            MenuId = GuidHelper.ToGuidString(line.MenuId),
            MenuCode = line.Menu.MenuCode,
            MenuName = line.Menu.MenuName,
            Dishes = line.Menu.Menuitems
                .OrderBy(item => item.DisplayOrder)
                .Select(item => new CoordinationDishDto
                {
                    DishId = GuidHelper.ToGuidString(item.DishId),
                    DishCode = item.Dish.DishCode,
                    DishName = item.Dish.DishName,
                    DishSlot = item.DishSlot,
                    DishGroup = item.Dish.DishGroup,
                    DishType = item.Dish.DishType,
                    DisplayOrder = item.DisplayOrder
                })
                .ToList(),
            DishId = line.Menu.Menuitems
                .OrderBy(item => item.DisplayOrder)
                .Select(item => GuidHelper.ToGuidString(item.DishId))
                .FirstOrDefault() ?? string.Empty
        };

    private static string ToDisplayShift(string shiftName)
        => string.Equals(shiftName, "MORNING", StringComparison.OrdinalIgnoreCase)
            ? "Ca Sáng"
            : "Ca Chiều";

    private static string ToDayCode(DateOnly serviceDate)
        => serviceDate.DayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            _ => "cn"
        };
}
