using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Services.Workflow;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class CoordinationService : ICoordinationService
{
    private readonly IpcManagementContext _context;
    private readonly IMaterialDemandService _materialDemandService;

    public CoordinationService(IpcManagementContext context, IMaterialDemandService materialDemandService)
    {
        _context = context;
        _materialDemandService = materialDemandService;
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

    public async Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync()
    {
        var customers = await _context.Customers
            .Include(customer => customer.Customercontracts)
            .Include(customer => customer.Menuschedules)
            .AsNoTracking()
            .OrderBy(customer => customer.CustomerCode)
            .ToListAsync();

        return customers.Select(MapCustomerContract).ToList();
    }

    public async Task<CustomerContractDto> CreateCustomerContractAsync(
        CreateCustomerContractDto request,
        string? userId)
    {
        var customerCode = NormalizeCustomerCode(request.CustomerCode);
        if (string.IsNullOrWhiteSpace(customerCode))
        {
            throw new ArgumentException("Mã khách hàng không được trống.");
        }

        var customerName = request.CustomerName.Trim();
        if (string.IsNullOrWhiteSpace(customerName))
        {
            throw new ArgumentException("Tên khách hàng không được trống.");
        }

        var exists = await _context.Customers
            .AsNoTracking()
            .AnyAsync(item => item.CustomerCode == customerCode);
        if (exists)
        {
            throw new ArgumentException("Mã khách hàng đã tồn tại.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var customer = new Customer
        {
            CustomerId = GuidHelper.NewId(),
            CustomerCode = customerCode,
            CustomerName = customerName,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            IsActive = request.IsActive ?? true
        };

        _context.Customers.Add(customer);
        AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
            "CustomerCreated", null, customer.CustomerCode, "Tạo khách hàng từ màn contract");

        var contractRequest = new UpdateCustomerContractDto
        {
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            ActiveWeekDays = request.ActiveWeekDays,
            ShiftNames = request.ShiftNames,
            DefaultMenuPrice = request.DefaultMenuPrice,
            DefaultBomRatePercent = request.DefaultBomRatePercent
        };
        var contract = ResolveMutableContract(customer, [], contractRequest, actorId, changedAt);
        ValidateNoOverlappingContract(customer.Customercontracts, contract);

        await _context.SaveChangesAsync();
        return MapCustomerContract(customer);
    }

    public async Task<CustomerContractDto?> UpdateCustomerContractAsync(
        string customerId,
        UpdateCustomerContractDto request,
        string? userId)
    {
        var customerIdBytes = GuidHelper.ParseGuidString(customerId);
        if (customerIdBytes is null)
        {
            return null;
        }

        var customer = await _context.Customers
            .Include(item => item.Customercontracts)
            .Include(item => item.Menuschedules)
            .FirstOrDefaultAsync(item => item.CustomerId == customerIdBytes);
        if (customer is null)
        {
            return null;
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request.CustomerName) &&
            !string.Equals(customer.CustomerName, request.CustomerName.Trim(), StringComparison.Ordinal))
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.CustomerName), customer.CustomerName, request.CustomerName.Trim(),
                "Cập nhật tên khách hàng/contract");
            customer.CustomerName = request.CustomerName.Trim();
        }

        if (request.Note is not null &&
            !string.Equals(customer.Note ?? string.Empty, request.Note.Trim(), StringComparison.Ordinal))
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.Note), customer.Note, request.Note.Trim(),
                "Cập nhật ghi chú/ràng buộc khách hàng");
            customer.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        }

        if (request.IsActive is not null && customer.IsActive != request.IsActive.Value)
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.IsActive), customer.IsActive.ToString(), request.IsActive.Value.ToString(),
                "Cập nhật trạng thái khách hàng");
            customer.IsActive = request.IsActive.Value;
        }

        var schedules = customer.Menuschedules
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToList();
        var contract = ResolveMutableContract(customer, schedules, request, actorId, changedAt);

        if (request.EffectiveFrom is not null || request.EffectiveTo is not null)
        {
            var nextEffectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực") ?? contract.EffectiveFrom;
            var nextEffectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
            if (nextEffectiveTo is not null && nextEffectiveTo.Value < nextEffectiveFrom)
            {
                throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
            }

            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.EffectiveFrom),
                contract.EffectiveFrom.ToString("yyyy-MM-dd"), nextEffectiveFrom.ToString("yyyy-MM-dd"),
                () => contract.EffectiveFrom = nextEffectiveFrom);
            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.EffectiveTo),
                contract.EffectiveTo?.ToString("yyyy-MM-dd"), nextEffectiveTo?.ToString("yyyy-MM-dd"),
                () => contract.EffectiveTo = nextEffectiveTo);
        }

        if (request.ActiveWeekDays is not null)
        {
            var nextWeekDays = NormalizeWeekDays(request.ActiveWeekDays, schedules);
            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.ActiveWeekDays),
                contract.ActiveWeekDays, string.Join(",", nextWeekDays),
                () => contract.ActiveWeekDays = string.Join(",", nextWeekDays));
        }

        if (request.ShiftNames is not null)
        {
            var nextShifts = NormalizeShiftNames(request.ShiftNames, schedules);
            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.ShiftNames),
                contract.ShiftNames, string.Join(",", nextShifts),
                () => contract.ShiftNames = string.Join(",", nextShifts));
        }

        if (request.DefaultMenuPrice is not null)
        {
            var nextPrice = DecimalPolicy.RoundMoney(request.DefaultMenuPrice.Value);
            if (nextPrice < 0)
            {
                throw new ArgumentException("Đơn giá menu mặc định không được âm.");
            }

            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.DefaultMenuPrice),
                contract.DefaultMenuPrice.ToString(), nextPrice.ToString(),
                () => contract.DefaultMenuPrice = nextPrice);
        }

        if (request.DefaultBomRatePercent is not null)
        {
            var nextBomRate = DecimalPolicy.RoundPercent(request.DefaultBomRatePercent.Value);
            if (nextBomRate <= 0 || nextBomRate > 300)
            {
                throw new ArgumentException("Tỷ lệ BOM mặc định phải trong khoảng 0-300%.");
            }

            UpdateContractField(actorId, changedAt, contract, nameof(Customercontract.DefaultBomRatePercent),
                contract.DefaultBomRatePercent.ToString(), nextBomRate.ToString(),
                () => contract.DefaultBomRatePercent = nextBomRate);
        }

        contract.UpdatedAt = changedAt;
        ValidateNoOverlappingContract(customer.Customercontracts, contract);
        ApplyContractToUnlockedSchedules(contract, schedules, actorId, changedAt);

        await _context.SaveChangesAsync();
        return MapCustomerContract(customer);
    }

    public async Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
        string menuScheduleId,
        UpdateMenuScheduleRulesDto request,
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
                AddAudit(actorId, changedAt, "CustomerContract", nameof(Menuschedule), schedule.MenuScheduleId,
                    nameof(Menuschedule.MenuPrice), schedule.MenuPrice.ToString(), nextPrice.ToString(), reason);
                schedule.MenuPrice = nextPrice;
            }
        }

        if (request.BomRatePercent is not null)
        {
            var nextBomRate = DecimalPolicy.RoundPercent(request.BomRatePercent.Value);
            if (nextBomRate <= 0 || nextBomRate > 300)
            {
                throw new ArgumentException("Tỷ lệ BOM phải trong khoảng 0-300%.");
            }

            if (schedule.BomRatePercent != nextBomRate)
            {
                AddAudit(actorId, changedAt, "PortionRule", nameof(Menuschedule), schedule.MenuScheduleId,
                    nameof(Menuschedule.BomRatePercent), schedule.BomRatePercent.ToString(), nextBomRate.ToString(), reason);
                schedule.BomRatePercent = nextBomRate;
            }
        }

        var status = NormalizeMenuScheduleStatus(request.Status);
        if (status is not null && !string.Equals(schedule.Status, status, StringComparison.OrdinalIgnoreCase))
        {
            AddAudit(actorId, changedAt, "MenuVersion", nameof(Menuschedule), schedule.MenuScheduleId,
                nameof(Menuschedule.Status), schedule.Status, status, reason);
            schedule.Status = status;
        }

        await _context.SaveChangesAsync();
        var version = await GetLatestMenuVersionAsync(schedule.CustomerId, schedule.WeekStartDate);
        return MapMenuSchedule(schedule, version);
    }

    public async Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
        string menuScheduleId,
        UpdateMenuScheduleVersionDto request,
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
                nameof(Menuversion),
                version.MenuVersionId,
                nameof(Menuversion.Status),
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
                nameof(Menuschedule),
                weekSchedule.MenuScheduleId,
                nameof(Menuschedule.Status),
                weekSchedule.Status,
                status,
                string.IsNullOrWhiteSpace(request.Reason) ? "Cập nhật version thực đơn" : request.Reason.Trim());
            weekSchedule.Status = status;
        }

        await _context.SaveChangesAsync();
        return MapMenuSchedule(schedule, version);
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

            string? warning = null;
            try
            {
                await _materialDemandService.GenerateAsync(
                    new GenerateMaterialDemandRequestDto
                    {
                        ServiceDate = line.QuantityPlan.ServiceDate.ToString("yyyy-MM-dd"),
                        Scope = "FULLDAY"
                    },
                    userId);
            }
            catch (Exception ex)
            {
                warning = $"Đã cập nhật số suất thành công, nhưng tự động tính nhu cầu mua hàng gặp lỗi: {ex.Message}";
            }

            return new AdjustServingsResultDto
            {
                Success = true,
                OrderId = GuidHelper.ToGuidString(line.QuantityPlanLineId),
                OldServings = oldValue,
                NewServings = request.ServingsQuantity,
                ChangedAt = changedAt,
                AuditId = GuidHelper.ToGuidString(auditId),
                Warning = warning
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<AdjustServingsResultDto?> UpdateForecastServingsAsync(
        string orderId,
        UpdateForecastServingsRequestDto request,
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

        if (!string.Equals(line.QuantityPlan.Status, "DRAFT", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(line.QuantityPlan.Status, "FORECASTED", StringComparison.OrdinalIgnoreCase))
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

            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = auditId,
                ChangedAt = changedAt,
                ChangedBy = userIdBytes,
                BusinessArea = "Coordination",
                EntityName = nameof(Mealquantityplanline),
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

    private async Task<Menuschedule?> FindMenuScheduleForUpdateAsync(string menuScheduleId)
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

    private Customercontract ResolveMutableContract(
        Customer customer,
        IReadOnlyList<Menuschedule> schedules,
        UpdateCustomerContractDto request,
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
            ?? DateOnly.FromDateTime(changedAt);
        var effectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        if (effectiveTo is not null && effectiveTo.Value < effectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        var defaultMenuPrice = request.DefaultMenuPrice is null
            ? ResolveDefaultMenuPrice(schedules)
            : DecimalPolicy.RoundMoney(request.DefaultMenuPrice.Value);
        var defaultBomRate = request.DefaultBomRatePercent is null
            ? ResolveDefaultBomRate(schedules)
            : DecimalPolicy.RoundPercent(request.DefaultBomRatePercent.Value);
        if (defaultMenuPrice < 0)
        {
            throw new ArgumentException("Đơn giá menu mặc định không được âm.");
        }
        if (defaultBomRate <= 0 || defaultBomRate > 300)
        {
            throw new ArgumentException("Tỷ lệ BOM mặc định phải trong khoảng 0-300%.");
        }

        var contract = new Customercontract
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
        AddAudit(actorId, changedAt, "CustomerContract", nameof(Customercontract), contract.ContractId,
            "ContractCreated", null, GuidHelper.ToGuidString(customer.CustomerId), "Tạo contract hiệu lực cho khách hàng");
        return contract;
    }

    private static Customercontract? ResolveActiveContract(IEnumerable<Customercontract> contracts)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
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
        Customercontract contract,
        string fieldName,
        string? oldValue,
        string? newValue,
        Action apply)
    {
        if (string.Equals(oldValue ?? string.Empty, newValue ?? string.Empty, StringComparison.Ordinal))
        {
            return;
        }

        AddAudit(actorId, changedAt, "CustomerContract", nameof(Customercontract), contract.ContractId,
            fieldName, oldValue, newValue, "Cập nhật contract hiệu lực của khách hàng");
        apply();
    }

    private void ApplyContractToUnlockedSchedules(
        Customercontract contract,
        IReadOnlyList<Menuschedule> schedules,
        byte[] actorId,
        DateTime changedAt)
    {
        var activeDays = SplitCsv(contract.ActiveWeekDays).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var shifts = SplitCsv(contract.ShiftNames).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var schedule in schedules.Where(schedule => !IsLockedSchedule(schedule) && MatchesContract(schedule, contract, activeDays, shifts)))
        {
            if (schedule.MenuPrice != contract.DefaultMenuPrice)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(Menuschedule), schedule.MenuScheduleId,
                    nameof(Menuschedule.MenuPrice), schedule.MenuPrice.ToString(), contract.DefaultMenuPrice.ToString(),
                    "Áp dụng đơn giá mặc định từ contract khách hàng");
                schedule.MenuPrice = contract.DefaultMenuPrice;
            }

            if (schedule.BomRatePercent != contract.DefaultBomRatePercent)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(Menuschedule), schedule.MenuScheduleId,
                    nameof(Menuschedule.BomRatePercent), schedule.BomRatePercent.ToString(), contract.DefaultBomRatePercent.ToString(),
                    "Áp dụng tỷ lệ BOM mặc định từ contract khách hàng");
                schedule.BomRatePercent = contract.DefaultBomRatePercent;
            }
        }
    }

    private static void ValidateNoOverlappingContract(
        IEnumerable<Customercontract> contracts,
        Customercontract target)
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
        Menuschedule schedule,
        Customercontract contract,
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
        IReadOnlyList<Menuschedule> schedules)
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
        IReadOnlyList<Menuschedule> schedules)
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

    private static decimal ResolveDefaultMenuPrice(IReadOnlyList<Menuschedule> schedules)
        => schedules.Count == 0
            ? 25000
            : DecimalPolicy.RoundMoney(schedules.Average(schedule => schedule.MenuPrice));

    private static decimal ResolveDefaultBomRate(IReadOnlyList<Menuschedule> schedules)
        => schedules.Count == 0
            ? 100
            : DecimalPolicy.RoundPercent(schedules.Average(schedule => schedule.BomRatePercent));

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
            DefaultBomRatePercent = contract is null ? (schedules.Count == 0 ? null : ResolveDefaultBomRate(schedules)) : contract.DefaultBomRatePercent,
            LatestServiceDate = schedules.LastOrDefault()?.ServiceDate.ToString("yyyy-MM-dd")
        };
    }

    private async Task<IReadOnlyList<Menuversion>> LoadMenuVersionsAsync(IReadOnlyList<Menuschedule> schedules)
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

    private async Task<Menuversion?> GetLatestMenuVersionAsync(byte[] customerId, DateOnly weekStartDate)
    {
        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync();

        return versions.FirstOrDefault(version => version.CustomerId.SequenceEqual(customerId));
    }

    private async Task<Menuversion> EnsureMenuVersionAsync(
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

        version = new Menuversion
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
        AddAudit(actorId, changedAt, "MenuVersion", nameof(Menuversion), version.MenuVersionId,
            "VersionCreated", null, version.SourceImportBatch, "Tạo header version cho thực đơn tuần");
        return version;
    }

    private static Menuversion? ResolveMenuVersion(IEnumerable<Menuversion> versions, Menuschedule schedule)
        => versions
            .Where(version =>
                version.WeekStartDate == schedule.WeekStartDate &&
                version.CustomerId.SequenceEqual(schedule.CustomerId))
            .OrderByDescending(version => version.VersionNo)
            .FirstOrDefault();

    private static MenuScheduleDto MapMenuSchedule(Menuschedule schedule, Menuversion? version = null)
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
            BomRatePercent = DecimalPolicy.RoundPercent(schedule.BomRatePercent),
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
        _context.Auditlogs.Add(new Auditlog
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

    private static bool IsLockedSchedule(Menuschedule schedule)
        => string.Equals(schedule.Status, "LOCKED", StringComparison.OrdinalIgnoreCase);

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
