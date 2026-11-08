using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class OrderPlanService : IOrderPlanService
{
    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;

    public OrderPlanService(IpcManagementContext context, IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _transactionRunner = transactionRunner;
    }

    public async Task<IReadOnlyList<CoordinationOrderDto>> GetActiveOrdersAsync(CoordinationOrdersQueryDto query)
    {
        var serviceDate = OrderLifecyclePolicy.ResolveServiceDate(query.ServiceDate, query.DayOfWeek);
        var shiftName = OrderLifecyclePolicy.NormalizeShiftName(query.ShiftName ?? query.Shift)
            ?? throw new ArgumentException("Ca phục vụ không hợp lệ.");
        var lines = await QueryLines(serviceDate, shiftName)
            .AsNoTracking()
            .OrderBy(line => line.Customer.CustomerCode)
            .ToListAsync();
        return lines.Select(OrderLifecyclePolicy.MapOrder).ToList();
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

        var serviceDate = OrderLifecyclePolicy.ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var scope = OrderLifecyclePolicy.NormalizeScope(request.Scope);
        var shiftName = OrderLifecyclePolicy.NormalizeShiftName(request.ShiftName ?? request.Shift);
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

        return await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var lines = await QueryLines(serviceDate, scope == "FULLDAY" ? null : shiftName)
                    .ToListAsync(cancellationToken);
                if (lines.Count == 0)
                {
                    return null;
                }

                await EnsureMenusPublishedAsync(
                    _context.Mealquantityplanlines.Where(line =>
                        line.QuantityPlan.ServiceDate == serviceDate &&
                        (scope == "FULLDAY" || line.ShiftName == shiftName)),
                    "chốt số suất",
                    cancellationToken);

                var plans = lines
                    .Select(line => line.QuantityPlan)
                    .DistinctBy(plan => Convert.ToBase64String(plan.QuantityPlanId))
                    .ToList();
                var invalidPlan = plans.FirstOrDefault(plan =>
                    !OrderStatus.CanTransition(plan.Status, OrderStatus.Confirmed));
                if (invalidPlan is not null)
                {
                    throw new BusinessRuleException(
                        $"Chỉ có thể chốt kế hoạch đang ở trạng thái nháp hoặc dự báo. " +
                        $"Kế hoạch {invalidPlan.PlanCode} hiện ở trạng thái {OrderStatus.Normalize(invalidPlan.Status)}.");
                }

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

                await _context.SaveChangesAsync(cancellationToken);
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
            },
            async cancellationToken =>
            {
                var statuses = await QueryLines(serviceDate, scope == "FULLDAY" ? null : shiftName)
                    .AsNoTracking()
                    .Select(line => line.QuantityPlan.Status)
                    .ToListAsync(cancellationToken);
                return statuses.Count > 0 && statuses.All(status =>
                    string.Equals(OrderStatus.Normalize(status), OrderStatus.Confirmed, StringComparison.Ordinal));
            });
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
            throw new BusinessRuleException("Chỉ có thể mở khóa kế hoạch đang ở trạng thái chốt hoặc điều chỉnh.");
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
            throw new BusinessRuleException(
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

        var serviceDate = OrderLifecyclePolicy.ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = OrderLifecyclePolicy.NormalizeShiftName(request.ShiftName ?? request.Shift);
        if (shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        return await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var plans = await _context.Mealquantityplans
                    .Include(plan => plan.Mealquantityplanlines)
                    .Where(plan =>
                        plan.ServiceDate == serviceDate &&
                        plan.Mealquantityplanlines.Any(line => line.ShiftName == shiftName))
                    .ToListAsync(cancellationToken);
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
                    throw new BusinessRuleException(
                        $"Chỉ có thể mở khóa khi tất cả kế hoạch trong ca đang được chốt. " +
                        $"Kế hoạch {invalidPlan.PlanCode} hiện ở trạng thái {OrderStatus.Normalize(invalidPlan.Status)}.");
                }

                var oldStatuses = plans
                    .Select(plan => OrderStatus.Normalize(plan.Status))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(status => status)
                    .ToList();
                var changedAt = DateTime.UtcNow;
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

                try
                {
                    await _context.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateConcurrencyException)
                {
                    throw new BusinessRuleException(
                        "Một kế hoạch trong ca đã được người khác chỉnh sửa. Vui lòng tải lại trang.");
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
            },
            async cancellationToken =>
            {
                var statuses = await _context.Mealquantityplans
                    .AsNoTracking()
                    .Where(plan =>
                        plan.ServiceDate == serviceDate &&
                        plan.Mealquantityplanlines.Any(line => line.ShiftName == shiftName))
                    .Select(plan => plan.Status)
                    .ToListAsync(cancellationToken);
                return statuses.Count > 0 && statuses.All(status =>
                    string.Equals(OrderStatus.Normalize(status), OrderStatus.Draft, StringComparison.Ordinal));
            });
    }

    public Task<ExportOrderReportResultDto> ExportOrderReportAsync(ExportOrderReportRequest request)
    {
        var serviceDate = OrderLifecyclePolicy.ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = OrderLifecyclePolicy.NormalizeShiftName(request.ShiftName ?? request.Shift);
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

    private async Task EnsureMenusPublishedAsync(
        IQueryable<MealQuantityPlanLine> lines,
        string actionLabel,
        CancellationToken cancellationToken)
    {
        var hasUnpublishedMenu = await lines
            .AsNoTracking()
            .AnyAsync(line =>
                line.MenuSchedule.Status != "ACTIVE" ||
                (line.MenuSchedule.MenuVersionId != null &&
                 !_context.Menuversions.Any(version =>
                     version.MenuVersionId == line.MenuSchedule.MenuVersionId &&
                     (version.Status == "ACTIVE" || version.Status == "PUBLISHED"))),
                cancellationToken);
        if (hasUnpublishedMenu)
        {
            throw new BusinessRuleException(
                $"Không thể {actionLabel} khi thực đơn chưa được phát hành. " +
                "Hãy phát hành phiên bản thực đơn trước khi tiếp tục.");
        }
    }
}
