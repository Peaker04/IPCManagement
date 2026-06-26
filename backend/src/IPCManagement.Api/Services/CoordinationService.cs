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

    // ── BE-3.2: GET /api/menu-schedules ─────────────────────────────────────

    public async Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query)
    {
        var dbQuery = _context.Menuschedules
            .Include(ms => ms.Menu)
                .ThenInclude(m => m.Menuitems)
                    .ThenInclude(mi => mi.Dish)
            .AsNoTracking()
            .AsQueryable();

        // Lọc theo ngày phục vụ cụ thể
        if (!string.IsNullOrWhiteSpace(query.ServiceDate) &&
            DateOnly.TryParse(query.ServiceDate, out var parsedServiceDate))
        {
            dbQuery = dbQuery.Where(ms => ms.ServiceDate == parsedServiceDate);
        }
        // Lọc theo ngày trong tuần
        else if (!string.IsNullOrWhiteSpace(query.DayOfWeek))
        {
            var serviceDate = ResolveServiceDate(null, query.DayOfWeek);
            dbQuery = dbQuery.Where(ms => ms.ServiceDate == serviceDate);
        }
        // Lọc theo tuần
        else if (!string.IsNullOrWhiteSpace(query.WeekStartDate) &&
                 DateOnly.TryParse(query.WeekStartDate, out var weekStart))
        {
            var weekEnd = weekStart.AddDays(6);
            dbQuery = dbQuery.Where(ms => ms.ServiceDate >= weekStart && ms.ServiceDate <= weekEnd);
        }

        // Lọc theo ca
        if (!string.IsNullOrWhiteSpace(query.ShiftName))
        {
            var normalized = NormalizeShiftName(query.ShiftName);
            if (normalized is not null)
                dbQuery = dbQuery.Where(ms => ms.ShiftName == normalized);
        }

        var schedules = await dbQuery
            .OrderBy(ms => ms.ServiceDate)
            .ThenBy(ms => ms.ShiftName)
            .ToListAsync();

        return schedules.Select(ms => new MenuScheduleDto
        {
            MenuScheduleId  = GuidHelper.ToGuidString(ms.MenuScheduleId),
            MenuId          = GuidHelper.ToGuidString(ms.MenuId),
            MenuCode        = ms.Menu.MenuCode,
            MenuName        = ms.Menu.MenuName,
            ServiceDate     = ms.ServiceDate.ToString("yyyy-MM-dd"),
            WeekStartDate   = ms.WeekStartDate.ToString("yyyy-MM-dd"),
            ShiftName       = ms.ShiftName,
            Shift           = ToDisplayShift(ms.ShiftName),
            DayOfWeek       = ToDayCode(ms.ServiceDate),
            MenuPrice       = ms.MenuPrice,
            BomRatePercent  = ms.BomRatePercent,
            Status          = ms.Status,
            Dishes          = ms.Menu.Menuitems
                .OrderBy(mi => mi.DisplayOrder)
                .Select(mi => new MenuScheduleDishDto
                {
                    DishId       = GuidHelper.ToGuidString(mi.DishId),
                    DishCode     = mi.Dish.DishCode,
                    DishName     = mi.Dish.DishName,
                    DishGroup    = mi.Dish.DishGroup,
                    DishType     = mi.Dish.DishType,
                    DisplayOrder = mi.DisplayOrder
                })
                .ToList()
        }).ToList();
    }

    // ── BE-3.3: GET /api/meal-quantity-plans ────────────────────────────────

    public async Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query)
    {
        var dbQuery = _context.Mealquantityplans
            .Include(p => p.Mealquantityplanlines)
                .ThenInclude(l => l.Menu)
            .Include(p => p.Mealquantityplanlines)
                .ThenInclude(l => l.MenuSchedule)
            .AsNoTracking()
            .AsQueryable();

        // Lọc theo ngày phục vụ
        if (!string.IsNullOrWhiteSpace(query.ServiceDate) &&
            DateOnly.TryParse(query.ServiceDate, out var parsedServiceDate))
        {
            dbQuery = dbQuery.Where(p => p.ServiceDate == parsedServiceDate);
        }
        else if (!string.IsNullOrWhiteSpace(query.DayOfWeek))
        {
            var serviceDate = ResolveServiceDate(null, query.DayOfWeek);
            dbQuery = dbQuery.Where(p => p.ServiceDate == serviceDate);
        }

        // Lọc theo trạng thái
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToUpperInvariant();
            dbQuery = dbQuery.Where(p => p.Status == status);
        }

        var plans = await dbQuery
            .OrderByDescending(p => p.ServiceDate)
            .ToListAsync();

        return plans.Select(p => new MealQuantityPlanDto
        {
            QuantityPlanId    = GuidHelper.ToGuidString(p.QuantityPlanId),
            PlanCode          = p.PlanCode,
            ServiceDate       = p.ServiceDate.ToString("yyyy-MM-dd"),
            DayOfWeek         = ToDayCode(p.ServiceDate),
            Status            = p.Status,
            ForecastReceivedAt = p.ForecastReceivedAt,
            ConfirmedAt       = p.ConfirmedAt,
            Lines             = p.Mealquantityplanlines
                .OrderBy(l => l.ShiftName)
                .Select(l => new MealQuantityPlanLineDto
                {
                    QuantityPlanLineId = GuidHelper.ToGuidString(l.QuantityPlanLineId),
                    MenuScheduleId     = GuidHelper.ToGuidString(l.MenuScheduleId),
                    MenuId             = GuidHelper.ToGuidString(l.MenuId),
                    MenuCode           = l.Menu.MenuCode,
                    MenuName           = l.Menu.MenuName,
                    ShiftName          = l.ShiftName,
                    Shift              = ToDisplayShift(l.ShiftName),
                    ForecastServings   = l.ForecastServings,
                    ConfirmedServings  = l.ConfirmedServings,
                    AdjustedServings   = l.AdjustedServings,
                    FinalServings      = l.FinalServings
                })
                .ToList()
        }).ToList();
    }

    // ── BE-4.3: POST /api/coordination/orders/{id}/signoff ──────────────────

    public async Task<SignoffOrderResultDto?> SignoffOrderAsync(
        string quantityPlanId,
        SignoffOrderRequestDto request,
        string? userId)
    {
        var planIdBytes = GuidHelper.ParseGuidString(quantityPlanId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);

        if (planIdBytes is null || userIdBytes is null)
            return null;

        var plan = await _context.Mealquantityplans
            .FirstOrDefaultAsync(p => p.QuantityPlanId == planIdBytes);

        if (plan is null)
            return null;

        // BE-4.4: Kiểm tra state machine — chỉ cho phép CONFIRMED → COMPLETED
        if (!OrderStatus.CanTransition(plan.Status, OrderStatus.Completed))
        {
            throw new InvalidOperationException(
                $"Không thể chốt ca. Kế hoạch đang ở trạng thái '{plan.Status}', " +
                $"chỉ có thể chốt khi trạng thái là '{OrderStatus.Confirmed}'.");
        }

        var oldStatus   = plan.Status;
        var signedOffAt = DateTime.UtcNow;

        plan.Status = OrderStatus.Completed;

        // Ghi audit log
        _context.Auditlogs.Add(new Models.Entities.Auditlog
        {
            AuditId      = GuidHelper.NewId(),
            EntityName   = "MealQuantityPlan",
            EntityId     = planIdBytes,
            FieldName    = "status",
            OldValue     = oldStatus,
            NewValue     = OrderStatus.Completed,
            Reason       = request.Note ?? "Chốt ca",
            ChangedBy    = userIdBytes,
            ChangedAt    = signedOffAt,
            BusinessArea = "Coordination"
        });

        await _context.SaveChangesAsync();

        return new SignoffOrderResultDto
        {
            Success        = true,
            QuantityPlanId = quantityPlanId,
            ServiceDate    = plan.ServiceDate.ToString("yyyy-MM-dd"),
            OldStatus      = oldStatus,
            NewStatus      = OrderStatus.Completed,
            SignedOffAt    = signedOffAt
        };
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
            .Where(line => line.QuantityPlan.ServiceDate == serviceDate);

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
