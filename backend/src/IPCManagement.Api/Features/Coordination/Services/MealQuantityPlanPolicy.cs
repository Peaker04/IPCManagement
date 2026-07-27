using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class MealQuantityPlanPolicy
{
    internal static MealQuantityPlanDto MapMealQuantityPlan(
        MealQuantityPlan plan,
        string? shiftName = null,
        byte[]? customerId = null)
        => new()
        {
            QuantityPlanId = GuidHelper.ToGuidString(plan.QuantityPlanId),
            PlanCode = plan.PlanCode,
            ServiceDate = plan.ServiceDate.ToString("yyyy-MM-dd"),
            DayOfWeek = ToDayCode(plan.ServiceDate),
            Status = plan.Status,
            ForecastReceivedAt = plan.ForecastReceivedAt,
            ConfirmedAt = plan.ConfirmedAt,
            Lines = plan.Mealquantityplanlines
                .Where(line =>
                    (shiftName is null || line.ShiftName == shiftName) &&
                    (customerId is null || line.CustomerId.SequenceEqual(customerId)))
                .OrderBy(line => line.ShiftName)
                .ThenBy(line => line.Customer.CustomerCode)
                .Select(line => new MealQuantityPlanLineDto
                {
                    QuantityPlanLineId = GuidHelper.ToGuidString(line.QuantityPlanLineId),
                    MenuScheduleId = GuidHelper.ToGuidString(line.MenuScheduleId),
                    CustomerId = GuidHelper.ToGuidString(line.CustomerId),
                    CustomerCode = line.Customer.CustomerCode,
                    CustomerName = line.Customer.CustomerName,
                    MenuId = GuidHelper.ToGuidString(line.MenuId),
                    MenuCode = line.Menu.MenuCode,
                    MenuName = line.Menu.MenuName,
                    ShiftName = line.ShiftName,
                    Shift = ToDisplayShift(line.ShiftName),
                    ForecastServings = line.ForecastServings,
                    ConfirmedServings = line.ConfirmedServings,
                    AdjustedServings = line.AdjustedServings,
                    FinalServings = line.FinalServings
                })
                .ToList()
        };

    internal static string BuildQuickServingPlanCode(
        DateOnly serviceDate,
        string shiftName,
        string customerCode)
    {
        var safeCustomerCode = new string((customerCode ?? "CUS")
            .Where(char.IsLetterOrDigit)
            .Take(22)
            .ToArray());
        if (string.IsNullOrWhiteSpace(safeCustomerCode))
        {
            safeCustomerCode = "CUS";
        }

        var shiftCode = string.Equals(shiftName, "AFTERNOON", StringComparison.OrdinalIgnoreCase) ? "A" : "M";
        return $"QTYK-{serviceDate:yyyyMMdd}-{shiftCode}-{safeCustomerCode}";
    }

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
