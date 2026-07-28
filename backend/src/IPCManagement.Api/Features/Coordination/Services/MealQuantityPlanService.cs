using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class MealQuantityPlanService : IMealQuantityPlanService
{
    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;

    public MealQuantityPlanService(IpcManagementContext context, IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _transactionRunner = transactionRunner;
    }

    public async Task<IReadOnlyList<MealQuantityPlanDto>> GetMealQuantityPlansAsync(MealQuantityPlanQueryDto query)
    {
        var customerId = string.IsNullOrWhiteSpace(query.CustomerId)
            ? null
            : GuidHelper.ParseGuidString(query.CustomerId);
        if (!string.IsNullOrWhiteSpace(query.CustomerId) && customerId is null)
        {
            return [];
        }

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
            var resolvedDate = MenuSchedulePolicy.ResolveServiceDate(null, query.DayOfWeek);
            plansQuery = plansQuery.Where(plan => plan.ServiceDate == resolvedDate);
        }
        else
        {
            var weekStart = MenuSchedulePolicy.ResolveWeekStartDate(query.WeekStartDate);
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

        if (customerId is not null)
        {
            plansQuery = plansQuery.Where(plan =>
                plan.Mealquantityplanlines.Any(line => line.CustomerId.SequenceEqual(customerId)));
        }

        var shiftName = MenuSchedulePolicy.NormalizeShiftName(query.ShiftName);
        if (!string.IsNullOrWhiteSpace(query.ShiftName) && shiftName is null)
        {
            return [];
        }

        var plans = await plansQuery
            .OrderBy(plan => plan.ServiceDate)
            .ThenBy(plan => plan.PlanCode)
            .ToListAsync();

        return plans
            .Select(plan => MealQuantityPlanPolicy.MapMealQuantityPlan(plan, shiftName, customerId))
            .ToList();
    }

    public async Task<MealQuantityPlanDto?> UpsertQuickServingsAsync(
        UpsertQuickServingsRequest request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var customerId = GuidHelper.ParseGuidString(request.CustomerId);
        if (userIdBytes is null || customerId is null)
        {
            return null;
        }

        if (!DateOnly.TryParse(request.ServiceDate, out var serviceDate))
        {
            throw new ArgumentException("Ngày phục vụ không hợp lệ.");
        }

        var shiftName = MenuSchedulePolicy.NormalizeShiftName(request.ShiftName);
        if (shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        if (request.Servings < 0)
        {
            throw new ArgumentException("Số suất phải lớn hơn hoặc bằng 0.");
        }

        var changedAt = DateTime.UtcNow;
        byte[]? transactionPlanId = null;
        var savedPlanId = await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var schedules = await _context.Menuschedules
                    .Include(schedule => schedule.Customer)
                    .Include(schedule => schedule.Menu)
                    .Where(schedule =>
                        schedule.ServiceDate == serviceDate &&
                        schedule.ShiftName == shiftName &&
                        schedule.CustomerId.SequenceEqual(customerId))
                    .ToListAsync(cancellationToken);
                if (schedules.Count == 0)
                {
                    return null;
                }

                var customerCode = schedules.First().Customer.CustomerCode;
                var planCode = MealQuantityPlanPolicy.BuildQuickServingPlanCode(serviceDate, shiftName, customerCode);
                var plan = await _context.Mealquantityplans
                    .Include(item => item.Mealquantityplanlines)
                        .ThenInclude(line => line.Customer)
                    .Include(item => item.Mealquantityplanlines)
                        .ThenInclude(line => line.Menu)
                    .Include(item => item.Mealquantityplanlines)
                        .ThenInclude(line => line.MenuSchedule)
                    .FirstOrDefaultAsync(item => item.PlanCode == planCode, cancellationToken);
                if (plan is null)
                {
                    plan = new MealQuantityPlan
                    {
                        QuantityPlanId = GuidHelper.NewId(),
                        PlanCode = planCode,
                        ServiceDate = serviceDate,
                        Status = request.Complete ? OrderStatus.Completed : OrderStatus.Forecasted,
                        ForecastReceivedAt = changedAt,
                        ConfirmedAt = request.Complete ? changedAt : null,
                        ConfirmationTime = TimeOnly.FromDateTime(changedAt),
                        ConfirmedBy = request.Complete ? userIdBytes : null
                    };
                    _context.Mealquantityplans.Add(plan);
                }
                else if (OrderStatus.Normalize(plan.Status) == OrderStatus.Completed && !request.Complete)
                {
                    throw new BusinessRuleException("Ca đã hoàn tất. Điều chỉnh sau hoàn tất cần thực hiện ở Điều phối đơn.");
                }
                else
                {
                    plan.Status = request.Complete ? OrderStatus.Completed : OrderStatus.Forecasted;
                    plan.ForecastReceivedAt ??= changedAt;
                    plan.ConfirmedAt = request.Complete ? changedAt : plan.ConfirmedAt;
                    plan.ConfirmationTime = TimeOnly.FromDateTime(changedAt);
                    plan.ConfirmedBy = request.Complete ? userIdBytes : plan.ConfirmedBy;
                }

                foreach (var schedule in schedules)
                {
                    var line = plan.Mealquantityplanlines.FirstOrDefault(item =>
                        item.MenuScheduleId.SequenceEqual(schedule.MenuScheduleId));
                    if (line is null)
                    {
                        line = new MealQuantityPlanLine
                        {
                            QuantityPlanLineId = GuidHelper.NewId(),
                            QuantityPlanId = plan.QuantityPlanId,
                            MenuScheduleId = schedule.MenuScheduleId,
                            CustomerId = schedule.CustomerId,
                            MenuId = schedule.MenuId,
                            ShiftName = schedule.ShiftName
                        };
                        plan.Mealquantityplanlines.Add(line);
                    }

                    line.ForecastServings = request.Servings;
                    line.ConfirmedServings = request.Complete ? request.Servings : line.ConfirmedServings;
                    line.AdjustedServings = 0;
                    line.FinalServings = request.Servings;
                    line.UpdatedAt = changedAt;
                }

                AddAudit(
                    userIdBytes,
                    changedAt,
                    "Coordination",
                    nameof(MealQuantityPlan),
                    plan.QuantityPlanId,
                    request.Complete ? "QuickCompleteServings" : "QuickForecastServings",
                    null,
                    $"{serviceDate:yyyy-MM-dd}|{shiftName}|{request.Servings}",
                    "KHSX cập nhật nhanh số suất vận hành");

                transactionPlanId = plan.QuantityPlanId;
                await _context.SaveChangesAsync(cancellationToken);
                return transactionPlanId;
            },
            async cancellationToken =>
            {
                if (transactionPlanId is null)
                {
                    return false;
                }

                var expectedStatus = request.Complete ? OrderStatus.Completed : OrderStatus.Forecasted;
                return await _context.Mealquantityplans
                    .AsNoTracking()
                    .AnyAsync(
                        plan => plan.QuantityPlanId == transactionPlanId &&
                                plan.Status == expectedStatus &&
                                plan.Mealquantityplanlines.Count > 0 &&
                                plan.Mealquantityplanlines.All(line =>
                                    line.ForecastServings == request.Servings &&
                                    line.FinalServings == request.Servings),
                        cancellationToken);
            });

        if (savedPlanId is null)
        {
            return null;
        }

        var savedPlan = await _context.Mealquantityplans
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.Customer)
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.Menu)
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.MenuSchedule)
            .AsNoTracking()
            .AsSplitQuery()
            .FirstOrDefaultAsync(item => item.QuantityPlanId == savedPlanId);

        return savedPlan is null
            ? null
            : MealQuantityPlanPolicy.MapMealQuantityPlan(savedPlan, shiftName, customerId);
    }

    private void AddAudit(
        byte[] actorId,
        DateTime changedAt,
        string businessArea,
        string entityName,
        byte[] entityId,
        string fieldName,
        string? oldValue,
        string? newValue,
        string reason)
    {
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = changedAt,
            ChangedBy = actorId,
            BusinessArea = businessArea,
            EntityName = entityName,
            EntityId = entityId,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason
        });
    }
}
