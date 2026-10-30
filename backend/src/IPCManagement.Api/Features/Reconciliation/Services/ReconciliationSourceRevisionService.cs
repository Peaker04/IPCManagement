using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed record ReconciliationRevisionContributionFact(
    string MenuScheduleId,
    string MealQuantityPlanLineId,
    string DishBomId,
    string DishId,
    string ShiftName,
    string DishCode,
    string DishName,
    int Servings,
    decimal BomQuantityPerServing,
    decimal WasteRatePercent,
    decimal SourceQuantity,
    string? MenuVariant = null);

public sealed record ReconciliationRevisionMaterialFact(
    DateOnly ServiceDate,
    string IngredientId,
    string CanonicalUnitId,
    decimal RequiredQuantity,
    IReadOnlyList<ReconciliationRevisionContributionFact>? Contributions = null);

public sealed class ReconciliationSourceRevisionService(IpcManagementContext context) : IReconciliationSourceRevisionStager
{
    public async Task<PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>> GetPendingPageAsync(
        ReconciliationSourceDeltaPageQuery request,
        CancellationToken token = default)
    {
        var query = context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(item => item.Status == "PENDING");
        if (!string.IsNullOrWhiteSpace(request.BatchId))
        {
            var batchId = ReconciliationBatchService.RequiredId(request.BatchId);
            query = query.Where(item => item.BatchId == batchId);
        }
        if (request.ServiceDate is { } serviceDate)
            query = query.Where(item => item.ServiceDate == serviceDate);
        if (!string.IsNullOrWhiteSpace(request.WorkKind))
        {
            var workKind = request.WorkKind.Trim().ToUpperInvariant();
            if (workKind is not ("SUPPLEMENTAL_ISSUE" or "RETURN_REQUIRED"))
                throw new ArgumentException("Loại công việc thay đổi nguồn không hợp lệ.");
            query = query.Where(item => item.WorkKind == workKind);
        }

        var total = await query.CountAsync(token);
        var rows = await (
                from item in query
                join daily in context.Reconciliationbatchdailylines.AsNoTracking() on item.DailyLineId equals daily.DailyLineId
                join line in context.Reconciliationbatchlines.AsNoTracking() on daily.BatchLineId equals line.BatchLineId
                join ingredient in context.Ingredients.AsNoTracking() on item.IngredientId equals ingredient.IngredientId
                join unit in context.Units.AsNoTracking() on item.CanonicalUnitId equals unit.UnitId
                orderby item.CreatedAt, item.SourceDeltaId
                select new ReconciliationSourceDeltaQueueItemDto(
                    GuidHelper.ToGuidString(item.SourceDeltaId), GuidHelper.ToGuidString(item.SourceRevisionId),
                    GuidHelper.ToGuidString(item.BatchId), GuidHelper.ToGuidString(daily.DailyLineId), item.ServiceDate,
                    GuidHelper.ToGuidString(item.IngredientId), ingredient.IngredientCode,
                    ingredient.IngredientName, GuidHelper.ToGuidString(item.CanonicalUnitId),
                    unit.UnitName, item.PreviousRequiredQuantity,
                    item.NewRequiredQuantity, item.DeltaQuantity, item.WorkKind, item.Status, item.Version, item.CreatedAt))
            .Skip((request.PageNumber - 1) * request.PageSize).Take(request.PageSize)
            .ToListAsync(token);
        return PagedResponseDto<ReconciliationSourceDeltaQueueItemDto>.Create(rows, total, request.PageNumber, request.PageSize);
    }

    /// <summary>
    /// BR-MRX-EDIT-5: sau khi nguồn đổi, tính lại tại chỗ mọi lô chưa hoàn tất của căn tin × tuần (qua <see cref="MenuVersion"/>),
    /// chỉ cho các ngày chưa khóa. Không tìm lô theo phiên bản gốc vì <c>batch.MenuVersionId</c> luôn trỏ phiên bản mới nhất.
    /// </summary>
    public async Task StageAffectedBatchesAsync(
        string amendmentId,
        byte[] baseMenuVersionId,
        byte[] newMenuVersionId,
        string? actorUserId,
        string reason,
        IReadOnlyList<MenuSchedule> schedules,
        CancellationToken cancellationToken = default)
    {
        var affectedBatchIds = new List<byte[]>();
        foreach (var scope in schedules.Select(schedule => (schedule.CustomerId, schedule.WeekStartDate))
                     .DistinctBy(scope => (Convert.ToHexString(scope.CustomerId), scope.WeekStartDate)))
        {
            affectedBatchIds.AddRange(await (
                    from batch in context.Reconciliationbatches.AsNoTracking()
                    join version in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals version.MenuVersionId
                    where version.CustomerId == scope.CustomerId && version.WeekStartDate == scope.WeekStartDate && batch.Status != "COMPLETED"
                    orderby batch.CreatedAt
                    select batch.BatchId)
                .ToListAsync(cancellationToken));
        }
        if (affectedBatchIds.Count == 0) return;

        var actorId = ReconciliationBatchService.RequiredId(actorUserId ?? string.Empty);
        // Đường duyệt yêu cầu hiện tại chưa truyền vai trò/chế độ; đọc vai trò từ người áp dụng (Task 6 nối lại qua MrxSourceChangeApplier).
        var actorRole = await context.Users.AsNoTracking()
            .Where(user => user.UserId == actorId).Select(user => user.Role.RoleCode)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new UnauthorizedAccessException("Không xác định được vai trò người áp dụng thay đổi nguồn.");
        var amendmentBytes = ReconciliationBatchService.RequiredId(amendmentId);
        var requirements = await MrxBatchRecomputer.LoadRequirementsAsync(
            context, schedules.Select(schedule => schedule.MenuScheduleId).ToList(), cancellationToken);
        var recomputer = new MrxBatchRecomputer(context);

        foreach (var batchId in affectedBatchIds)
        {
            var batch = await MrxBatchRecomputer.LoadBatchAsync(context, batchId, cancellationToken);
            var lockedDates = await MrxDayLockReader.GetLockedDatesAsync(context, batchId, cancellationToken);
            await recomputer.ApplyAsync(batch, requirements, lockedDates,
                new MrxRevisionStamp(actorId, actorRole, "APPROVED_REQUEST", reason,
                    batch.MenuVersionId, newMenuVersionId, amendmentBytes),
                cancellationToken);
        }
    }
}
