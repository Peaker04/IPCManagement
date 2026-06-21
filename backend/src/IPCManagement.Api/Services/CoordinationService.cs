using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class CoordinationService : ICoordinationService
{
    private readonly IpcManagementContext _context;

    public CoordinationService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query)
    {
        var serviceDate = ResolveServiceDate(query.ServiceDate, query.DayOfWeek);
        var shiftName = NormalizeShiftName(query.ShiftName ?? query.Shift)
            ?? throw new ArgumentException("Ca phục vụ không hợp lệ.");

        var lines = await QueryLines(serviceDate, shiftName)
            .AsNoTracking()
            .OrderBy(line => line.Customer.CustomerCode)
            .ToListAsync();

        return lines.Select(MapOrder).ToList();
    }

    public async Task<LockOrderPlanResultDto?> LockOrderPlanAsync(
        LockOrderPlanRequestDto request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null)
        {
            return null;
        }

        var serviceDate = ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var scope = NormalizeScope(request.Scope);
        var shiftName = NormalizeShiftName(request.ShiftName ?? request.Shift);

        if (scope != "FULLDAY" && shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        var requestedServings = request.Lines
            .Select(line => new
            {
                Id = GuidHelper.ParseGuidString(
                    !string.IsNullOrWhiteSpace(line.QuantityPlanLineId)
                        ? line.QuantityPlanLineId
                        : line.OrderId),
                Servings = line.FinalServings ?? line.ActualQuantity
            })
            .Where(line => line.Id is not null && line.Servings is not null)
            .ToDictionary(
                line => Convert.ToBase64String(line.Id!),
                line => line.Servings!.Value);

        var lines = await QueryLines(serviceDate, scope == "FULLDAY" ? null : shiftName)
            .ToListAsync();

        if (lines.Count == 0)
        {
            return null;
        }

        var lockedAt = DateTime.UtcNow;
        foreach (var line in lines)
        {
            var lineKey = Convert.ToBase64String(line.QuantityPlanLineId);
            var finalServings = requestedServings.GetValueOrDefault(lineKey, line.ForecastServings);

            line.ConfirmedServings = finalServings;
            line.AdjustedServings = 0;
            line.FinalServings = finalServings;
            line.QuantityPlan.Status = "CONFIRMED";
            line.QuantityPlan.ConfirmedAt = lockedAt;
            line.QuantityPlan.ConfirmationTime = TimeOnly.FromDateTime(lockedAt);
            line.QuantityPlan.ConfirmedBy = userIdBytes;
        }

        await _context.SaveChangesAsync();

        return new LockOrderPlanResultDto
        {
            Success = true,
            LockedAt = lockedAt,
            ServiceDate = serviceDate.ToString("yyyy-MM-dd"),
            Scope = scope,
            LockedShiftNames = lines
                .Select(line => line.ShiftName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(shift => shift)
                .ToList(),
            LockedLineCount = lines.Count
        };
    }

    public async Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(
        AdjustOrderAfterLockRequestDto request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var lineId = GuidHelper.ParseGuidString(
            !string.IsNullOrWhiteSpace(request.QuantityPlanLineId)
                ? request.QuantityPlanLineId
                : request.OrderId);
        if (userIdBytes is null || lineId is null)
        {
            return null;
        }

        if (!string.Equals(request.Field, "actualQuantity", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Field, "finalServings", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Chỉ hỗ trợ điều chỉnh số suất thực tế sau khi chốt.");
        }

        var line = await _context.Mealquantityplanlines
            .Include(item => item.QuantityPlan)
            .FirstOrDefaultAsync(item => item.QuantityPlanLineId == lineId);

        if (line is null)
        {
            return null;
        }

        if (!string.Equals(line.QuantityPlan.Status, "CONFIRMED", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Chỉ có thể điều chỉnh sau khi kế hoạch đã được chốt.");
        }

        var oldValue = line.FinalServings;
        line.AdjustedServings = request.NewValue - line.ConfirmedServings;
        line.FinalServings = request.NewValue;

        _context.Quantityadjustments.Add(new Quantityadjustment
        {
            AdjustmentId = GuidHelper.NewId(),
            QuantityPlanLineId = line.QuantityPlanLineId,
            OldServings = oldValue,
            NewServings = request.NewValue,
            Reason = request.Reason,
            AdjustedBy = userIdBytes,
            AdjustedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return new AdjustOrderAfterLockResultDto
        {
            Success = true,
            Timestamp = DateTime.UtcNow
        };
    }

    public Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequestDto request)
    {
        var serviceDate = ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = NormalizeShiftName(request.ShiftName ?? request.Shift);
        var query = new List<string>
        {
            $"serviceDate={Uri.EscapeDataString(serviceDate.ToString("yyyy-MM-dd"))}",
            $"format={Uri.EscapeDataString(request.Format)}"
        };

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            query.Add($"shiftName={Uri.EscapeDataString(shiftName)}");
        }

        return Task.FromResult(new ExportOrderReportResultDto
        {
            Success = true,
            DownloadUrl = $"/api/workflow-reports/order-export?{string.Join("&", query)}"
        });
    }

    private IQueryable<Mealquantityplanline> QueryLines(DateOnly serviceDate, string? shiftName)
    {
        var query = _context.Mealquantityplanlines
            .Include(line => line.Customer)
            .Include(line => line.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
            .Include(line => line.MenuSchedule)
            .Include(line => line.QuantityPlan)
            .Where(line => line.QuantityPlan.ServiceDate == serviceDate)
            .AsSplitQuery();

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            query = query.Where(line => line.ShiftName == shiftName);
        }

        return query;
    }

    private static CoordinationOrderDto MapOrder(Mealquantityplanline line)
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
            AppliedRate = line.MenuSchedule.BomRatePercent,
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
                    DishName = item.Dish.DishName
                })
                .ToList(),
            DishId = line.Menu.Menuitems
                .OrderBy(item => item.DisplayOrder)
                .Select(item => GuidHelper.ToGuidString(item.DishId))
                .FirstOrDefault() ?? string.Empty
        };

    private static DateOnly ResolveServiceDate(string? serviceDate, string? dayOfWeek)
    {
        if (!string.IsNullOrWhiteSpace(serviceDate) &&
            DateOnly.TryParse(serviceDate, out var parsedServiceDate))
        {
            return parsedServiceDate;
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var offsetFromMonday = ((int)today.DayOfWeek + 6) % 7;
        var monday = today.AddDays(-offsetFromMonday);

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

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    private static string NormalizeScope(string? scope)
    {
        var normalized = (scope ?? string.Empty).Trim().ToUpperInvariant();
        return normalized is "MORNING" or "AFTERNOON" ? normalized : "FULLDAY";
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
