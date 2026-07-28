using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class OrderAdjustmentService : IOrderAdjustmentService
{
    private readonly IpcManagementContext _context;

    public OrderAdjustmentService(IpcManagementContext context)
    {
        _context = context;
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
            throw new BusinessRuleException("Chỉ có thể điều chỉnh sau khi kế hoạch đã được chốt.");
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
                throw new BusinessRuleException("Dòng này đang có yêu cầu điều chỉnh chờ duyệt.");
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

        throw new BusinessRuleException(
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
            throw new BusinessRuleException("Chỉ có thể cập nhật số suất dự kiến trước khi kế hoạch được chốt.");
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
}
