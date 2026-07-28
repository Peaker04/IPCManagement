using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class OrderSignoffService : IOrderSignoffService
{
    private readonly IpcManagementContext _context;

    public OrderSignoffService(IpcManagementContext context)
    {
        _context = context;
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
            throw new InvalidOperationException("Chỉ có thể hoàn tất ca sau khi kế hoạch đã được chốt.");
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

        var serviceDate = OrderLifecyclePolicy.ResolveServiceDate(request.ServiceDate, request.DayOfWeek);
        var shiftName = OrderLifecyclePolicy.NormalizeShiftName(request.ShiftName ?? request.Shift);
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
}
