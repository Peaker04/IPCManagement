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

    public async Task<IReadOnlyList<MenuScheduleDto>> GetMenuSchedulesAsync(MenuScheduleQueryDto query)
    {
        var schedulesQuery = _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
            .AsNoTracking()
            .AsSplitQuery()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            var customerId = GuidHelper.ParseGuidString(query.CustomerId);
            if (customerId is null)
            {
                return [];
            }

            schedulesQuery = schedulesQuery.Where(schedule => schedule.CustomerId == customerId);
        }

        if (!string.IsNullOrWhiteSpace(query.ServiceDate) &&
            DateOnly.TryParse(query.ServiceDate, out var serviceDate))
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ServiceDate == serviceDate);
        }
        else if (!string.IsNullOrWhiteSpace(query.DayOfWeek))
        {
            var resolvedDate = ResolveServiceDate(null, query.DayOfWeek);
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ServiceDate == resolvedDate);
        }
        else
        {
            var weekStart = ResolveWeekStartDate(query.WeekStartDate);
            var weekEnd = weekStart.AddDays(6);
            schedulesQuery = schedulesQuery.Where(schedule =>
                schedule.ServiceDate >= weekStart &&
                schedule.ServiceDate <= weekEnd);
        }

        var shiftName = NormalizeShiftName(query.ShiftName);
        if (!string.IsNullOrWhiteSpace(query.ShiftName) && shiftName is null)
        {
            return [];
        }

        if (shiftName is not null)
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ShiftName == shiftName);
        }

        var schedules = await schedulesQuery
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ThenBy(schedule => schedule.Customer.CustomerCode)
            .ToListAsync();

        return schedules.Select(schedule => new MenuScheduleDto
        {
            MenuScheduleId = GuidHelper.ToGuidString(schedule.MenuScheduleId),
            CustomerId = GuidHelper.ToGuidString(schedule.CustomerId),
            CustomerCode = schedule.Customer.CustomerCode,
            CustomerName = schedule.Customer.CustomerName,
            MenuId = GuidHelper.ToGuidString(schedule.MenuId),
            MenuCode = schedule.Menu.MenuCode,
            MenuName = schedule.Menu.MenuName,
            ServiceDate = schedule.ServiceDate.ToString("yyyy-MM-dd"),
            WeekStartDate = schedule.WeekStartDate.ToString("yyyy-MM-dd"),
            ShiftName = schedule.ShiftName,
            Shift = ToDisplayShift(schedule.ShiftName),
            DayOfWeek = ToDayCode(schedule.ServiceDate),
            MenuPrice = schedule.MenuPrice,
            BomRatePercent = schedule.BomRatePercent,
            Status = schedule.Status,
            Dishes = schedule.Menu.Menuitems
                .OrderBy(item => item.DisplayOrder)
                .Select(item => new MenuScheduleDishDto
                {
                    DishId = GuidHelper.ToGuidString(item.DishId),
                    DishCode = item.Dish.DishCode,
                    DishName = item.Dish.DishName,
                    DishGroup = item.Dish.DishGroup,
                    DishType = item.Dish.DishType,
                    DisplayOrder = item.DisplayOrder
                })
                .ToList()
        }).ToList();
    }

    public async Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query)
    {
        var plansQuery = _context.Mealquantityplans
            .Include(plan => plan.Mealquantityplanlines)
                .ThenInclude(line => line.Customer)
            .Include(plan => plan.Mealquantityplanlines)
                .ThenInclude(line => line.Menu)
            .Include(plan => plan.Mealquantityplanlines)
                .ThenInclude(line => line.MenuSchedule)
            .AsNoTracking()
            .AsSplitQuery()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.ServiceDate) &&
            DateOnly.TryParse(query.ServiceDate, out var serviceDate))
        {
            plansQuery = plansQuery.Where(plan => plan.ServiceDate == serviceDate);
        }
        else if (!string.IsNullOrWhiteSpace(query.DayOfWeek))
        {
            var resolvedDate = ResolveServiceDate(null, query.DayOfWeek);
            plansQuery = plansQuery.Where(plan => plan.ServiceDate == resolvedDate);
        }
        else
        {
            var weekStart = ResolveWeekStartDate(query.WeekStartDate);
            var weekEnd = weekStart.AddDays(6);
            plansQuery = plansQuery.Where(plan =>
                plan.ServiceDate >= weekStart &&
                plan.ServiceDate <= weekEnd);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = OrderStatus.Normalize(query.Status);
            plansQuery = plansQuery.Where(plan => plan.Status == status);
        }

        var shiftName = NormalizeShiftName(query.ShiftName);
        if (!string.IsNullOrWhiteSpace(query.ShiftName) && shiftName is null)
        {
            return [];
        }

        var plans = await plansQuery
            .OrderBy(plan => plan.ServiceDate)
            .ThenBy(plan => plan.PlanCode)
            .ToListAsync();

        return plans.Select(plan => new MealQuantityPlanDto
        {
            QuantityPlanId = GuidHelper.ToGuidString(plan.QuantityPlanId),
            PlanCode = plan.PlanCode,
            ServiceDate = plan.ServiceDate.ToString("yyyy-MM-dd"),
            DayOfWeek = ToDayCode(plan.ServiceDate),
            Status = plan.Status,
            ForecastReceivedAt = plan.ForecastReceivedAt,
            ConfirmedAt = plan.ConfirmedAt,
            Lines = plan.Mealquantityplanlines
                .Where(line => shiftName is null || line.ShiftName == shiftName)
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
        }).ToList();
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

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
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
            await transaction.CommitAsync();

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
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<AdjustOrderAfterLockResultDto?> AdjustOrderAfterLockAsync(
        AdjustOrderAfterLockRequestDto request,
        string? userId)
    {
        if (!string.Equals(request.Field, "actualQuantity", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Field, "finalServings", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Chỉ hỗ trợ điều chỉnh số suất thực tế sau khi chốt.");
        }

        var lineId = !string.IsNullOrWhiteSpace(request.QuantityPlanLineId)
            ? request.QuantityPlanLineId
            : request.OrderId;

        var result = await AdjustServingsAsync(
            lineId,
            new AdjustServingsRequestDto
            {
                ServingsQuantity = request.NewValue,
                Reason = request.Reason
            },
            userId);

        if (result is null)
        {
            return null;
        }
        return new AdjustOrderAfterLockResultDto
        {
            Success = true,
            Timestamp = result.ChangedAt
        };
    }

    public async Task<AdjustServingsResultDto?> AdjustServingsAsync(
        string orderId,
        AdjustServingsRequestDto request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var lineId = GuidHelper.ParseGuidString(orderId);
        if (userIdBytes is null || lineId is null)
        {
            return null;
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

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var oldValue = line.FinalServings;
            var changedAt = DateTime.UtcNow;
            var auditId = GuidHelper.NewId();

            line.AdjustedServings = request.ServingsQuantity - line.ConfirmedServings;
            line.FinalServings = request.ServingsQuantity;

            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = auditId,
                ChangedAt = changedAt,
                ChangedBy = userIdBytes,
                BusinessArea = "Coordination",
                EntityName = nameof(Mealquantityplanline),
                EntityId = line.QuantityPlanLineId,
                FieldName = "finalServings",
                OldValue = oldValue.ToString(),
                NewValue = request.ServingsQuantity.ToString(),
                Reason = request.Reason
            });

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new AdjustServingsResultDto
            {
                Success = true,
                OrderId = GuidHelper.ToGuidString(line.QuantityPlanLineId),
                OldServings = oldValue,
                NewServings = request.ServingsQuantity,
                ChangedAt = changedAt,
                AuditId = GuidHelper.ToGuidString(auditId)
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<SignoffOrderResultDto?> SignoffOrderAsync(
        string quantityPlanId,
        SignoffOrderRequestDto request,
        string? userId)
    {
        var planIdBytes = GuidHelper.ParseGuidString(quantityPlanId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (planIdBytes is null || userIdBytes is null)
        {
            return null;
        }

        var plan = await _context.Mealquantityplans
            .FirstOrDefaultAsync(item => item.QuantityPlanId == planIdBytes);
        if (plan is null)
        {
            return null;
        }

        var oldStatus = OrderStatus.Normalize(plan.Status);
        if (!OrderStatus.CanTransition(oldStatus, OrderStatus.Completed))
        {
            throw new InvalidOperationException(
                "Chỉ có thể hoàn tất ca sau khi kế hoạch đã được chốt.");
        }

        var signedOffAt = DateTime.UtcNow;
        plan.Status = OrderStatus.Completed;

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = signedOffAt,
            ChangedBy = userIdBytes,
            BusinessArea = "Coordination",
            EntityName = nameof(Mealquantityplan),
            EntityId = planIdBytes,
            FieldName = nameof(Mealquantityplan.Status),
            OldValue = oldStatus,
            NewValue = OrderStatus.Completed,
            Reason = string.IsNullOrWhiteSpace(request.Note)
                ? "Hoàn tất ca điều phối"
                : request.Note.Trim()
        });

        await _context.SaveChangesAsync();

        return new SignoffOrderResultDto
        {
            Success = true,
            QuantityPlanId = quantityPlanId,
            ServiceDate = plan.ServiceDate.ToString("yyyy-MM-dd"),
            OldStatus = oldStatus,
            NewStatus = OrderStatus.Completed,
            SignedOffAt = signedOffAt
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

    private static DateOnly ResolveWeekStartDate(string? weekStartDate)
    {
        if (!string.IsNullOrWhiteSpace(weekStartDate) &&
            DateOnly.TryParse(weekStartDate, out var parsedWeekStart))
        {
            return parsedWeekStart;
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        var offsetFromMonday = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-offsetFromMonday);
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
