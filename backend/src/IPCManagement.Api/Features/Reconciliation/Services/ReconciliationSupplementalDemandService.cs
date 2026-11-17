using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationSupplementalDemandService(IpcManagementContext context, IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    private const string Operation = "reconciliation.supplemental-demands";
    private const string Aggregate = nameof(ReconciliationSupplementalDemand);

    public async Task<ReconciliationSupplementalDishOptionsDto> GetDishOptionsAsync(string batchId, DateOnly day,
        ClaimsPrincipal actor, CancellationToken token = default)
    {
        RequireRole(actor, AuthorizationPolicies.ReconciliationSupplementalDemandReadRoles);
        await RequireModeAsync(token);
        var id = RequiredId(batchId);
        var batch = await context.Reconciliationbatches.AsNoTracking().SingleOrDefaultAsync(x => x.BatchId == id, token)
            ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát.");
        var (lines, facts) = await LoadFrozenFactsAsync(batch, day, token);
        var lineMap = lines.ToDictionary(x => Convert.ToHexString(x.DailyLineId), StringComparer.Ordinal);
        var options = new List<ReconciliationSupplementalDishOptionDto>();
        foreach (var group in facts.Where(x => x.DishId is not null)
                     .GroupBy(x => (Dish: GuidHelper.ToGuidString(x.DishId!), x.FrozenShiftName, x.FrozenMenuVariant)))
        {
            var ordered = group.OrderBy(x => Convert.ToHexString(x.ContributorId), StringComparer.Ordinal).ToList();
            string? blocked = null;
            try
            {
                if (string.IsNullOrWhiteSpace(group.Key.FrozenShiftName) || string.IsNullOrWhiteSpace(group.Key.FrozenMenuVariant))
                    throw new BusinessRuleException("Nguồn đóng băng thiếu ca hoặc loại suất.");
                ReconciliationSupplementalSnapshotBuilder.ValidateFacts(ordered, lineMap);
            }
            catch (BusinessRuleException error) { blocked = error.Message; }
            var first = ordered[0];
            options.Add(new(group.Key.Dish, first.FrozenDishCode ?? "", first.FrozenDishName ?? "",
                group.Key.FrozenShiftName ?? "", group.Key.FrozenMenuVariant ?? "", blocked));
        }
        var hasInitial = await context.Inventoryissues.AsNoTracking()
            .AnyAsync(x => x.ReconciliationBatchId == id && x.IssueDate == day, token);
        var reason = batch.Status != "IN_PROGRESS" ? "Chỉ lập nhu cầu phát sinh khi lô đang xuất kho."
            : !hasInitial ? "Ngày này chưa có phiếu xuất ban đầu. Hãy dùng luồng xuất kho ngày."
            : options.All(x => x.BlockedReason is not null) ? "Không có món với BOM đóng băng hợp lệ trong ngày đã chọn." : null;
        return new(batchId, batch.Version, day, reason is null, reason,
            options.OrderBy(x => x.DishName, StringComparer.Ordinal).ThenBy(x => x.DishId, StringComparer.Ordinal)
                .ThenBy(x => x.ShiftName, StringComparer.Ordinal).ThenBy(x => x.MenuVariant, StringComparer.Ordinal).ToList())
            { RequiresApproval = !IsAdminActor(actor) };
    }

    public async Task<PagedResponseDto<ReconciliationSupplementalDemandSummaryDto>> GetPageAsync(
        ReconciliationSupplementalDemandPageQuery request, ClaimsPrincipal actor, CancellationToken token = default)
    {
        RequireRole(actor, AuthorizationPolicies.ReconciliationSupplementalDemandReadRoles);
        await RequireModeAsync(token);
        var status = request.Status.Trim().ToUpperInvariant();
        if (status is not ("ALL" or "DRAFT" or "PENDING" or "APPROVED" or "REJECTED" or "CANCELLED"))
            throw new ArgumentException("Trạng thái đề nghị không hợp lệ.");
        if (request.PageNumber > 100000) throw new ArgumentException("Trang yêu cầu vượt phạm vi cho phép.");
        var query = context.Reconciliationsupplementaldemands.AsNoTracking();
        if (status != "ALL") query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(request.BatchId))
        { var batchId = RequiredId(request.BatchId); query = query.Where(x => x.BatchId == batchId); }
        if (request.ServiceDate is { } date) query = query.Where(x => x.ServiceDate == date);
        if (!string.IsNullOrWhiteSpace(request.SearchKeyword))
        { var keyword = request.SearchKeyword.Trim(); query = query.Where(x => x.Reason.Contains(keyword)); }
        var count = await query.CountAsync(token);
        var rows = await query.OrderByDescending(x => x.SubmittedAt ?? x.CreatedAt).ThenBy(x => x.DemandId)
            .Skip((request.PageNumber - 1) * request.PageSize).Take(request.PageSize)
            .Select(x => new { Demand = x, x.Batch.Version, DishCount = x.Dishes.Count }).ToListAsync(token);
        return PagedResponseDto<ReconciliationSupplementalDemandSummaryDto>.Create(rows.Select(x => new ReconciliationSupplementalDemandSummaryDto(
            GuidHelper.ToGuidString(x.Demand.DemandId), GuidHelper.ToGuidString(x.Demand.BatchId), x.Demand.ServiceDate,
            x.Demand.Status, x.Demand.Version, x.Version, x.Demand.Reason, x.Demand.CreatedAt, x.Demand.SubmittedAt, x.DishCount)),
            count, request.PageNumber, request.PageSize);
    }

    public async Task<ReconciliationSupplementalFulfillmentDto> GetFulfillmentAsync(string batchId, DateOnly day,
        ClaimsPrincipal actor, CancellationToken token = default)
    {
        RequireRole(actor, AuthorizationPolicies.ReconciliationSupplementalDemandReadRoles);
        await RequireModeAsync(token);
        var id = RequiredId(batchId);
        if (!await context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == id, token))
            throw new KeyNotFoundException("Không tìm thấy lô đối soát.");
        return await ReconciliationSupplementalFulfillmentQuery.GetAsync(context, id, day, token);
    }

    public async Task<ReconciliationSupplementalDemandDto> GetAsync(string id, ClaimsPrincipal actor, CancellationToken token = default)
    {
        RequireRole(actor, AuthorizationPolicies.ReconciliationSupplementalDemandReadRoles);
        await RequireModeAsync(token);
        var demand = await LoadAsync(RequiredId(id), token);
        var batch = await context.Reconciliationbatches.AsNoTracking().SingleAsync(x => x.BatchId == demand.BatchId, token);
        return Map(demand, batch.Version);
    }

    public Task<ReconciliationSupplementalDemandDto> CreateAsync(ReconciliationSupplementalDemandWriteRequest request,
        ClaimsPrincipal actor, CancellationToken token = default) => WriteAsync(request.CommandId, "CREATE", request.CommandId,
        request.ExpectedVersion, request.ExpectedBatchVersion, request.Reason, request, actor, request, token);
    public Task<ReconciliationSupplementalDemandDto> UpdateDraftAsync(string id, ReconciliationSupplementalDemandWriteRequest request,
        ClaimsPrincipal actor, CancellationToken token = default) => WriteAsync(id, "UPDATE", request.CommandId,
        request.ExpectedVersion, request.ExpectedBatchVersion, request.Reason, request, actor, request, token);
    public Task<ReconciliationSupplementalDemandDto> SubmitAsync(string id, ReconciliationSupplementalDemandCommand request,
        ClaimsPrincipal actor, CancellationToken token = default) => CommandAsync(id, "SUBMIT", request, actor, token);
    public Task<ReconciliationSupplementalDemandDto> ApproveAsync(string id, ReconciliationSupplementalDemandCommand request,
        ClaimsPrincipal actor, CancellationToken token = default) => CommandAsync(id, "APPROVE", request, actor, token);
    public Task<ReconciliationSupplementalDemandDto> RejectAsync(string id, ReconciliationSupplementalDemandCommand request,
        ClaimsPrincipal actor, CancellationToken token = default) => CommandAsync(id, "REJECT", request, actor, token);
    public Task<ReconciliationSupplementalDemandDto> CancelAsync(string id, ReconciliationSupplementalDemandCommand request,
        ClaimsPrincipal actor, CancellationToken token = default) => CommandAsync(id, "CANCEL", request, actor, token);

    private Task<ReconciliationSupplementalDemandDto> CommandAsync(string id, string action,
        ReconciliationSupplementalDemandCommand request, ClaimsPrincipal actor, CancellationToken token) =>
        WriteAsync(id, action, request.CommandId, request.ExpectedVersion, request.ExpectedBatchVersion,
            request.Reason, request, actor, null, token);

    private async Task<ReconciliationSupplementalDemandDto> WriteAsync(string id, string action, string commandId,
        long expectedVersion, long expectedBatchVersion, string reason, object payload, ClaimsPrincipal actor,
        ReconciliationSupplementalDemandWriteRequest? draft, CancellationToken token)
    {
        var directConfirmation = action == "SUBMIT" && IsAdminActor(actor);
        var actorId = RequireRole(actor, action is "APPROVE" or "REJECT" ? AuthorizationPolicies.ReconciliationDecisionRoles
            : AuthorizationPolicies.ReconciliationSupplementalDemandWriteRoles);
        if (!Guid.TryParse(commandId, out _)) throw new ArgumentException("Mã lệnh không hợp lệ.");
        var key = RequiredId(id);
        if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length > 2000) throw new ArgumentException("Cần lý do từ 1 đến 2000 ký tự.");
        await RequireModeAsync(token);
        var hash = Hash(new { Action = action, ActorId = GuidHelper.ToGuidString(actorId), Payload = payload });
        var prior = await ReadReceiptAsync(commandId, key, hash, token);
        if (prior is not null) return prior;
        var modeVersion = requestContext.ExpectedModeVersion ?? throw new InvalidOperationException("Thiếu phiên bản chế độ vận hành.");
        return await transactions.ExecuteProtectedAsync(Operation, modeVersion, async ct =>
        {
            context.ChangeTracker.Clear();
            var batchId = draft is not null ? RequiredId(draft.BatchId)
                : await context.Reconciliationsupplementaldemands.AsNoTracking().Where(x => x.DemandId == key)
                    .Select(x => x.BatchId).SingleOrDefaultAsync(ct) ?? throw new KeyNotFoundException("Không tìm thấy đề nghị suất phát sinh.");
            if (context.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
                await context.Database.ExecuteSqlRawAsync("SELECT batchId FROM reconciliationbatches WHERE batchId = {0} FOR UPDATE", [batchId], ct);
            var existing = await ReadReceiptAsync(commandId, key, hash, ct);
            if (existing is not null) return existing;
            await RequireModeAsync(ct);
            var batch = await context.Reconciliationbatches.SingleOrDefaultAsync(x => x.BatchId == batchId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát.");
            if (batch.Version != expectedBatchVersion) throw new DbUpdateConcurrencyException("Lô đã thay đổi. Hãy tải lại trước khi tiếp tục.");
            if (batch.Status != "IN_PROGRESS") throw new BusinessRuleException("Chỉ lập hoặc xử lý nhu cầu phát sinh khi lô đang xuất kho.");
            ReconciliationSupplementalDemand demand;
            string? oldStatus = null;
            if (action == "CREATE")
            {
                if (expectedVersion != 0) throw new DbUpdateConcurrencyException("Phiên bản hồ sơ mới không hợp lệ.");
                if (await context.Reconciliationsupplementaldemands.AnyAsync(x => x.DemandId == key, ct))
                    throw new BusinessRuleException("Mã hồ sơ đã tồn tại.");
                demand = new() { DemandId = key, BatchId = batchId, ServiceDate = draft!.ServiceDate,
                    CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Reason = reason.Trim() };
                context.Reconciliationsupplementaldemands.Add(demand);
            }
            else
            {
                demand = await LoadAsync(key, ct);
                if (demand.Version != expectedVersion) throw new DbUpdateConcurrencyException("Hồ sơ đã thay đổi. Hãy tải lại.");
                oldStatus = demand.Status;
                var decisionActor = IsDecisionActor(actor);
                if (action is not ("APPROVE" or "REJECT") && !decisionActor && !demand.CreatedBy.SequenceEqual(actorId))
                    throw new UnauthorizedAccessException("Chỉ người lập hoặc Quản lý/Admin được thay đổi đề nghị.");
                if (draft is not null && (!demand.BatchId.SequenceEqual(batchId) || demand.ServiceDate != draft.ServiceDate))
                    throw new BusinessRuleException("Không được chuyển hồ sơ sang lô hoặc ngày khác.");
            }
            if (!await context.Inventoryissues.AnyAsync(x => x.ReconciliationBatchId == batchId && x.IssueDate == demand.ServiceDate, ct))
                throw new BusinessRuleException("Ngày này chưa có phiếu xuất ban đầu. Hãy dùng luồng xuất kho ngày.");

            if (action is "CREATE" or "UPDATE" or "SUBMIT")
            {
                if (demand.Status != "DRAFT") throw new BusinessRuleException("Chỉ được sửa hoặc gửi hồ sơ nháp.");
                var selections = draft?.Dishes ?? demand.Dishes.Select(x => new ReconciliationSupplementalDishSelection(
                    GuidHelper.ToGuidString(x.DishId), x.ShiftName, x.MenuVariant, x.ExtraServings)).ToList();
                var snapshot = await BuildSnapshotAsync(batch, demand.ServiceDate, selections, ct);
                if (action != "CREATE") await RemoveSnapshotAsync(demand, ct);
                AttachSnapshot(demand, snapshot, batch.Version);
                if (draft is not null) demand.Reason = reason.Trim();
                if (action == "SUBMIT")
                {
                    demand.SubmittedAt = DateTime.UtcNow;
                    demand.Status = directConfirmation ? "APPROVED" : "PENDING";
                    if (directConfirmation)
                    {
                        demand.DecidedBy = actorId; demand.DecidedAt = demand.SubmittedAt; demand.DecisionReason = reason.Trim();
                        context.Approvalhistories.Add(new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(),
                            TargetType = "mrx-supplemental-demand", TargetId = key, Decision = "ADMIN_DIRECT",
                            OldStatus = oldStatus, NewStatus = demand.Status, ActionBy = actorId,
                            ActionAt = demand.DecidedAt.Value, Reason = reason.Trim() });
                    }
                }
            }
            else if (action is "APPROVE" or "REJECT")
            {
                if (demand.Status != "PENDING") throw new BusinessRuleException("Chỉ duyệt hoặc từ chối hồ sơ đang chờ duyệt.");
                if (action == "APPROVE")
                {
                    var snapshot = await BuildSnapshotAsync(batch, demand.ServiceDate, demand.Dishes.Select(x =>
                        new ReconciliationSupplementalDishSelection(GuidHelper.ToGuidString(x.DishId), x.ShiftName, x.MenuVariant, x.ExtraServings)).ToList(), ct);
                    if (snapshot.Fingerprint != demand.SnapshotFingerprint) throw new BusinessRuleException("Nguồn đóng băng đã thay đổi. Cần lập lại đề nghị với snapshot hiện hành.");
                }
                demand.Status = action == "APPROVE" ? "APPROVED" : "REJECTED";
                demand.DecidedBy = actorId; demand.DecidedAt = DateTime.UtcNow; demand.DecisionReason = reason.Trim();
                context.Approvalhistories.Add(new ApprovalHistory { ApprovalHistoryId = GuidHelper.NewId(), TargetType = "mrx-supplemental-demand",
                    TargetId = key, Decision = action, OldStatus = oldStatus, NewStatus = demand.Status, ActionBy = actorId,
                    ActionAt = demand.DecidedAt.Value, Reason = reason.Trim() });
            }
            else if (action == "CANCEL")
            {
                if (demand.Status is not ("DRAFT" or "PENDING" or "APPROVED")) throw new BusinessRuleException("Hồ sơ không thể hủy ở trạng thái hiện tại.");
                if (demand.Status == "APPROVED" && !IsDecisionActor(actor)) throw new UnauthorizedAccessException("Quản lý/Admin xác nhận hủy nhu cầu đã duyệt.");
                var materialIds = demand.Materials.Select(x => x.DemandMaterialId).ToList();
                if (await context.Reconciliationissueallocations.AnyAsync(x => x.DemandMaterialId != null && materialIds.Contains(x.DemandMaterialId), ct))
                    throw new BusinessRuleException("Nhu cầu đã cấp nguyên liệu. Cần xử lý hoàn trả hoặc điều chỉnh có truy vết, không hủy hồ sơ.");
                demand.Status = "CANCELLED"; demand.DecisionReason = reason.Trim();
            }
            if (action != "CREATE") demand.Version++;
            if (action == "APPROVE" || directConfirmation || action == "CANCEL" && oldStatus == "APPROVED")
            {
                batch.Version++;
                await InvalidateDispositionsAsync(demand, actorId, ct);
            }
            context.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), BusinessArea = "MATERIAL_RECONCILIATION",
                EntityName = nameof(ReconciliationSupplementalDemand), EntityId = key, FieldName = "Status", OldValue = oldStatus,
                NewValue = demand.Status, ChangedBy = actorId, ChangedAt = DateTime.UtcNow, Reason = reason.Trim(), CorrelationId = commandId });
            var result = Map(demand, batch.Version);
            new LifecycleTransitionRecorder(context).Stage(new LifecycleTransitionRequest(Aggregate, key, commandId,
                checked((int)demand.Version), oldStatus ?? "NEW", demand.Status, actorId, expectedVersion, reason.Trim(),
                commandId, null, JsonSerializer.Serialize(result), JsonSerializer.Serialize(new Receipt(hash, result))));
            await context.SaveChangesAsync(ct);
            return result;
        }, async ct => await ReadReceiptAsync(commandId, key, hash, ct) is not null, IsolationLevel.Serializable, token);
    }

    private async Task<ReconciliationSupplementalSnapshot> BuildSnapshotAsync(ReconciliationBatch batch, DateOnly day,
        IReadOnlyList<ReconciliationSupplementalDishSelection> dishes, CancellationToken token)
    {
        var (lines, facts) = await LoadFrozenFactsAsync(batch, day, token);
        return ReconciliationSupplementalSnapshotBuilder.Build(batch, day, dishes, lines, facts);
    }

    private async Task<(List<ReconciliationBatchDailyLine> Lines, List<ReconciliationBatchContributor> Facts)> LoadFrozenFactsAsync(
        ReconciliationBatch batch, DateOnly day, CancellationToken token)
    {
        var lines = await context.Reconciliationbatchdailylines.AsNoTracking().Where(x => x.BatchId == batch.BatchId && x.ServiceDate == day).ToListAsync(token);
        var ids = lines.Select(x => x.DailyLineId).ToList();
        var facts = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(x => x.DailyLineId != null && ids.Contains(x.DailyLineId) && x.InvalidatedAt == null).ToListAsync(token);
        return (lines, facts);
    }

    private async Task RemoveSnapshotAsync(ReconciliationSupplementalDemand demand, CancellationToken token)
    {
        context.Reconciliationsupplementaldemandcontributions.RemoveRange(demand.Dishes.SelectMany(x => x.Contributions));
        context.Reconciliationsupplementaldemandmaterials.RemoveRange(demand.Materials);
        context.Reconciliationsupplementaldemanddishes.RemoveRange(demand.Dishes);
        demand.Materials.Clear(); demand.Dishes.Clear(); await context.SaveChangesAsync(token);
    }
    private static void AttachSnapshot(ReconciliationSupplementalDemand demand, ReconciliationSupplementalSnapshot snapshot, long batchVersion)
    {
        demand.SnapshotFingerprint = snapshot.Fingerprint; demand.SnapshotBatchVersion = batchVersion;
        foreach (var dish in snapshot.Dishes) { dish.DemandId = demand.DemandId; demand.Dishes.Add(dish); }
        foreach (var material in snapshot.Materials) { material.DemandId = demand.DemandId; demand.Materials.Add(material); }
    }
    private async Task InvalidateDispositionsAsync(ReconciliationSupplementalDemand demand, byte[] actor, CancellationToken token)
    {
        var dailyIds = demand.Materials.Select(x => x.DailyLineId).ToList();
        var weeklyIds = await context.Reconciliationbatchdailylines.Where(x => dailyIds.Contains(x.DailyLineId)).Select(x => x.BatchLineId).ToListAsync(token);
        foreach (var row in await context.Reconciliationdailydispositions.Where(x => x.InvalidatedAt == null && dailyIds.Contains(x.DailyLineId)).ToListAsync(token))
        { row.InvalidatedAt = DateTime.UtcNow; row.InvalidatedBy = actor; row.InvalidationReason = "Nhu cầu phát sinh đã thay đổi."; row.Version++; }
        foreach (var row in await context.Reconciliationdispositions.Where(x => x.InvalidatedAt == null && weeklyIds.Contains(x.BatchLineId)).ToListAsync(token))
        { row.InvalidatedAt = DateTime.UtcNow; row.InvalidatedBy = actor; row.InvalidationReason = "Nhu cầu phát sinh đã thay đổi."; row.Version++; }
    }
    private async Task<ReconciliationSupplementalDemand> LoadAsync(byte[] id, CancellationToken token) =>
        await context.Reconciliationsupplementaldemands.Include(x => x.Dishes).ThenInclude(x => x.Contributions).Include(x => x.Materials)
            .SingleOrDefaultAsync(x => x.DemandId == id, token) ?? throw new KeyNotFoundException("Không tìm thấy đề nghị suất phát sinh.");
    private async Task RequireModeAsync(CancellationToken token)
    {
        if ((await new SystemOperationModeGuard(context).ReadRequiredAsync(token)).Mode != SystemOperationEligibility.MaterialReconciliation)
            throw new SystemOperationConflictException("Đề nghị suất phát sinh chỉ thuộc chế độ Đối soát nguyên liệu.");
    }
    private async Task<ReconciliationSupplementalDemandDto?> ReadReceiptAsync(string command, byte[] id, string hash, CancellationToken token)
    {
        var row = await context.Lifecyclecommandreceipts.AsNoTracking().SingleOrDefaultAsync(x => x.CommandId == command && x.AggregateId == id && x.AggregateType == Aggregate, token);
        if (row is null) return null;
        var receipt = JsonSerializer.Deserialize<Receipt>(row.ResponseJson) ?? throw new InvalidOperationException("Không đọc được kết quả lệnh.");
        if (receipt.Hash != hash) throw new SystemOperationConflictException("Mã lệnh đã được dùng với nội dung hoặc người thao tác khác.");
        return receipt.Result;
    }
    private static ReconciliationSupplementalDemandDto Map(ReconciliationSupplementalDemand x, long batchVersion) => new(
        GuidHelper.ToGuidString(x.DemandId), GuidHelper.ToGuidString(x.BatchId), x.ServiceDate, x.Status, x.Version, batchVersion,
        x.Reason, x.SnapshotFingerprint, GuidHelper.ToGuidString(x.CreatedBy), x.CreatedAt, x.SubmittedAt,
        x.DecidedBy is null ? null : GuidHelper.ToGuidString(x.DecidedBy), x.DecidedAt, x.DecisionReason,
        x.Dishes.OrderBy(d => GuidHelper.ToGuidString(d.DemandDishId), StringComparer.Ordinal).Select(d => new ReconciliationSupplementalDishDto(
            GuidHelper.ToGuidString(d.DemandDishId), GuidHelper.ToGuidString(d.DishId), d.FrozenDishCode, d.FrozenDishName, d.ShiftName, d.MenuVariant, d.ExtraServings)).ToList(),
        x.Materials.OrderBy(m => GuidHelper.ToGuidString(m.DemandMaterialId), StringComparer.Ordinal).Select(m => new ReconciliationSupplementalMaterialDto(
            GuidHelper.ToGuidString(m.DemandMaterialId), GuidHelper.ToGuidString(m.DailyLineId), GuidHelper.ToGuidString(m.IngredientId), GuidHelper.ToGuidString(m.CanonicalUnitId), m.RequiredQuantity)).ToList());
    private static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã định danh không hợp lệ.");
    private static byte[] RequireRole(ClaimsPrincipal actor, IEnumerable<string> allowed)
    {
        if (!actor.FindAll(ClaimTypes.Role).Any(x => allowed.Contains(x.Value, StringComparer.OrdinalIgnoreCase))) throw new UnauthorizedAccessException("Không có quyền xử lý nhu cầu phát sinh.");
        return RequiredId(actor.FindFirstValue(ClaimTypes.NameIdentifier) ?? actor.FindFirstValue("sub") ?? "");
    }
    private static bool IsAdminActor(ClaimsPrincipal actor) => actor.FindAll(ClaimTypes.Role)
        .Any(x => AuthorizationPolicies.AdminRoles.Contains(x.Value, StringComparer.OrdinalIgnoreCase));
    private static bool IsDecisionActor(ClaimsPrincipal actor) => actor.FindAll(ClaimTypes.Role).Any(x => AuthorizationPolicies.ReconciliationDecisionRoles.Contains(x.Value, StringComparer.OrdinalIgnoreCase));
    private static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
    private sealed record Receipt(string Hash, ReconciliationSupplementalDemandDto Result);
}
