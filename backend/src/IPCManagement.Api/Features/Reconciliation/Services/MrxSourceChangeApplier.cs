using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

/// <summary>
/// BR-MRX-EDIT-1..9 (spec §4.1): đường ghi duy nhất cho thay đổi nguồn MRX — áp dụng trực tiếp, duyệt yêu cầu và import lại.
/// Một giao dịch serializable: kiểm tra phiên bản/khóa ngày → phiên bản thực đơn mới + số suất Mặn/Chay → tính lại lô cho ngày chưa khóa.
/// </summary>
public sealed class MrxSourceChangeApplier(
    IpcManagementContext context,
    IEfTransactionRunner? transactionRunner = null,
    SystemOperationRequestContext? operationContext = null)
{
    public const string DirectMode = "DIRECT";
    public const string ApprovedRequestMode = "APPROVED_REQUEST";
    public const string ReimportMode = "REIMPORT";

    /// <summary>Vai trò ghi vào revision, lấy từ claims của người dùng hiện tại (BR-MRX-EDIT-1/8).</summary>
    public static string ResolveActorRole(IEnumerable<string> roleNames)
    {
        var roles = roleNames.ToList();
        if (roles.Any(AuthorizationPolicies.IsAdminRole)) return "ADMIN";
        if (roles.Any(AuthorizationPolicies.MatchesManagerRole)) return "MANAGER";
        throw new UnauthorizedAccessException("Chỉ Admin hoặc Quản lý được áp dụng thay đổi nguồn MRX.");
    }

    /// <summary>Xem trước thay đổi nguồn MRX: dòng thay đổi thật, ngày khóa và định lượng trước/sau của ngày mở; không ghi.</summary>
    public async Task<MenuAmendmentResultDto> PreviewAsync(CreateMenuAmendmentRequest request, CancellationToken ct = default)
    {
        var (customerId, baseVersionId) = ValidateRequest(request);
        var scope = await LoadScopeAsync(customerId, request.WeekStartDate, baseVersionId, tracked: false, ct);
        var locked = scope.Batch is null ? new HashSet<DateOnly>() : await MrxDayLockReader.GetLockedDatesAsync(context, scope.Batch.BatchId, ct);
        var changed = (await BuildImpactAsync(scope, request.Lines, ct)).Where(row => row.Changed).ToList();
        if (changed.Count == 0) throw new BusinessRuleException("Dòng thay đổi phải đổi món hoặc số suất.");
        return new MenuAmendmentResultDto
        {
            Status = "PREVIEW",
            AffectedReconciliationBatchIds = scope.Batch is null ? [] : [GuidHelper.ToGuidString(scope.Batch.BatchId)],
            ImpactLines = changed.Select(row => row.Dto).ToList(),
            LockedDates = locked.Order().ToList(),
            MaterialImpact = await PreviewMaterialImpactAsync(scope, changed.Where(row => !locked.Contains(row.Schedule.ServiceDate)).ToList(), ct)
        };
    }

    /// <summary>
    /// Áp dụng một thay đổi nguồn MRX (mới tạo hoặc yêu cầu đang chờ duyệt) trong một giao dịch serializable theo §4.1.
    /// Dòng giống hệt nguồn bị bỏ qua; dòng khác nguồn trên ngày khóa → <c>MRX_DAY_LOCKED</c>, không ghi gì.
    /// </summary>
    public async Task<MenuAmendmentResultDto> ApplyAsync(
        MenuAmendment amendment, byte[] actorId, string actorRole, string applyMode, long? expectedBatchVersion, CancellationToken ct)
    {
        if (actorRole is not ("ADMIN" or "MANAGER"))
            throw new UnauthorizedAccessException("Chỉ Admin hoặc Quản lý được áp dụng thay đổi nguồn MRX.");
        if (string.IsNullOrWhiteSpace(amendment.Reason))
            throw new BusinessRuleException("Thay đổi nguồn cần nêu lý do.");
        var amendmentId = amendment.MenuAmendmentId;
        IReadOnlyList<DateOnly> changedDates = [];
        byte[]? batchId = null;
        try
        {
            return await RunMrxTransactionAsync(
                transactionRunner ?? new EfTransactionRunner(context), operationContext,
                token => ApplyCoreAsync(amendment, actorId, actorRole, applyMode, expectedBatchVersion,
                    (dates, id) => { changedDates = dates; batchId = id; }, token),
                token => context.Menuamendments.AsNoTracking().AnyAsync(item => item.MenuAmendmentId.SequenceEqual(amendmentId) && item.Status == "EXECUTED", token),
                ct);
        }
        catch (DbUpdateConcurrencyException) when (batchId is not null)
        {
            // §4.1 bước 6: tạo phiếu xuất cũng tăng batch.Version; phía sửa nguồn thua trả DAY_LOCKED nếu ngày vừa bị khóa.
            context.ChangeTracker.Clear();
            var locked = await MrxDayLockReader.GetLockedDatesAsync(context, batchId, ct);
            var touched = changedDates.Where(locked.Contains).Order().ToList();
            throw touched.Count > 0 ? DayLocked(touched) : Stale("Lô đối soát vừa được cập nhật bởi thao tác khác. Vui lòng tải lại.");
        }
    }

    internal static Task<T> RunMrxTransactionAsync<T>(
        IEfTransactionRunner runner,
        SystemOperationRequestContext? operationContext,
        Func<CancellationToken, Task<T>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        CancellationToken ct)
    {
        if (operationContext is null)
            return runner.ExecuteAsync(operation, verifySucceeded, IsolationLevel.Serializable, ct);
        if (string.IsNullOrWhiteSpace(operationContext.OperationKey) || operationContext.ExpectedModeVersion is null)
            throw new InvalidOperationException("MRX source change requires operation-mode version protection.");
        return runner.ExecuteProtectedAsync(operationContext.OperationKey, operationContext.ExpectedModeVersion.Value,
            operation, verifySucceeded, IsolationLevel.Serializable, ct);
    }

    private async Task<MenuAmendmentResultDto> ApplyCoreAsync(
        MenuAmendment amendment, byte[] actorId, string actorRole, string applyMode, long? expectedBatchVersion,
        Action<IReadOnlyList<DateOnly>, byte[]?> reportScope, CancellationToken token)
    {
        var tracked = await AttachAmendmentAsync(amendment, applyMode, actorId, token);
        var snapshot = ReadSnapshot(tracked.ImpactSnapshotJson);
        var baseVersionId = tracked.BaseMenuVersionId ?? throw Stale("Yêu cầu chưa gắn phiên bản thực đơn gốc. Vui lòng tạo lại.");
        var scope = await LoadScopeAsync(tracked.CustomerId, tracked.WeekStartDate, baseVersionId, tracked: true, token);
        var batch = scope.Batch;
        var locked = batch is null ? new HashSet<DateOnly>() : await MrxDayLockReader.GetLockedDatesAsync(context, batch.BatchId, token);

        var rows = await BuildImpactAsync(scope, snapshot.ImpactLines.Select(ToRequestLine).ToList(), token);
        if (rows.Zip(snapshot.ImpactLines).Any(pair => pair.First.Dto.CurrentSavoryServings != pair.Second.CurrentSavoryServings
                || pair.First.Dto.CurrentVegetarianServings != pair.Second.CurrentVegetarianServings))
            throw Stale("Số suất nguồn đã thay đổi kể từ lúc xem trước. Vui lòng tải lại.");
        var changed = rows.Where(row => row.Changed).ToList();
        reportScope(changed.Select(row => row.Schedule.ServiceDate).Distinct().ToList(), batch?.BatchId);
        var touchedLocked = changed.Select(row => row.Schedule.ServiceDate).Distinct().Where(locked.Contains).Order().ToList();
        if (touchedLocked.Count > 0) throw DayLocked(touchedLocked);
        if (changed.Count == 0) throw new BusinessRuleException("Không có dòng nào khác với nguồn hiện tại.");
        if (batch is not null && (expectedBatchVersion is null ? applyMode == DirectMode : expectedBatchVersion != batch.Version))
            throw Stale("Lô đối soát đã thay đổi kể từ lúc xem trước. Vui lòng tải lại.");

        var now = DateTime.UtcNow;
        var previousVersionId = batch?.MenuVersionId ?? baseVersionId;
        var version = await MenuAmendmentVersionMaterializer.MaterializeAmendedVersionAsync(context, tracked, scope.Schedules, actorId, now, token);
        foreach (var row in changed.Where(row => row.DishChanged))
        {
            var item = ResolveMenuItem(row.Schedule.Menu.Menuitems, row.Dto.DishSlot)
                ?? throw new BusinessRuleException("Không tìm thấy slot thực đơn nguồn.");
            item.DishId = row.NewDishId;
        }
        var scheduleIds = scope.Schedules.Select(item => item.MenuScheduleId).ToList();
        foreach (var planLine in await context.Mealquantityplanlines.Where(item => scheduleIds.Contains(item.MenuScheduleId)).ToListAsync(token))
        {
            var schedule = scope.Schedules.Single(item => item.MenuScheduleId.SequenceEqual(planLine.MenuScheduleId));
            planLine.MenuId = schedule.MenuId;
            planLine.Menu = schedule.Menu;
        }
        foreach (var row in changed.Where(row => row.ServingsChanged).DistinctBy(row => Convert.ToHexString(row.Schedule.MenuScheduleId)))
            WriteServings(row.PlanLine!, row.Dto.NewSavoryServings!.Value, row.Dto.NewVegetarianServings!.Value, actorId, tracked.Reason, now);
        await context.SaveChangesAsync(token);

        ReconciliationSourceRevision? revision = null;
        if (batch is not null)
        {
            // Yêu cầu định lượng cả tuần chỉ từ phiên bản hiện tại (ngày mở thiếu trong yêu cầu sẽ bị đưa về 0).
            var requirements = await MrxBatchRecomputer.LoadRequirementsAsync(context, batch.QuantityImportBatchId, scheduleIds, token);
            revision = await new MrxBatchRecomputer(context).ApplyAsync(batch, requirements, locked,
                new MrxRevisionStamp(actorId, actorRole, applyMode, tracked.Reason, previousVersionId, version.MenuVersionId, tracked.MenuAmendmentId),
                token);
        }

        var previousStatus = tracked.Status;
        tracked.Status = "EXECUTED";
        tracked.ReviewedBy ??= actorId;
        tracked.ReviewedAt ??= now;
        tracked.ExecutedBy = actorId;
        tracked.ExecutedAt = now;
        AddAudit(actorId, now, nameof(MenuAmendment), tracked.MenuAmendmentId, "Status", previousStatus, tracked.Status, tracked.Reason);
        await context.SaveChangesAsync(token);

        snapshot.MenuAmendmentId = GuidHelper.ToGuidString(tracked.MenuAmendmentId);
        snapshot.Status = tracked.Status;
        snapshot.AppliedMenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId);
        snapshot.AffectedReconciliationBatchIds = batch is null ? [] : [GuidHelper.ToGuidString(batch.BatchId)];
        snapshot.ImpactLines = changed.Select(row => row.Dto).ToList();
        snapshot.LockedDates = locked.Order().ToList();
        snapshot.MaterialImpact = revision is null ? [] : await NameImpactAsync(revision.Deltas.Select(delta =>
            (delta.ServiceDate, delta.IngredientId, delta.CanonicalUnitId, delta.PreviousRequiredQuantity, delta.NewRequiredQuantity)), token);
        return snapshot;
    }

    private async Task<MenuAmendment> AttachAmendmentAsync(MenuAmendment amendment, string applyMode, byte[] actorId, CancellationToken token)
    {
        var existing = await context.Menuamendments.Include(item => item.Lines)
            .SingleOrDefaultAsync(item => item.MenuAmendmentId.SequenceEqual(amendment.MenuAmendmentId), token);
        if (existing is not null)
        {
            if (existing.Status is not ("PENDING_REVIEW" or "RECONCILIATION_REQUIRED"))
                throw new BusinessRuleException("Yêu cầu thay đổi không còn chờ duyệt.");
            return existing;
        }
        if (applyMode == ApprovedRequestMode) throw new KeyNotFoundException("Không tìm thấy yêu cầu thay đổi thực đơn.");
        amendment.Status = "APPROVED_FOR_EXECUTION";
        context.Menuamendments.Add(amendment);
        AddAudit(actorId, amendment.CreatedAt, nameof(MenuAmendment), amendment.MenuAmendmentId, "Status", null, amendment.Status, amendment.Reason);
        return amendment;
    }

    private void WriteServings(MealQuantityPlanLine line, int savory, int vegetarian, byte[] actorId, string reason, DateTime now)
    {
        var final = savory + vegetarian;
        if (line.SavoryServings != savory)
            AddAudit(actorId, now, nameof(MealQuantityPlanLine), line.QuantityPlanLineId, nameof(MealQuantityPlanLine.SavoryServings), line.SavoryServings?.ToString(), savory.ToString(), reason);
        if (line.VegetarianServings != vegetarian)
            AddAudit(actorId, now, nameof(MealQuantityPlanLine), line.QuantityPlanLineId, nameof(MealQuantityPlanLine.VegetarianServings), line.VegetarianServings?.ToString(), vegetarian.ToString(), reason);
        if (line.FinalServings != final)
        {
            context.Quantityadjustments.Add(new QuantityAdjustment
            {
                AdjustmentId = GuidHelper.NewId(), QuantityPlanLineId = line.QuantityPlanLineId,
                OldServings = line.FinalServings, NewServings = final, Reason = reason, AdjustedBy = actorId, AdjustedAt = now
            });
            AddAudit(actorId, now, nameof(MealQuantityPlanLine), line.QuantityPlanLineId, nameof(MealQuantityPlanLine.FinalServings), line.FinalServings.ToString(), final.ToString(), reason);
        }
        line.SavoryServings = savory;
        line.VegetarianServings = vegetarian;
        line.FinalServings = final;
        line.ConfirmedServings = final;
        line.UpdatedAt = now;
    }

    private void AddAudit(byte[] actorId, DateTime at, string entity, byte[] entityId, string field, string? oldValue, string? newValue, string reason)
        => context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(), ChangedAt = at, ChangedBy = actorId, BusinessArea = "Reconciliation", EntityName = entity,
            EntityId = entityId, FieldName = field, OldValue = oldValue, NewValue = newValue, Reason = reason
        });

    private static (byte[] CustomerId, byte[] BaseVersionId) ValidateRequest(CreateMenuAmendmentRequest request)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId) ?? throw new ArgumentException("CustomerId không hợp lệ.");
        var baseVersionId = GuidHelper.ParseGuidString(request.ExpectedBaseMenuVersionId) ?? throw new ArgumentException("ExpectedBaseMenuVersionId không hợp lệ.");
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Lines.Count == 0)
            throw new BusinessRuleException("Thay đổi thực đơn cần lý do và ít nhất một dòng thay đổi.");
        if (request.Lines.Select(line => $"{line.ServiceDate:yyyy-MM-dd}|{line.ShiftName}|{line.DishSlot}").Distinct(StringComparer.OrdinalIgnoreCase).Count() != request.Lines.Count)
            throw new BusinessRuleException("Mỗi ngày/ca/slot chỉ được xuất hiện một lần trong yêu cầu thay đổi.");
        if (request.Lines.Any(line => line.NewServings is not null))
            throw new BusinessRuleException("Chế độ đối chiếu nhận số suất Mặn và Chay; không nhận tổng số suất.");
        if (request.Lines.Any(line => line.NewSavoryServings < 0 || line.NewVegetarianServings < 0))
            throw new BusinessRuleException("Số suất Mặn và Chay phải lớn hơn hoặc bằng 0.");
        return (customerId, baseVersionId);
    }

    /// <summary>Nguồn hiện tại của căn tin × tuần: lịch của phiên bản mới nhất, lô (tìm qua MenuVersion) và dòng số suất đang dùng.</summary>
    private async Task<SourceScope> LoadScopeAsync(byte[] customerId, DateOnly week, byte[] expectedVersionId, bool tracked, CancellationToken ct)
    {
        var scheduleQuery = context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems)
            .Where(item => item.CustomerId == customerId && item.WeekStartDate == week && item.MenuVersionId != null);
        var all = await (tracked ? scheduleQuery : scheduleQuery.AsNoTracking()).ToListAsync(ct);
        var versionIds = all.Select(item => item.MenuVersionId!).DistinctBy(Convert.ToHexString).ToList();
        var currentVersionId = await context.Menuversions.AsNoTracking().Where(item => versionIds.Contains(item.MenuVersionId))
            .OrderByDescending(item => item.VersionNo).Select(item => item.MenuVersionId).FirstOrDefaultAsync(ct);
        if (currentVersionId is null || !currentVersionId.AsSpan().SequenceEqual(expectedVersionId))
            throw Stale("Nguồn thực đơn đã thay đổi. Vui lòng tải lại trước khi áp dụng.");
        var schedules = all.Where(item => item.MenuVersionId!.AsSpan().SequenceEqual(currentVersionId)).ToList();

        var batches = await (
                from batch in context.Reconciliationbatches.AsNoTracking()
                join version in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals version.MenuVersionId
                where version.CustomerId == customerId && version.WeekStartDate == week
                select new { batch.BatchId, batch.Status })
            .ToListAsync(ct);
        if (batches.Any(item => item.Status == "COMPLETED"))
            throw new MrxSourceChangeException(MrxErrorCodes.BatchCompleted, StatusCodes.Status409Conflict,
                "Lô đối soát của tuần đã hoàn tất nên mọi ngày đều bị khóa; không thể thay đổi nguồn.");
        if (batches.Count > 1)
            throw new BusinessRuleException("Tuần có nhiều lô đối soát đang mở; không xác định được lô cần cập nhật.");
        ReconciliationBatch? active = null;
        if (batches.Count == 1)
        {
            active = tracked
                ? await MrxBatchRecomputer.LoadBatchAsync(context, batches[0].BatchId, ct)
                : await context.Reconciliationbatches.AsNoTracking().Include(item => item.Lines).ThenInclude(item => item.DailyLines)
                    .SingleAsync(item => item.BatchId == batches[0].BatchId, ct);
        }

        // Có lô: chỉ dòng số suất thuộc đợt nhập của lô (nguồn mà tính lại đọc). Chưa có lô: dòng cập nhật gần nhất của từng lịch.
        var scheduleIds = schedules.Select(item => item.MenuScheduleId).ToList();
        var importId = active?.QuantityImportBatchId;
        var lineQuery = context.Mealquantityplanlines.Include(item => item.QuantityPlan)
            .Where(item => scheduleIds.Contains(item.MenuScheduleId) && (importId == null || item.QuantityPlan.ImportBatchId == importId));
        var planLines = (await (tracked ? lineQuery : lineQuery.AsNoTracking()).ToListAsync(ct))
            .GroupBy(item => Convert.ToHexString(item.MenuScheduleId))
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.UpdatedAt).First());
        return new SourceScope(schedules, active, planLines);
    }

    /// <summary>So từng dòng yêu cầu với nguồn hiện tại; dòng giống hệt nguồn là "không đổi" (Review Focus 1).</summary>
    private async Task<List<ImpactRow>> BuildImpactAsync(SourceScope scope, IReadOnlyList<CreateMenuAmendmentLineRequest> lines, CancellationToken ct)
    {
        var rows = new List<ImpactRow>();
        foreach (var line in lines)
        {
            var schedule = scope.Schedules.SingleOrDefault(item => item.ServiceDate == line.ServiceDate && string.Equals(item.ShiftName, line.ShiftName, StringComparison.OrdinalIgnoreCase))
                ?? throw new BusinessRuleException("Không tìm thấy lịch thực đơn cho ngày/ca cần thay đổi.");
            var menuItem = ResolveMenuItem(schedule.Menu.Menuitems, line.DishSlot) ?? throw new BusinessRuleException("Không tìm thấy slot thực đơn nguồn.");
            var oldDishId = menuItem.DishId ?? throw new BusinessRuleException("Slot thực đơn nguồn chưa có món ăn.");
            var newDishId = string.IsNullOrWhiteSpace(line.NewDishId) ? oldDishId : GuidHelper.ParseGuidString(line.NewDishId) ?? throw new ArgumentException("NewDishId không hợp lệ.");
            var planLine = scope.PlanLines.GetValueOrDefault(Convert.ToHexString(schedule.MenuScheduleId));
            int? currentSavory = planLine?.SavoryServings, currentVegetarian = planLine?.VegetarianServings;
            int? newSavory = line.NewSavoryServings ?? currentSavory, newVegetarian = line.NewVegetarianServings ?? currentVegetarian;
            var servingsChanged = newSavory != currentSavory || newVegetarian != currentVegetarian;
            if (servingsChanged)
            {
                if (planLine is null) throw new BusinessRuleException("Ngày/ca cần đổi chưa có dòng số suất nguồn.");
                if (newSavory is null || newVegetarian is null) throw new BusinessRuleException("Cần nhập cả số suất Mặn và số suất Chay.");
                if (newSavory + newVegetarian <= 0) throw new BusinessRuleException("Tổng số suất Mặn và Chay phải lớn hơn 0.");
            }
            var dishChanged = !newDishId.AsSpan().SequenceEqual(oldDishId);
            if (dishChanged) await EnsureBomAsync(newDishId, schedule, ct);
            var currentServings = planLine?.FinalServings ?? 0;
            rows.Add(new ImpactRow(schedule, planLine, newDishId, dishChanged, servingsChanged, new MenuAmendmentImpactLineDto
            {
                ServiceDate = line.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = line.DishSlot,
                OldDishId = GuidHelper.ToGuidString(oldDishId), NewDishId = GuidHelper.ToGuidString(newDishId),
                CurrentServings = currentServings, NewServings = servingsChanged ? newSavory!.Value + newVegetarian!.Value : currentServings,
                CurrentSavoryServings = currentSavory, CurrentVegetarianServings = currentVegetarian,
                NewSavoryServings = newSavory, NewVegetarianServings = newVegetarian
            }));
        }
        if (rows.Where(row => row.ServingsChanged).GroupBy(row => Convert.ToHexString(row.Schedule.MenuScheduleId))
            .Any(group => group.Select(row => (row.Dto.NewSavoryServings, row.Dto.NewVegetarianServings)).Distinct().Count() > 1))
            throw new BusinessRuleException("Một ngày/ca chỉ được có một cặp số suất Mặn/Chay mới.");
        return rows;
    }

    private async Task EnsureBomAsync(byte[] dishId, MenuSchedule schedule, CancellationToken ct)
    {
        var dish = await context.Dishes.AsNoTracking().Include(item => item.Dishboms)
            .SingleOrDefaultAsync(item => item.DishId == dishId && item.IsActive == true, ct)
            ?? throw new BusinessRuleException("Món thay thế không tồn tại hoặc đã ngừng hoạt động.");
        if (BomSelectionResolver.Resolve(dish.Dishboms, schedule.CustomerId, schedule.MenuPrice, schedule.ServiceDate).Count == 0)
            throw new MrxSourceChangeException(MrxErrorCodes.BomMissing, StatusCodes.Status422UnprocessableEntity,
                $"{schedule.ServiceDate:dd/MM/yyyy}: món '{dish.DishName}' chưa có định mức nguyên liệu hiệu lực cho ngày phục vụ.");
    }

    /// <summary>Định lượng trước (daily line của lô, hoặc nguồn hiện tại khi chưa có lô) và sau (nguồn đã áp thay đổi trong bộ nhớ).</summary>
    private async Task<List<MrxMaterialImpactDto>> PreviewMaterialImpactAsync(SourceScope scope, IReadOnlyList<ImpactRow> openChanged, CancellationToken ct)
    {
        if (openChanged.Count == 0) return [];
        var dates = openChanged.Select(row => row.Schedule.ServiceDate).ToHashSet();
        var lineIds = scope.Schedules.Where(item => dates.Contains(item.ServiceDate))
            .Select(item => scope.PlanLines.GetValueOrDefault(Convert.ToHexString(item.MenuScheduleId))?.QuantityPlanLineId)
            .OfType<byte[]>().ToList();
        var sources = await MrxBatchRecomputer.SourceLinesQuery(context.Mealquantityplanlines.AsNoTracking())
            .Where(item => lineIds.Contains(item.QuantityPlanLineId)).ToListAsync(ct);
        var newDishIds = openChanged.Where(row => row.DishChanged).Select(row => row.NewDishId).ToList();
        var newDishes = (await context.Dishes.AsNoTracking()
                .Include(item => item.Dishboms).ThenInclude(bom => bom.Unit)
                .Include(item => item.Dishboms).ThenInclude(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
                .AsSplitQuery().Where(item => newDishIds.Contains(item.DishId)).ToListAsync(ct))
            .ToDictionary(item => Convert.ToHexString(item.DishId));
        try
        {
            var previous = scope.Batch is null
                ? Totals(MrxBatchRecomputer.BuildRequirements(ReconciliationMaterialProjection.Project(sources)))
                : scope.Batch.Lines.SelectMany(line => line.DailyLines).Where(item => dates.Contains(item.ServiceDate))
                    .ToDictionary(item => (item.ServiceDate, Convert.ToHexString(item.IngredientId), Convert.ToHexString(item.CanonicalUnitId)), item => item.RequiredQuantity);
            var amended = sources.Select(source => Amend(source,
                openChanged.Where(row => row.Schedule.MenuScheduleId.AsSpan().SequenceEqual(source.MenuScheduleId)).ToList(), newDishes)).ToList();
            var next = Totals(MrxBatchRecomputer.BuildRequirements(ReconciliationMaterialProjection.Project(amended)));
            var changes = previous.Keys.Union(next.Keys)
                .Select(key => (key.Item1, Convert.FromHexString(key.Item2), Convert.FromHexString(key.Item3), previous.GetValueOrDefault(key), next.GetValueOrDefault(key)))
                .Where(item => item.Item4 != item.Item5);
            return await NameImpactAsync(changes, ct);
        }
        catch (Exception error) when (scope.Batch is null && error is MrxSourceChangeException or BusinessRuleException)
        {
            // Chưa có lô: nguồn có thể chưa đủ số suất Mặn/Chay hoặc định mức; xem trước định lượng là thông tin, không chặn.
            return [];
        }
    }

    private static Dictionary<(DateOnly, string, string), decimal> Totals(IEnumerable<ReconciliationRevisionMaterialFact> facts)
        => facts.GroupBy(item => (item.ServiceDate, Convert.ToHexString(ReconciliationBatchService.RequiredId(item.IngredientId)), Convert.ToHexString(ReconciliationBatchService.RequiredId(item.CanonicalUnitId))))
            .ToDictionary(group => group.Key, group => decimal.Round(group.Sum(item => item.RequiredQuantity), 6, MidpointRounding.AwayFromZero));

    /// <summary>Bản sao trong bộ nhớ của dòng số suất với món/số suất mới; không chạm entity được theo dõi.</summary>
    private static MealQuantityPlanLine Amend(MealQuantityPlanLine source, IReadOnlyList<ImpactRow> rows, IReadOnlyDictionary<string, Dish> newDishes)
    {
        var menu = new Menu { MenuId = source.Menu.MenuId, MenuCode = source.Menu.MenuCode, MenuName = source.Menu.MenuName };
        foreach (var item in source.Menu.Menuitems)
        {
            var row = rows.FirstOrDefault(candidate => candidate.DishChanged
                && ReferenceEquals(ResolveMenuItem(source.Menu.Menuitems, candidate.Dto.DishSlot), item));
            menu.Menuitems.Add(new MenuItem
            {
                MenuItemId = item.MenuItemId, MenuId = item.MenuId, DishSlot = item.DishSlot, DisplayOrder = item.DisplayOrder,
                DishId = row?.NewDishId ?? item.DishId, Dish = row is null ? item.Dish : newDishes[Convert.ToHexString(row.NewDishId)]
            });
        }
        var servings = rows.FirstOrDefault(row => row.ServingsChanged)?.Dto;
        return new MealQuantityPlanLine
        {
            QuantityPlanLineId = source.QuantityPlanLineId, QuantityPlanId = source.QuantityPlanId, MenuScheduleId = source.MenuScheduleId,
            CustomerId = source.CustomerId, MenuId = source.MenuId, ShiftName = source.ShiftName,
            FinalServings = servings is null ? source.FinalServings : servings.NewServings,
            SavoryServings = servings is null ? source.SavoryServings : servings.NewSavoryServings,
            VegetarianServings = servings is null ? source.VegetarianServings : servings.NewVegetarianServings,
            QuantityPlan = source.QuantityPlan, MenuSchedule = source.MenuSchedule, Menu = menu
        };
    }

    private async Task<List<MrxMaterialImpactDto>> NameImpactAsync(
        IEnumerable<(DateOnly Date, byte[] IngredientId, byte[] UnitId, decimal Previous, decimal Next)> changes, CancellationToken ct)
    {
        var rows = changes.ToList();
        var ingredientIds = rows.Select(item => item.IngredientId).ToList();
        var unitIds = rows.Select(item => item.UnitId).ToList();
        var ingredients = await context.Ingredients.AsNoTracking().Where(item => ingredientIds.Contains(item.IngredientId))
            .ToDictionaryAsync(item => Convert.ToHexString(item.IngredientId), ct);
        var units = await context.Units.AsNoTracking().Where(item => unitIds.Contains(item.UnitId))
            .ToDictionaryAsync(item => Convert.ToHexString(item.UnitId), item => item.UnitName, ct);
        return rows
            .Select(item => (Row: item, Ingredient: ingredients.GetValueOrDefault(Convert.ToHexString(item.IngredientId))))
            .Select(entry => new MrxMaterialImpactDto(entry.Row.Date, entry.Ingredient?.IngredientCode ?? string.Empty,
                entry.Ingredient?.IngredientName ?? string.Empty, units.GetValueOrDefault(Convert.ToHexString(entry.Row.UnitId)) ?? string.Empty,
                entry.Row.Previous, entry.Row.Next))
            .OrderBy(item => item.ServiceDate).ThenBy(item => item.IngredientCode, StringComparer.Ordinal)
            .ToList();
    }

    private static CreateMenuAmendmentLineRequest ToRequestLine(MenuAmendmentImpactLineDto line)
    {
        // Yêu cầu cũ chỉ có tổng số suất: không suy diễn Mặn/Chay (BR-MRX-SERV-2).
        if (line.NewServings != line.CurrentServings && line.NewSavoryServings is null)
            throw new BusinessRuleException("Yêu cầu cũ đổi tổng số suất; cần gửi lại theo số suất Mặn và Chay.");
        return new CreateMenuAmendmentLineRequest
        {
            ServiceDate = line.ServiceDate, ShiftName = line.ShiftName, DishSlot = line.DishSlot, NewDishId = line.NewDishId,
            NewSavoryServings = line.NewSavoryServings, NewVegetarianServings = line.NewVegetarianServings
        };
    }

    private static MenuItem? ResolveMenuItem(IEnumerable<MenuItem> items, string dishSlot)
        => items.SingleOrDefault(item => string.Equals(item.DishSlot, dishSlot, StringComparison.OrdinalIgnoreCase))
            ?? MenuAmendmentVersionMaterializer.ResolveLegacyMenuItem(items, dishSlot);

    private static MenuAmendmentResultDto ReadSnapshot(string? json)
        => string.IsNullOrWhiteSpace(json) ? new MenuAmendmentResultDto() : JsonSerializer.Deserialize<MenuAmendmentResultDto>(json) ?? new MenuAmendmentResultDto();

    private static MrxSourceChangeException Stale(string message)
        => new(MrxErrorCodes.SourceStale, StatusCodes.Status409Conflict, message);

    internal static MrxSourceChangeException DayLocked(IReadOnlyList<DateOnly> dates)
        => new(MrxErrorCodes.DayLocked, StatusCodes.Status409Conflict,
            $"Ngày {string.Join(", ", dates.Select(date => date.ToString("dd/MM/yyyy")))} đã xuất kho nên bị khóa; bỏ thay đổi của các ngày này rồi áp dụng lại.",
            dates);

    private sealed record SourceScope(List<MenuSchedule> Schedules, ReconciliationBatch? Batch, Dictionary<string, MealQuantityPlanLine> PlanLines);

    private sealed record ImpactRow(MenuSchedule Schedule, MealQuantityPlanLine? PlanLine, byte[] NewDishId, bool DishChanged, bool ServingsChanged, MenuAmendmentImpactLineDto Dto)
    {
        public bool Changed => DishChanged || ServingsChanged;
    }
}
