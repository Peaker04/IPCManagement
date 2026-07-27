using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Coordination.Contracts;

namespace IPCManagement.Api.Features.Coordination.Services;

public class CoordinationService : ICoordinationService
{
    private const decimal FixedBomRatePercent = 100m;
    private readonly IpcManagementContext _context;
    private readonly ICustomerContractService _customerContractService;
    private readonly IPortionRuleService _portionRuleService;

    public CoordinationService(IpcManagementContext context)
        : this(context, new CustomerContractService(context), new PortionRuleService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService)
        : this(context, customerContractService, new PortionRuleService(context))
    {
    }

    public CoordinationService(
        IpcManagementContext context,
        ICustomerContractService customerContractService,
        IPortionRuleService portionRuleService)
    {
        _context = context;
        _customerContractService = customerContractService;
        _portionRuleService = portionRuleService;
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

        var versions = await LoadMenuVersionsAsync(schedules);
        return schedules.Select(schedule => MapMenuSchedule(schedule, ResolveMenuVersion(versions, schedule))).ToList();
    }

    public Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync()
        => _customerContractService.GetCustomerContractsAsync();

    public Task<CustomerContractDto> CreateCustomerContractAsync(
        CreateCustomerContractRequest request,
        string? userId)
        => _customerContractService.CreateCustomerContractAsync(request, userId);

    public Task<CustomerContractDto?> UpdateCustomerContractAsync(
        string customerId,
        UpdateCustomerContractRequest request,
        string? userId)
        => _customerContractService.UpdateCustomerContractAsync(customerId, request, userId);

    public Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query)
        => _portionRuleService.GetPortionRulesAsync(query);

    public Task<PortionRuleDto> CreatePortionRuleAsync(
        CreatePortionRuleRequest request,
        string? userId)
        => _portionRuleService.CreatePortionRuleAsync(request, userId);

    public Task<PortionRuleDto?> UpdatePortionRuleAsync(
        string portionRuleId,
        UpdatePortionRuleRequest request,
        string? userId)
        => _portionRuleService.UpdatePortionRuleAsync(portionRuleId, request, userId);

    public Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request)
        => _portionRuleService.ResolvePortionRuleAsync(request);

    public async Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
        string menuScheduleId,
        UpdateMenuScheduleRulesRequest request,
        string? userId)
    {
        var schedule = await FindMenuScheduleForUpdateAsync(menuScheduleId);
        if (schedule is null)
        {
            return null;
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var reason = string.IsNullOrWhiteSpace(request.Reason)
            ? "Cập nhật quy tắc contract/suất ăn"
            : request.Reason.Trim();

        if (request.MenuPrice is not null)
        {
            var nextPrice = DecimalPolicy.RoundMoney(request.MenuPrice.Value);
            if (nextPrice < 0)
            {
                throw new ArgumentException("Đơn giá menu không được âm.");
            }

            if (schedule.MenuPrice != nextPrice)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.MenuPrice), schedule.MenuPrice.ToString(), nextPrice.ToString(), reason);
                schedule.MenuPrice = nextPrice;
            }
        }

        if (schedule.BomRatePercent != FixedBomRatePercent)
        {
            AddAudit(actorId, changedAt, "PortionRule", nameof(MenuSchedule), schedule.MenuScheduleId,
                nameof(MenuSchedule.BomRatePercent), schedule.BomRatePercent.ToString(), FixedBomRatePercent.ToString(), reason);
            schedule.BomRatePercent = FixedBomRatePercent;
        }

        var status = NormalizeMenuScheduleStatus(request.Status);
        if (status is not null && !string.Equals(schedule.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuSchedule), schedule.MenuScheduleId,
                nameof(MenuSchedule.Status), schedule.Status, status, reason);
            schedule.Status = status;
        }

        await _context.SaveChangesAsync();
        var version = await GetLatestMenuVersionAsync(schedule.CustomerId, schedule.WeekStartDate);
        return MapMenuSchedule(schedule, version);
    }

    public async Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
        string menuScheduleId,
        UpdateMenuScheduleVersionRequest request,
        string? userId)
    {
        var schedule = await FindMenuScheduleForUpdateAsync(menuScheduleId);
        if (schedule is null)
        {
            return null;
        }

        var status = NormalizeMenuScheduleStatus(request.Status);
        if (status is null)
        {
            throw new ArgumentException("Trạng thái version thực đơn không hợp lệ.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var version = await EnsureMenuVersionAsync(schedule.CustomerId, schedule.WeekStartDate, actorId, changedAt);

        if (status == "ACTIVE")
        {
            var activeVersions = (await _context.Menuversions
                .Where(item => item.WeekStartDate == schedule.WeekStartDate && item.Status == "ACTIVE")
                .ToListAsync())
                .Where(item =>
                    item.CustomerId.SequenceEqual(schedule.CustomerId) &&
                    !item.MenuVersionId.SequenceEqual(version.MenuVersionId))
                .ToList();
            foreach (var activeVersion in activeVersions)
            {
                activeVersion.Status = "SUPERSEDED";
                activeVersion.UpdatedAt = changedAt;
            }

            version.PublishedBy = actorId;
            version.PublishedAt = changedAt;
        }

        if (!string.Equals(version.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            AddAudit(
                actorId,
                changedAt,
                "MenuVersion",
                nameof(MenuVersion),
                version.MenuVersionId,
                nameof(MenuVersion.Status),
                version.Status,
                status,
                string.IsNullOrWhiteSpace(request.Reason) ? "Cập nhật version thực đơn" : request.Reason.Trim());
            version.Status = status;
            version.UpdatedAt = changedAt;
        }

        var weekSchedules = (await _context.Menuschedules
            .Where(item => item.WeekStartDate == schedule.WeekStartDate)
            .ToListAsync())
            .Where(item => item.CustomerId.SequenceEqual(schedule.CustomerId))
            .ToList();

        foreach (var weekSchedule in weekSchedules)
        {
            if (string.Equals(weekSchedule.Status, status, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            AddAudit(
                actorId,
                changedAt,
                "MenuVersion",
                nameof(MenuSchedule),
                weekSchedule.MenuScheduleId,
                nameof(MenuSchedule.Status),
                weekSchedule.Status,
                status,
                string.IsNullOrWhiteSpace(request.Reason) ? "Cập nhật version thực đơn" : request.Reason.Trim());
            weekSchedule.Status = status;
        }

        await _context.SaveChangesAsync();
        return MapMenuSchedule(schedule, version);
    }

    public async Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(
        RollbackMenuVersionRequest request,
        string? userId)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId)
            ?? throw new ArgumentException("Khách hàng không hợp lệ.");
        if (!DateOnly.TryParse(request.WeekStartDate, out var weekStartDate))
        {
            throw new ArgumentException("Tuần bắt đầu không hợp lệ.");
        }

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Vui lòng nhập lý do rollback thực đơn.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            var versions = (await _context.Menuversions
                .Where(version => version.WeekStartDate == weekStartDate)
                .OrderByDescending(version => version.VersionNo)
                .ToListAsync())
                .Where(version => version.CustomerId.SequenceEqual(customerId))
                .ToList();
            if (versions.Count == 0)
            {
                throw new ArgumentException("Chưa có version thực đơn cho khách hàng và tuần đã chọn.");
            }

            var current = versions
                .Where(version => IsPublishedMenuVersionStatus(version.Status))
                .OrderByDescending(version => version.PublishedAt.HasValue)
                .ThenByDescending(version => version.VersionNo)
                .FirstOrDefault()
                ?? versions.OrderByDescending(version => version.VersionNo).First();
            var target = ResolveRollbackTarget(versions, current, request);
            if (target is null)
            {
                throw new ArgumentException("Không tìm thấy version trước đó để rollback.");
            }

            if (current.MenuVersionId.SequenceEqual(target.MenuVersionId))
            {
                throw new ArgumentException("Version rollback phải khác version đang dùng.");
            }

            foreach (var activeVersion in versions.Where(version =>
                IsPublishedMenuVersionStatus(version.Status) &&
                !version.MenuVersionId.SequenceEqual(target.MenuVersionId)))
            {
                AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), activeVersion.MenuVersionId,
                    nameof(MenuVersion.Status), activeVersion.Status, "SUPERSEDED", reason);
                activeVersion.Status = "SUPERSEDED";
                activeVersion.UpdatedAt = changedAt;
            }

            if (!string.Equals(target.Status, "PUBLISHED", StringComparison.OrdinalIgnoreCase))
            {
                AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), target.MenuVersionId,
                    nameof(MenuVersion.Status), target.Status, "PUBLISHED", reason);
            }

            target.Status = "PUBLISHED";
            target.PublishedBy = actorId;
            target.PublishedAt = changedAt;
            target.UpdatedAt = changedAt;
            AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), target.MenuVersionId,
                "Rollback", current.VersionNo.ToString(), target.VersionNo.ToString(), reason);

            var weekSchedules = (await _context.Menuschedules
                .Where(schedule => schedule.WeekStartDate == weekStartDate)
                .ToListAsync())
                .Where(schedule => schedule.CustomerId.SequenceEqual(customerId))
                .ToList();
            foreach (var schedule in weekSchedules.Where(schedule =>
                !string.Equals(schedule.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase)))
            {
                AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.Status), schedule.Status, "ACTIVE", reason);
                schedule.Status = "ACTIVE";
            }

            var invalidated = await InvalidateWorkflowDocumentsForMenuRollbackAsync(
                customerId,
                weekStartDate,
                target,
                actorId,
                changedAt,
                reason);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return new MenuVersionRollbackResultDto
            {
                CustomerId = GuidHelper.ToGuidString(customerId),
                WeekStartDate = weekStartDate.ToString("yyyy-MM-dd"),
                ActiveMenuVersionId = GuidHelper.ToGuidString(target.MenuVersionId),
                ActiveVersionNo = target.VersionNo,
                RolledBackFromMenuVersionId = GuidHelper.ToGuidString(current.MenuVersionId),
                RolledBackFromVersionNo = current.VersionNo,
                CancelledDemandCount = invalidated.CancelledDemandCount,
                CancelledPurchaseCount = invalidated.CancelledPurchaseCount,
                Reason = reason
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
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

        if (customerId is not null)
        {
            plansQuery = plansQuery.Where(plan => plan.Mealquantityplanlines.Any(line => line.CustomerId.SequenceEqual(customerId)));
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
        }).ToList();
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

        var shiftName = NormalizeShiftName(request.ShiftName);
        if (shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        if (request.Servings < 0)
        {
            throw new ArgumentException("Số suất phải lớn hơn hoặc bằng 0.");
        }

        var schedules = await _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
            .Where(schedule =>
                schedule.ServiceDate == serviceDate &&
                schedule.ShiftName == shiftName &&
                schedule.CustomerId.SequenceEqual(customerId))
            .ToListAsync();
        if (schedules.Count == 0)
        {
            return null;
        }

        var customerCode = schedules.First().Customer.CustomerCode;
        var planCode = BuildQuickServingPlanCode(serviceDate, shiftName, customerCode);
        var plan = await _context.Mealquantityplans
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.Customer)
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.Menu)
            .Include(item => item.Mealquantityplanlines)
                .ThenInclude(line => line.MenuSchedule)
            .FirstOrDefaultAsync(item => item.PlanCode == planCode);
        var changedAt = DateTime.UtcNow;

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
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
                throw new InvalidOperationException("Ca đã hoàn tất. Điều chỉnh sau hoàn tất cần thực hiện ở Điều phối đơn.");
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

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
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
            .FirstOrDefaultAsync(item => item.QuantityPlanId == plan.QuantityPlanId);

        return savedPlan is null ? null : MapMealQuantityPlan(savedPlan, shiftName, customerId);
    }

    public async Task<LockOrderPlanResultDto?> LockOrderPlanAsync(
        LockOrderPlanRequest request,
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

        var plans = lines
            .Select(line => line.QuantityPlan)
            .DistinctBy(plan => Convert.ToBase64String(plan.QuantityPlanId))
            .ToList();
        var invalidPlan = plans.FirstOrDefault(plan =>
            !OrderStatus.CanTransition(plan.Status, OrderStatus.Confirmed));
        if (invalidPlan is not null)
        {
            throw new InvalidOperationException(
                $"Chỉ có thể chốt kế hoạch đang ở trạng thái nháp hoặc dự báo. " +
                $"Kế hoạch {invalidPlan.PlanCode} hiện ở trạng thái {OrderStatus.Normalize(invalidPlan.Status)}.");
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
            }

            foreach (var plan in plans)
            {
                plan.Status = OrderStatus.Confirmed;
                plan.ConfirmedAt = lockedAt;
                plan.ConfirmationTime = TimeOnly.FromDateTime(lockedAt);
                plan.ConfirmedBy = userIdBytes;
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
        AdjustOrderAfterLockRequest request,
        string? userId)
    {
        if (request.NewValue < 0)
        {
            throw new ArgumentException("Số suất điều chỉnh phải lớn hơn hoặc bằng 0.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new ArgumentException("Lý do điều chỉnh không được để trống.");
        }

        if (!string.Equals(request.Field, "actualQuantity", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(request.Field, "finalServings", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Chỉ hỗ trợ điều chỉnh số suất thực tế sau khi chốt.");
        }

        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var lineId = !string.IsNullOrWhiteSpace(request.QuantityPlanLineId)
            ? GuidHelper.ParseGuidString(request.QuantityPlanLineId)
            : GuidHelper.ParseGuidString(request.OrderId);

        if (userIdBytes is null || lineId is null)
        {
            return null;
        }

        var line = await _context.Mealquantityplanlines
            .Include(item => item.QuantityPlan)
            .Include(item => item.Quantityadjustments)
            .FirstOrDefaultAsync(item => item.QuantityPlanLineId == lineId);

        if (line is null)
        {
            return null;
        }

        if (!OrderStatus.IsLocked(line.QuantityPlan.Status))
        {
            throw new InvalidOperationException("Chỉ có thể điều chỉnh sau khi kế hoạch đã được chốt.");
        }

        var adjustmentIds = line.Quantityadjustments
            .Select(item => item.AdjustmentId)
            .ToList();

        if (adjustmentIds.Count > 0)
        {
            var resolvedIds = await _context.Approvalhistories
                .AsNoTracking()
                .Where(item => item.TargetType == "order-adjustment")
                .Select(item => item.TargetId)
                .ToListAsync();

            var hasPendingAdjustment = adjustmentIds.Any(adjustmentId =>
                !resolvedIds.Any(resolvedId => resolvedId.SequenceEqual(adjustmentId)));

            if (hasPendingAdjustment)
            {
                throw new InvalidOperationException("Dòng này đang có yêu cầu điều chỉnh chờ duyệt.");
            }
        }

        var requestedAt = DateTime.UtcNow;
        var adjustmentId = GuidHelper.NewId();

        _context.Quantityadjustments.Add(new QuantityAdjustment
        {
            AdjustmentId = adjustmentId,
            QuantityPlanLineId = line.QuantityPlanLineId,
            OldServings = line.FinalServings,
            NewServings = request.NewValue,
            Reason = request.Reason.Trim(),
            AdjustedBy = userIdBytes,
            AdjustedAt = requestedAt
        });

        await _context.SaveChangesAsync();

        return new AdjustOrderAfterLockResultDto
        {
            Success = true,
            Timestamp = requestedAt,
            RequiresApproval = true,
            ApprovalStatus = "PENDING",
            ApprovalTargetType = "order-adjustment",
            ApprovalTargetId = GuidHelper.ToGuidString(adjustmentId),
            OldValue = line.FinalServings,
            NewValue = request.NewValue,
            Reason = request.Reason.Trim()
        };
    }

    public async Task<AdjustServingsResultDto?> AdjustServingsAsync(
        string orderId,
        AdjustServingsRequest request,
        string? userId)
    {
        var lineId = GuidHelper.ParseGuidString(orderId);
        if (GuidHelper.ParseGuidString(userId) is null || lineId is null)
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

        throw new InvalidOperationException(
            "Không thể điều chỉnh trực tiếp sau khi chốt. Hãy gửi yêu cầu duyệt điều chỉnh.");
    }

    public async Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(
        string orderId,
        UpdateForecastServingsRequest request,
        string? userId)
    {
        if (request.ServingsQuantity < 0)
        {
            throw new ArgumentException("Số suất dự kiến phải lớn hơn hoặc bằng 0.");
        }

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

        if (!OrderStatus.CanEditForecast(line.QuantityPlan.Status))
        {
            throw new InvalidOperationException("Chỉ có thể cập nhật số suất dự kiến trước khi kế hoạch được chốt.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            var oldValue = line.ForecastServings;
            var changedAt = DateTime.UtcNow;
            var auditId = GuidHelper.NewId();

            line.ForecastServings = request.ServingsQuantity;
            line.FinalServings = request.ServingsQuantity;
            line.UpdatedAt = changedAt;

            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = auditId,
                ChangedAt = changedAt,
                ChangedBy = userIdBytes,
                BusinessArea = "Coordination",
                EntityName = nameof(MealQuantityPlanLine),
                EntityId = line.QuantityPlanLineId,
                FieldName = "forecastServings",
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
        SignoffOrderRequest request,
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
        plan.CompletedAt = signedOffAt;
        plan.CompletedBy = userIdBytes;

        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = signedOffAt,
            ChangedBy = userIdBytes,
            BusinessArea = "Coordination",
            EntityName = nameof(MealQuantityPlan),
            EntityId = planIdBytes,
            FieldName = nameof(MealQuantityPlan.Status),
            OldValue = oldStatus,
            NewValue = OrderStatus.Completed,
            Reason = string.IsNullOrWhiteSpace(request.Note)
                ? "Hoàn tất ca điều phối"
                : request.Note.Trim()
        });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new InvalidOperationException(
                "Kế hoạch này đã được người khác chỉnh sửa trước đó. Vui lòng tải lại trang.");
        }

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

    public async Task<CoordinationScopeActionResultDto?> SignoffOrderScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null)
        {
            return null;
        }

        var serviceDate = ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = NormalizeShiftName(request.ShiftName ?? request.Shift);
        if (shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        var plans = await _context.Mealquantityplans
            .Include(plan => plan.Mealquantityplanlines)
            .Where(plan =>
                plan.ServiceDate == serviceDate &&
                plan.Mealquantityplanlines.Any(line => line.ShiftName == shiftName))
            .ToListAsync();
        if (plans.Count == 0)
        {
            return null;
        }

        var invalidPlan = plans.FirstOrDefault(plan =>
            !OrderStatus.CanTransition(plan.Status, OrderStatus.Completed));
        if (invalidPlan is not null)
        {
            throw new InvalidOperationException(
                $"Chỉ có thể hoàn tất ca khi tất cả kế hoạch đã được chốt. " +
                $"Kế hoạch {invalidPlan.PlanCode} hiện ở trạng thái {OrderStatus.Normalize(invalidPlan.Status)}.");
        }

        var oldStatuses = plans
            .Select(plan => OrderStatus.Normalize(plan.Status))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(status => status)
            .ToList();
        var changedAt = DateTime.UtcNow;
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            foreach (var plan in plans)
            {
                var oldStatus = OrderStatus.Normalize(plan.Status);
                plan.Status = OrderStatus.Completed;
                plan.CompletedAt = changedAt;
                plan.CompletedBy = userIdBytes;
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = changedAt,
                    ChangedBy = userIdBytes,
                    BusinessArea = "Coordination",
                    EntityName = nameof(MealQuantityPlan),
                    EntityId = plan.QuantityPlanId,
                    FieldName = nameof(MealQuantityPlan.Status),
                    OldValue = oldStatus,
                    NewValue = OrderStatus.Completed,
                    Reason = string.IsNullOrWhiteSpace(request.Note)
                        ? $"Hoàn tất ca {shiftName}"
                        : request.Note.Trim()
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync();
            throw new InvalidOperationException(
                "Một kế hoạch trong ca đã được người khác chỉnh sửa. Vui lòng tải lại trang.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return new CoordinationScopeActionResultDto
        {
            Success = true,
            ServiceDate = serviceDate.ToString("yyyy-MM-dd"),
            ShiftName = shiftName,
            AffectedPlanCount = plans.Count,
            OldStatuses = oldStatuses,
            NewStatus = OrderStatus.Completed,
            ChangedAt = changedAt
        };
    }

    public async Task<LockOrderPlanResultDto?> UnlockOrderPlanAsync(
        string quantityPlanId,
        string? userId)
    {
        var planIdBytes = GuidHelper.ParseGuidString(quantityPlanId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (planIdBytes is null || userIdBytes is null)
        {
            return null;
        }

        var plan = await _context.Mealquantityplans
            .Include(item => item.Mealquantityplanlines)
            .FirstOrDefaultAsync(item => item.QuantityPlanId == planIdBytes);
        if (plan is null)
        {
            return null;
        }

        var oldStatus = OrderStatus.Normalize(plan.Status);
        if (oldStatus != OrderStatus.Confirmed && oldStatus != OrderStatus.Adjusted)
        {
            throw new InvalidOperationException(
                "Chỉ có thể mở khóa kế hoạch đang ở trạng thái chốt hoặc điều chỉnh.");
        }

        var unlockedAt = DateTime.UtcNow;
        plan.Status = OrderStatus.Draft;
        plan.ConfirmedAt = null;
        plan.ConfirmedBy = null;
        plan.ConfirmationTime = new TimeOnly(8, 30);
        plan.CompletedAt = null;
        plan.CompletedBy = null;

        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = unlockedAt,
            ChangedBy = userIdBytes,
            BusinessArea = "Coordination",
            EntityName = nameof(MealQuantityPlan),
            EntityId = planIdBytes,
            FieldName = nameof(MealQuantityPlan.Status),
            OldValue = oldStatus,
            NewValue = OrderStatus.Draft,
            Reason = "Mở khóa kế hoạch (revert về Draft)"
        });

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new InvalidOperationException(
                "Kế hoạch này đã được người khác chỉnh sửa trước đó. Vui lòng tải lại trang.");
        }

        return new LockOrderPlanResultDto
        {
            Success = true,
            LockedAt = unlockedAt,
            ServiceDate = plan.ServiceDate.ToString("yyyy-MM-dd"),
            Scope = "FULLDAY",
            LockedShiftNames = plan.Mealquantityplanlines
                .Select(line => line.ShiftName)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(shift => shift)
                .ToList(),
            LockedLineCount = plan.Mealquantityplanlines.Count
        };
    }

    public async Task<CoordinationScopeActionResultDto?> UnlockOrderPlanScopeAsync(
        CoordinationScopeActionRequest request,
        string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null)
        {
            return null;
        }

        var serviceDate = ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = NormalizeShiftName(request.ShiftName ?? request.Shift);
        if (shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        var plans = await _context.Mealquantityplans
            .Include(plan => plan.Mealquantityplanlines)
            .Where(plan =>
                plan.ServiceDate == serviceDate &&
                plan.Mealquantityplanlines.Any(line => line.ShiftName == shiftName))
            .ToListAsync();
        if (plans.Count == 0)
        {
            return null;
        }

        var invalidPlan = plans.FirstOrDefault(plan =>
        {
            var status = OrderStatus.Normalize(plan.Status);
            return status != OrderStatus.Confirmed && status != OrderStatus.Adjusted;
        });
        if (invalidPlan is not null)
        {
            throw new InvalidOperationException(
                $"Chỉ có thể mở khóa khi tất cả kế hoạch trong ca đang được chốt. " +
                $"Kế hoạch {invalidPlan.PlanCode} hiện ở trạng thái {OrderStatus.Normalize(invalidPlan.Status)}.");
        }

        var oldStatuses = plans
            .Select(plan => OrderStatus.Normalize(plan.Status))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(status => status)
            .ToList();
        var changedAt = DateTime.UtcNow;
        await using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            foreach (var plan in plans)
            {
                var oldStatus = OrderStatus.Normalize(plan.Status);
                plan.Status = OrderStatus.Draft;
                plan.ConfirmedAt = null;
                plan.ConfirmedBy = null;
                plan.ConfirmationTime = new TimeOnly(8, 30);
                plan.CompletedAt = null;
                plan.CompletedBy = null;
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = changedAt,
                    ChangedBy = userIdBytes,
                    BusinessArea = "Coordination",
                    EntityName = nameof(MealQuantityPlan),
                    EntityId = plan.QuantityPlanId,
                    FieldName = nameof(MealQuantityPlan.Status),
                    OldValue = oldStatus,
                    NewValue = OrderStatus.Draft,
                    Reason = string.IsNullOrWhiteSpace(request.Note)
                        ? $"Mở khóa ca {shiftName}"
                        : request.Note.Trim()
                });
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync();
            throw new InvalidOperationException(
                "Một kế hoạch trong ca đã được người khác chỉnh sửa. Vui lòng tải lại trang.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return new CoordinationScopeActionResultDto
        {
            Success = true,
            ServiceDate = serviceDate.ToString("yyyy-MM-dd"),
            ShiftName = shiftName,
            AffectedPlanCount = plans.Count,
            OldStatuses = oldStatuses,
            NewStatus = OrderStatus.Draft,
            ChangedAt = changedAt
        };
    }

    public Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequest request)
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

    private async Task<MenuSchedule?> FindMenuScheduleForUpdateAsync(string menuScheduleId)
    {
        var scheduleIdBytes = GuidHelper.ParseGuidString(menuScheduleId);
        if (scheduleIdBytes is null)
        {
            return null;
        }

        return await _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
            .AsSplitQuery()
            .FirstOrDefaultAsync(schedule => schedule.MenuScheduleId == scheduleIdBytes);
    }

    private CustomerContract ResolveMutableContract(
        Customer customer,
        IReadOnlyList<MenuSchedule> schedules,
        UpdateCustomerContractRequest request,
        byte[] actorId,
        DateTime changedAt)
    {
        var existing = ResolveActiveContract(customer.Customercontracts);
        if (existing is not null)
        {
            return existing;
        }

        var activeWeekDays = NormalizeWeekDays(request.ActiveWeekDays, schedules);
        var shiftNames = NormalizeShiftNames(request.ShiftNames, schedules);
        var effectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")
            ?? schedules.FirstOrDefault()?.WeekStartDate
            ?? ServiceCalendar.Today();
        var effectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        if (effectiveTo is not null && effectiveTo.Value < effectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        var defaultMenuPrice = request.DefaultMenuPrice is null
            ? ResolveDefaultMenuPrice(schedules)
            : DecimalPolicy.RoundMoney(request.DefaultMenuPrice.Value);
        var defaultBomRate = FixedBomRatePercent;
        if (defaultMenuPrice < 0)
        {
            throw new ArgumentException("Đơn giá menu mặc định không được âm.");
        }
        var contract = new CustomerContract
        {
            ContractId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            ActiveWeekDays = string.Join(",", activeWeekDays),
            ShiftNames = string.Join(",", shiftNames),
            DefaultMenuPrice = defaultMenuPrice,
            DefaultBomRatePercent = defaultBomRate,
            Status = "ACTIVE",
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        customer.Customercontracts.Add(contract);
        AddAudit(actorId, changedAt, "CustomerContract", nameof(CustomerContract), contract.ContractId,
            "ContractCreated", null, GuidHelper.ToGuidString(customer.CustomerId), "Tạo contract hiệu lực cho khách hàng");
        return contract;
    }

    private static CustomerContract? ResolveActiveContract(IEnumerable<CustomerContract> contracts)
    {
        var today = ServiceCalendar.Today();
        return contracts
            .Where(contract => string.Equals(contract.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(contract =>
                contract.EffectiveFrom <= today &&
                (contract.EffectiveTo is null || contract.EffectiveTo >= today))
            .ThenByDescending(contract => contract.EffectiveFrom)
            .FirstOrDefault();
    }

    private void UpdateContractField(
        byte[] actorId,
        DateTime changedAt,
        CustomerContract contract,
        string fieldName,
        string? oldValue,
        string? newValue,
        Action apply)
    {
        if (string.Equals(oldValue ?? string.Empty, newValue ?? string.Empty, StringComparison.Ordinal))
        {
            return;
        }

        AddAudit(actorId, changedAt, "CustomerContract", nameof(CustomerContract), contract.ContractId,
            fieldName, oldValue, newValue, "Cập nhật contract hiệu lực của khách hàng");
        apply();
    }

    private void ApplyContractToUnlockedSchedules(
        CustomerContract contract,
        IReadOnlyList<MenuSchedule> schedules,
        byte[] actorId,
        DateTime changedAt)
    {
        var activeDays = SplitCsv(contract.ActiveWeekDays).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var shifts = SplitCsv(contract.ShiftNames).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var schedule in schedules.Where(schedule => !IsLockedSchedule(schedule) && MatchesContract(schedule, contract, activeDays, shifts)))
        {
            if (schedule.MenuPrice != contract.DefaultMenuPrice)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.MenuPrice), schedule.MenuPrice.ToString(), contract.DefaultMenuPrice.ToString(),
                    "Áp dụng đơn giá mặc định từ contract khách hàng");
                schedule.MenuPrice = contract.DefaultMenuPrice;
            }

            if (schedule.BomRatePercent != contract.DefaultBomRatePercent)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.BomRatePercent), schedule.BomRatePercent.ToString(), contract.DefaultBomRatePercent.ToString(),
                    "Áp dụng BOM cố định 100% theo tier đơn giá mới");
                schedule.BomRatePercent = FixedBomRatePercent;
            }
        }
    }

    private static void ValidateNoOverlappingContract(
        IEnumerable<CustomerContract> contracts,
        CustomerContract target)
    {
        var targetDays = SplitCsv(target.ActiveWeekDays).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var targetShifts = SplitCsv(target.ShiftNames).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasOverlap = contracts.Any(contract =>
            contract.ContractId != target.ContractId &&
            string.Equals(contract.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            DatesOverlap(contract.EffectiveFrom, contract.EffectiveTo, target.EffectiveFrom, target.EffectiveTo) &&
            SplitCsv(contract.ActiveWeekDays).Any(day => targetDays.Contains(day)) &&
            SplitCsv(contract.ShiftNames).Any(shift => targetShifts.Contains(shift)));

        if (hasOverlap)
        {
            throw new ArgumentException("Contract khách hàng bị trùng hiệu lực theo ngày làm việc và ca phục vụ.");
        }
    }

    private static bool DatesOverlap(
        DateOnly leftFrom,
        DateOnly? leftTo,
        DateOnly rightFrom,
        DateOnly? rightTo)
    {
        var leftEnd = leftTo ?? DateOnly.MaxValue;
        var rightEnd = rightTo ?? DateOnly.MaxValue;
        return leftFrom <= rightEnd && rightFrom <= leftEnd;
    }

    private static bool MatchesContract(
        MenuSchedule schedule,
        CustomerContract contract,
        ISet<string> activeDays,
        ISet<string> shifts)
    {
        if (schedule.ServiceDate < contract.EffectiveFrom ||
            (contract.EffectiveTo is not null && schedule.ServiceDate > contract.EffectiveTo))
        {
            return false;
        }

        return activeDays.Contains(ToDayCode(schedule.ServiceDate)) && shifts.Contains(schedule.ShiftName);
    }

    private static IReadOnlyList<string> NormalizeWeekDays(
        IReadOnlyList<string>? requestedWeekDays,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedWeekDays is { Count: > 0 }
            ? requestedWeekDays
            : schedules.Select(schedule => ToDayCode(schedule.ServiceDate)).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["t2", "t3", "t4", "t5", "t6", "t7"];
        }

        var normalized = values
            .Select(NormalizeDayCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(DaySortOrder)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ngày làm việc contract không hợp lệ.");
        }

        return normalized;
    }

    private static IReadOnlyList<string> NormalizeShiftNames(
        IReadOnlyList<string>? requestedShiftNames,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedShiftNames is { Count: > 0 }
            ? requestedShiftNames
            : schedules.Select(schedule => schedule.ShiftName).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["MORNING", "AFTERNOON"];
        }

        var normalized = values
            .Select(NormalizeShiftName)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ca phục vụ contract không hợp lệ.");
        }

        return normalized
            .Select(shift => shift!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(shift => shift)
            .ToList();
    }

    private static string NormalizeDayCode(string value)
        => value.Trim().ToLowerInvariant() switch
        {
            "t2" or "mon" or "monday" => "t2",
            "t3" or "tue" or "tuesday" => "t3",
            "t4" or "wed" or "wednesday" => "t4",
            "t5" or "thu" or "thursday" => "t5",
            "t6" or "fri" or "friday" => "t6",
            "t7" or "sat" or "saturday" => "t7",
            "cn" or "sun" or "sunday" => "cn",
            _ => string.Empty
        };

    private static int DaySortOrder(string dayCode)
        => dayCode switch
        {
            "t2" => 1,
            "t3" => 2,
            "t4" => 3,
            "t5" => 4,
            "t6" => 5,
            "t7" => 6,
            "cn" => 7,
            _ => 99
        };

    private static DateOnly? ParseDateOnly(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParse(value, out var parsed))
        {
            return parsed;
        }

        throw new ArgumentException($"{fieldName} không hợp lệ.");
    }

    private static decimal ResolveDefaultMenuPrice(IReadOnlyList<MenuSchedule> schedules)
        => schedules.Count == 0
            ? 25000
            : DecimalPolicy.RoundMoney(schedules.Average(schedule => schedule.MenuPrice));

    private static decimal ResolveDefaultBomRate(IReadOnlyList<MenuSchedule> schedules)
        => FixedBomRatePercent;

    private static IReadOnlyList<string> SplitCsv(string value)
        => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string NormalizeCustomerCode(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().ToUpperInvariant();

    private static CustomerContractDto MapCustomerContract(Customer customer)
    {
        var schedules = customer.Menuschedules
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToList();
        var contract = ResolveActiveContract(customer.Customercontracts);
        var activeWeekDays = contract is null
            ? schedules
                .Select(schedule => ToDayCode(schedule.ServiceDate))
                .Distinct()
                .ToList()
            : SplitCsv(contract.ActiveWeekDays);
        var shiftNames = contract is null
            ? schedules
                .Select(schedule => schedule.ShiftName)
                .Distinct()
                .OrderBy(shift => shift)
                .ToList()
            : SplitCsv(contract.ShiftNames);

        return new CustomerContractDto
        {
            ContractId = contract is null ? null : GuidHelper.ToGuidString(contract.ContractId),
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            Note = customer.Note,
            IsActive = customer.IsActive ?? true,
            EffectiveFrom = contract?.EffectiveFrom.ToString("yyyy-MM-dd"),
            EffectiveTo = contract?.EffectiveTo?.ToString("yyyy-MM-dd"),
            ContractStatus = contract?.Status ?? "FALLBACK",
            MenuScheduleCount = schedules.Count,
            ActiveWeekDays = activeWeekDays,
            ShiftNames = shiftNames,
            DefaultMenuPrice = contract is null ? (schedules.Count == 0 ? null : ResolveDefaultMenuPrice(schedules)) : contract.DefaultMenuPrice,
            DefaultBomRatePercent = FixedBomRatePercent,
            LatestServiceDate = schedules.LastOrDefault()?.ServiceDate.ToString("yyyy-MM-dd")
        };
    }

    private async Task<IReadOnlyList<MenuVersion>> LoadMenuVersionsAsync(IReadOnlyList<MenuSchedule> schedules)
    {
        if (schedules.Count == 0)
        {
            return [];
        }

        var minWeekStart = schedules.Min(schedule => schedule.WeekStartDate);
        var maxWeekStart = schedules.Max(schedule => schedule.WeekStartDate);
        var customerIds = schedules
            .Select(schedule => Convert.ToBase64String(schedule.CustomerId))
            .Distinct(StringComparer.Ordinal)
            .ToHashSet(StringComparer.Ordinal);

        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate >= minWeekStart && version.WeekStartDate <= maxWeekStart)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();

        return versions
            .Where(version => customerIds.Contains(Convert.ToBase64String(version.CustomerId)))
            .ToList();
    }

    private async Task<MenuVersion?> GetLatestMenuVersionAsync(byte[] customerId, DateOnly weekStartDate)
    {
        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();

        return versions.FirstOrDefault(version => version.CustomerId.SequenceEqual(customerId));
    }

    private async Task<MenuVersion> EnsureMenuVersionAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        byte[] actorId,
        DateTime changedAt)
    {
        var versions = await _context.Menuversions
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();
        var customerVersions = versions
            .Where(version => version.CustomerId.SequenceEqual(customerId))
            .ToList();
        var version = customerVersions.FirstOrDefault();
        if (version is not null)
        {
            return version;
        }

        version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customerId,
            WeekStartDate = weekStartDate,
            VersionNo = customerVersions.Count == 0 ? 1 : customerVersions.Max(item => item.VersionNo) + 1,
            Status = "DRAFT",
            SourceImportBatch = $"LEGACY-{weekStartDate:yyyyMMdd}",
            CreatedBy = actorId,
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        _context.Menuversions.Add(version);
        AddAudit(actorId, changedAt, "MenuVersion", nameof(MenuVersion), version.MenuVersionId,
            "VersionCreated", null, version.SourceImportBatch, "Tạo header version cho thực đơn tuần");
        return version;
    }

    private static MenuVersion? ResolveMenuVersion(IEnumerable<MenuVersion> versions, MenuSchedule schedule)
        => versions
            .Where(version =>
                version.WeekStartDate == schedule.WeekStartDate &&
                version.CustomerId.SequenceEqual(schedule.CustomerId))
            .OrderByDescending(version => version.VersionNo)
            .FirstOrDefault();

    private static MenuVersion? ResolveRollbackTarget(
        IReadOnlyList<MenuVersion> versions,
        MenuVersion current,
        RollbackMenuVersionRequest request)
    {
        // Id phiên bản sai định dạng phải báo lỗi: rơi xuống nhánh dưới sẽ rollback về **phiên bản khác**
        // với phiên bản người dùng chọn, kéo theo hủy nhu cầu và đơn mua của tuần đó.
        var requestedTargetId = GuidHelper.ParseFilterIdOrThrow(request.TargetMenuVersionId, "phiên bản thực đơn đích");
        if (requestedTargetId is not null)
        {
            return versions.FirstOrDefault(version => version.MenuVersionId.SequenceEqual(requestedTargetId));
        }

        if (request.TargetVersionNo is not null)
        {
            return versions.FirstOrDefault(version => version.VersionNo == request.TargetVersionNo.Value);
        }

        return versions
            .Where(version => version.VersionNo < current.VersionNo)
            .OrderByDescending(version => version.PublishedAt.HasValue)
            .ThenByDescending(version => version.VersionNo)
            .FirstOrDefault();
    }

    private async Task<(int CancelledDemandCount, int CancelledPurchaseCount)> InvalidateWorkflowDocumentsForMenuRollbackAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        MenuVersion targetVersion,
        byte[] actorId,
        DateTime changedAt,
        string rollbackReason)
    {
        var reason = $"Rollback menu to V{targetVersion.VersionNo}: {rollbackReason}; regenerate demand required.";
        var materialRequests = await _context.Materialrequests
            .Include(request => request.Plan)
            .Where(request =>
                request.Status != "CANCELLED" &&
                request.Plan.WeekStartDate == weekStartDate &&
                request.Plan.CustomerId != null &&
                request.Plan.CustomerId.SequenceEqual(customerId))
            .ToListAsync();

        foreach (var request in materialRequests)
        {
            AddAudit(actorId, changedAt, "Demand", nameof(MaterialRequest), request.RequestId,
                nameof(MaterialRequest.Status), request.Status, "CANCELLED", reason);
            request.Status = "CANCELLED";
        }

        var purchaseRequests = await _context.Purchaserequests
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
                    .ThenInclude(line => line.Request)
                        .ThenInclude(materialRequest => materialRequest.Plan)
            .Where(request =>
                request.Status != "CANCELLED" &&
                request.Purchaserequestlines.Any(line =>
                    line.MaterialRequestLine.Request.Plan.WeekStartDate == weekStartDate &&
                    line.MaterialRequestLine.Request.Plan.CustomerId != null &&
                    line.MaterialRequestLine.Request.Plan.CustomerId.SequenceEqual(customerId)))
            .ToListAsync();

        foreach (var request in purchaseRequests)
        {
            AddAudit(actorId, changedAt, "Purchase", nameof(PurchaseRequest), request.PurchaseRequestId,
                nameof(PurchaseRequest.Status), request.Status, "CANCELLED", reason);
            request.Status = "CANCELLED";
        }

        return (materialRequests.Count, purchaseRequests.Count);
    }

    private static MenuScheduleDto MapMenuSchedule(MenuSchedule schedule, MenuVersion? version = null)
        => new()
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
            MenuPrice = DecimalPolicy.RoundMoney(schedule.MenuPrice),
            BomRatePercent = FixedBomRatePercent,
            Status = schedule.Status,
            MenuVersionId = version is null ? null : GuidHelper.ToGuidString(version.MenuVersionId),
            MenuVersionNo = version?.VersionNo,
            MenuVersionStatus = version?.Status,
            PublishedBy = version?.PublishedBy is null ? null : GuidHelper.ToGuidString(version.PublishedBy),
            PublishedAt = version?.PublishedAt?.ToString("O"),
            SourceImportBatch = version?.SourceImportBatch,
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
        };

    private async Task<byte[]?> ResolveOptionalDishIdAsync(string? dishId)
    {
        if (string.IsNullOrWhiteSpace(dishId))
        {
            return null;
        }

        var dishIdBytes = GuidHelper.ParseGuidString(dishId)
            ?? throw new ArgumentException("Món ăn không hợp lệ.");
        var exists = await _context.Dishes
            .AsNoTracking()
            .AnyAsync(item => item.DishId == dishIdBytes);
        if (!exists)
        {
            throw new ArgumentException("Không tìm thấy món ăn để tạo portion rule.");
        }

        return dishIdBytes;
    }

    private async Task ValidatePortionRuleAsync(PortionRule rule, byte[]? excludeRuleId)
    {
        if (rule.EffectiveTo is not null && rule.EffectiveTo.Value < rule.EffectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        if (rule.PortionRatePercent <= 0 || rule.PortionRatePercent > 300)
        {
            throw new ArgumentException("Tỷ lệ portion phải trong khoảng 0-300%.");
        }

        if (rule.YieldLossPercent is not null && (rule.YieldLossPercent < 0 || rule.YieldLossPercent >= 100))
        {
            throw new ArgumentException("Tỷ lệ hao hụt phải trong khoảng 0-99.99%.");
        }

        if (!string.Equals(rule.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var existingRules = await _context.Portionrules
            .AsNoTracking()
            .Where(item => item.CustomerId == rule.CustomerId && item.Status == "ACTIVE")
            .ToListAsync();
        var hasOverlap = existingRules.Any(existing =>
            (excludeRuleId is null || !existing.PortionRuleId.SequenceEqual(excludeRuleId)) &&
            DatesOverlap(existing.EffectiveFrom, existing.EffectiveTo, rule.EffectiveFrom, rule.EffectiveTo) &&
            SamePortionRuleScope(existing, rule) &&
            CsvScopesOverlap(existing.ActiveWeekDays, rule.ActiveWeekDays) &&
            CsvScopesOverlap(existing.ShiftNames, rule.ShiftNames));
        if (hasOverlap)
        {
            throw new ArgumentException("Portion rule bị trùng hiệu lực trong cùng phạm vi khách hàng/ca/món.");
        }
    }

    private static bool SamePortionRuleScope(PortionRule left, PortionRule right)
        => SameOptionalBytes(left.DishId, right.DishId) &&
           string.Equals(NormalizeNullableCode(left.MenuVariant), NormalizeNullableCode(right.MenuVariant), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableText(left.MenuSectionName), NormalizeNullableText(right.MenuSectionName), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableCode(left.SlotName), NormalizeNullableCode(right.SlotName), StringComparison.Ordinal) &&
           string.Equals(NormalizeNullableText(left.DishCategory), NormalizeNullableText(right.DishCategory), StringComparison.Ordinal);

    private static bool SameOptionalBytes(byte[]? left, byte[]? right)
        => left is null
            ? right is null
            : right is not null && left.SequenceEqual(right);

    private static bool CsvScopesOverlap(string? left, string? right)
    {
        var leftValues = SplitOptionalCsv(left);
        var rightValues = SplitOptionalCsv(right);
        return leftValues.Count == 0 ||
               rightValues.Count == 0 ||
               leftValues.Any(item => rightValues.Contains(item, StringComparer.OrdinalIgnoreCase));
    }

    private static bool MatchesCsv(string? csv, string? value)
    {
        var values = SplitOptionalCsv(csv);
        if (values.Count == 0)
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(value) &&
               values.Contains(value, StringComparer.OrdinalIgnoreCase);
    }

    private static bool MatchesNullableScope(
        string? ruleValue,
        string? requestValue,
        Func<string?, string?> normalize)
    {
        var normalizedRuleValue = normalize(ruleValue);
        if (string.IsNullOrWhiteSpace(normalizedRuleValue))
        {
            return true;
        }

        return string.Equals(normalizedRuleValue, normalize(requestValue), StringComparison.Ordinal);
    }

    private static int PortionRuleMatchScore(PortionRule rule)
    {
        var source = ResolvePortionRuleSource(rule);
        var baseScore = source switch
        {
            "DISH_OVERRIDE" => 400,
            "CATEGORY_SLOT" => 300,
            "CUSTOMER_SHIFT" => 200,
            _ => 100
        };

        return baseScore + rule.Priority;
    }

    private static string ResolvePortionRuleSource(PortionRule rule)
    {
        if (rule.DishId is not null)
        {
            return "DISH_OVERRIDE";
        }

        if (!string.IsNullOrWhiteSpace(rule.MenuVariant) ||
            !string.IsNullOrWhiteSpace(rule.MenuSectionName) ||
            !string.IsNullOrWhiteSpace(rule.SlotName) ||
            !string.IsNullOrWhiteSpace(rule.DishCategory))
        {
            return "CATEGORY_SLOT";
        }

        if (!string.IsNullOrWhiteSpace(rule.ActiveWeekDays) ||
            !string.IsNullOrWhiteSpace(rule.ShiftNames))
        {
            return "CUSTOMER_SHIFT";
        }

        return "CUSTOMER_DEFAULT";
    }

    private static string? NormalizePortionRuleStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToUpperInvariant() switch
        {
            "ACTIVE" or "PUBLISHED" => "ACTIVE",
            "DRAFT" => "DRAFT",
            "INACTIVE" or "DISABLED" => "INACTIVE",
            _ => null
        };
    }

    private static string? NormalizeNullableCode(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim().ToUpperInvariant();

    private static string? NormalizeNullableText(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();

    private static string? NormalizeOptionalWeekDays(IReadOnlyList<string>? values)
    {
        if (values is null || values.Count == 0)
        {
            return null;
        }

        var normalized = values
            .Select(NormalizeDayCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(DaySortOrder)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ngày áp dụng portion rule không hợp lệ.");
        }

        return string.Join(",", normalized);
    }

    private static string? NormalizeOptionalShiftNames(IReadOnlyList<string>? values)
    {
        if (values is null || values.Count == 0)
        {
            return null;
        }

        var normalized = values
            .Select(NormalizeShiftName)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ca áp dụng portion rule không hợp lệ.");
        }

        return string.Join(",", normalized.Select(item => item!).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(item => item));
    }

    private static IReadOnlyList<string> SplitOptionalCsv(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string BuildPortionRuleAuditValue(PortionRule rule)
        => $"{ResolvePortionRuleSource(rule)}; portion={rule.PortionRatePercent}; bom={rule.BomRatePercent?.ToString() ?? "-"}; status={rule.Status}";

    private static PortionRuleDto MapPortionRule(PortionRule rule)
        => new()
        {
            PortionRuleId = GuidHelper.ToGuidString(rule.PortionRuleId),
            CustomerId = GuidHelper.ToGuidString(rule.CustomerId),
            CustomerCode = rule.Customer.CustomerCode,
            CustomerName = rule.Customer.CustomerName,
            DishId = rule.DishId is null ? null : GuidHelper.ToGuidString(rule.DishId),
            DishCode = rule.Dish?.DishCode,
            DishName = rule.Dish?.DishName,
            EffectiveFrom = rule.EffectiveFrom.ToString("yyyy-MM-dd"),
            EffectiveTo = rule.EffectiveTo?.ToString("yyyy-MM-dd"),
            ActiveWeekDays = SplitOptionalCsv(rule.ActiveWeekDays),
            ShiftNames = SplitOptionalCsv(rule.ShiftNames),
            MenuVariant = rule.MenuVariant,
            MenuSectionName = rule.MenuSectionName,
            SlotName = rule.SlotName,
            DishCategory = rule.DishCategory,
            PortionRatePercent = rule.PortionRatePercent,
            BomRatePercent = rule.BomRatePercent,
            YieldLossPercent = rule.YieldLossPercent,
            Priority = rule.Priority,
            Status = rule.Status,
            Reason = rule.Reason,
            RuleSource = ResolvePortionRuleSource(rule)
        };

    private static byte[] ResolveActorId(string? userId)
        => GuidHelper.ParseGuidString(userId) ?? GuidHelper.NewId();

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

    private static string? NormalizeMenuScheduleStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return null;
        }

        return status.Trim().ToUpperInvariant() switch
        {
            "DRAFT" => "DRAFT",
            "ACTIVE" or "PUBLISHED" => "ACTIVE",
            "SUPERSEDED" or "ARCHIVED" => "SUPERSEDED",
            "LOCKED" => "LOCKED",
            _ => null
        };
    }

    private static bool IsPublishedMenuVersionStatus(string? status)
        => string.Equals(status, "ACTIVE", StringComparison.OrdinalIgnoreCase) ||
           string.Equals(status, "PUBLISHED", StringComparison.OrdinalIgnoreCase);

    private static bool IsLockedSchedule(MenuSchedule schedule)
        => string.Equals(schedule.Status, "LOCKED", StringComparison.OrdinalIgnoreCase);

    private IQueryable<MealQuantityPlanLine> QueryLines(DateOnly serviceDate, string? shiftName)
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

    private static CoordinationOrderDto MapOrder(MealQuantityPlanLine line)
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

    private static MealQuantityPlanDto MapMealQuantityPlan(
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

    private static string BuildQuickServingPlanCode(DateOnly serviceDate, string shiftName, string customerCode)
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

    private static DateOnly ResolveServiceDate(string? serviceDate, string? dayOfWeek)
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

    private static DateOnly ResolveWeekStartDate(string? weekStartDate)
    {
        if (!string.IsNullOrWhiteSpace(weekStartDate) &&
            DateOnly.TryParse(weekStartDate, out var parsedWeekStart))
        {
            return parsedWeekStart;
        }

        return ServiceCalendar.StartOfWeek(ServiceCalendar.Today());
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
