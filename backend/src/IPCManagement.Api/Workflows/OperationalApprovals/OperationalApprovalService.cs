using IPCManagement.Api.Features.Approvals.Services;
using System.Security.Claims;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Workflows.OperationalApprovals;

public sealed class OperationalApprovalService(
    IpcManagementContext context, IApprovalInboxService inbox,
    IApprovalWorkflowService workflow, IMenuAmendmentService amendments, IApprovalRoutingService routing,
    ReconciliationSupplementalDemandService? supplemental = null, IStocktakeService? stocktakes = null, ILegacyLineageDispositionService? lineage = null)
{
    public async Task<OperationalApprovalPage> GetPageAsync(ClaimsPrincipal actor, ApprovalInboxQueryDto query,
        CancellationToken token = default)
    {
        var mode = await new SystemOperationModeGuard(context).ReadRequiredAsync(token);
        if (query.State is not ("PENDING" or "PROCESSED")) throw new ArgumentException("Trạng thái hàng đợi không hợp lệ.");
        var targets = OperationalApprovalRegistry.ForActor(actor, mode.Mode);
        if (targets.Count == 0) throw new UnauthorizedAccessException("Bạn không có quyền xem hàng đợi duyệt.");
        if (!string.IsNullOrWhiteSpace(query.TargetType)) OperationalApprovalRegistry.Require(actor, mode.Mode, query.TargetType);
        ApprovalInboxPageDto page;
        IReadOnlyList<OperationalApprovalUnavailableSource> unavailableSources = [];
        if (mode.Mode == SystemOperationEligibility.Default && query.State == "PENDING")
        {
            // Keep existing read permissions; target-specific decision restrictions are resolved in detail.
            page = query.TargetType == "stocktake" && !string.IsNullOrWhiteSpace(query.TargetId)
                ? new ApprovalInboxPageDto { Items = await new OperationalStocktakeSource(context).ReadAsync(query, token) }
                : query.TargetType == "legacy-lineage-disposition" && !string.IsNullOrWhiteSpace(query.TargetId)
                    ? new ApprovalInboxPageDto { Items = await new OperationalLegacyLineageSource(context).ReadAsync(query, token) }
                    : await inbox.GetPendingPageAsync(actor, query, token);
        }
        else
        {
            IReadOnlyList<ApprovalInboxItemDto> items;
            if (mode.Mode == SystemOperationEligibility.Default)
                items = (await ReadDefaultHistoryPageAsync(actor, mode, targets, query, token))
                    .Concat(ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "stocktake")
                        ? await ReadStandalonePageAsync(actor, mode, query, "stocktake", token) : [])
                    .Concat(ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "legacy-lineage-disposition")
                        ? await ReadStandalonePageAsync(actor, mode, query, "legacy-lineage-disposition", token) : []).ToList();
            else
            {
                var mrx = await ReadMrxPageAsync(actor, mode, query, token);
                items = mrx.Items;
                unavailableSources = mrx.UnavailableSources;
            }
            var scope = Scope(actor, mode, query);
            var cursor = Decode(query.Cursor, scope);
            var filtered = ApprovalInboxQueryPolicy.Apply(items, query)
                .OrderBy(item => item.SubmittedAt).ThenBy(item => item.InboxItemId, StringComparer.Ordinal)
                .Where(item => cursor is null || item.SubmittedAt > cursor.At ||
                    item.SubmittedAt == cursor.At && string.CompareOrdinal(item.InboxItemId, cursor.Id) > 0)
                .Take(Math.Clamp(query.Limit, 1, 50) + 1).ToList();
            var limit = Math.Clamp(query.Limit, 1, 50);
            var hasNext = filtered.Count > limit;
            var rows = filtered.Take(limit).ToList();
            page = new ApprovalInboxPageDto { Items = rows, Limit = limit, HasNext = hasNext,
                NextCursor = hasNext ? Encode(new Cursor(rows[^1].SubmittedAt, rows[^1].InboxItemId, scope)) : null };
        }
        return new OperationalApprovalPage { Mode = mode.Mode, ModeVersion = mode.Version, Targets = targets,
            Items = page.Items, Limit = page.Limit, HasNext = page.HasNext, NextCursor = page.NextCursor, UnavailableSources = unavailableSources };
    }

    public async Task<OperationalApprovalDetail> GetDetailAsync(ClaimsPrincipal actor, string type, string id,
        CancellationToken token = default, string state = "PENDING")
    {
        var mode = await new SystemOperationModeGuard(context).ReadRequiredAsync(token);
        OperationalApprovalRegistry.Require(actor, mode.Mode, type);
        var page = await GetPageAsync(actor, new ApprovalInboxQueryDto { TargetType = type, TargetId = id, State = state }, token);
        if (page.UnavailableSources.Any(x => x.TargetType == type))
            throw new InvalidOperationException("Nguồn hồ sơ chưa tải được. Hãy thử lại trước khi quyết định.");
        var item = page.Items.SingleOrDefault() ?? throw new KeyNotFoundException("Hồ sơ không còn chờ xử lý. Hãy tải lại danh sách.");
        IReadOnlyList<MrxMaterialImpactDto> impact = [];
        MenuAmendmentResultDto? sourceChange = null;
        var sourceDishNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var supplementalDemand = type == "mrx-supplemental-demand" ? await RequiredSupplemental().GetAsync(id, actor, token) : null;
        var stocktake = type == "stocktake" ? await new OperationalStocktakeSource(context).DetailAsync(id, token) : null;
        var legacy = type == "legacy-lineage-disposition" ? await new OperationalLegacyLineageSource(context).DetailAsync(id, token) : null;
        var blockedReasons = new List<string>();
        if (type == "mrx-batch-review")
            blockedReasons.Add("Mở trạm đối soát để xem số liệu theo ngày, giải trình và kiểm tra điều kiện chốt lô.");
        if (state == "PENDING" && stocktake is not null && stocktake.Lines.Any(x => x.ActualQty is null || x.ActualQty < 0))
            blockedReasons.Add("Chưa có kiểm đếm hợp lệ cho toàn bộ nguyên liệu.");
        if (state == "PENDING" && type == "inventory-receipt")
        {
            var actorId = GuidHelper.ParseGuidString(actor.FindFirstValue(ClaimTypes.NameIdentifier))
                ?? throw new UnauthorizedAccessException("Không xác định được người duyệt.");
            var targetId = GuidHelper.ParseGuidString(id)!;
            var receipt = await context.Inventoryreceipts.AsNoTracking().SingleOrDefaultAsync(item => item.ReceiptId == targetId, token)
                ?? throw new KeyNotFoundException("Không tìm thấy phiếu nhập.");
            var blocked = InventoryReceiptApprovalPolicy.BlockedReason(receipt.Status, receipt.QualityStatus, receipt.CreatedBy, actorId);
            if (blocked is not null) blockedReasons.Add(blocked);
            var roleBlocked = InventoryReceiptApprovalPolicy.RoleBlockedReason(actor.FindAll(ClaimTypes.Role).Select(claim => claim.Value));
            if (roleBlocked is not null) blockedReasons.Add(roleBlocked);
        }
        if (mode.Mode == SystemOperationEligibility.MaterialReconciliation && type == "mrx-source-change")
        {
            var amendment = await ReadMrxTargetAsync(id, token);
            sourceChange = ReadImpact(amendment);
            impact = sourceChange.MaterialImpact;
            var dishIds = sourceChange.ImpactLines.SelectMany(x => new[] { x.OldDishId, x.NewDishId })
                .Select(GuidHelper.ParseGuidString).Where(x => x is not null).Select(x => x!).ToList();
            var dishes = await context.Dishes.AsNoTracking().Where(x => dishIds.Contains(x.DishId)).ToListAsync(token);
            sourceDishNames = dishes.ToDictionary(x => GuidHelper.ToGuidString(x.DishId), x => x.DishName, StringComparer.OrdinalIgnoreCase);
        }
        var history = await GetHistoryAsync(actor, type, id, token);
        var allowed = state == "PENDING" && blockedReasons.Count == 0 ? new List<string> { "APPROVE", "REJECT" } : [];
        if (legacy is not null && state == "PENDING")
        {
            allowed = OperationalLegacyLineageSource.AllowedActions(legacy, actor).ToList();
            if (allowed.Count == 0) blockedReasons.Add(legacy.Status == "APPROVED" ? "Hồ sơ đã duyệt; chỉ Admin được áp dụng liên kết." :
                legacy.CreatedBy == actor.FindFirstValue(ClaimTypes.NameIdentifier) ? "Người lập không được tự duyệt đối chiếu." : "Bước đối chiếu cần Quản lý độc lập duyệt.");
        }
        IReadOnlyList<ApprovalAssignment> assignments = [];
        if (state == "PENDING" && type is "material-demand" or "purchase-request")
        {
            var rule = await routing.GetMatchingRuleAsync(type, null);
            if (rule is not null) assignments = (await routing.GetAssignmentsForRuleAsync(rule.RuleId))
                .Where(row => row.IsRequired).OrderBy(row => row.Sequence).ToList();
            var steps = history.Where(row => row.Decision == "STEP_APPROVED").ToList();
            var blocked = ApprovalStepPolicy.ApprovalBlocker(assignments, steps.Select(row => GuidHelper.ParseGuidString(row.ActionBy)!), steps.Count, actor);
            if (blocked is not null) { allowed.Remove("APPROVE"); blockedReasons.Add(blocked); }
        }
        var assignmentEvidence = assignments.Select(row => new { row.Sequence, row.ApproverRole, row.ApproverUserId });
        var fingerprint = Hash(new { item, impact, blockedReasons, history, assignmentEvidence, supplementalDemand, stocktake, legacy, sourceChange, sourceDishNames });
        return new(mode.Mode, mode.Version, item, fingerprint, allowed, blockedReasons, impact) { SupplementalDemand = supplementalDemand, Stocktake = stocktake, LegacyLineage = legacy, SourceChange = sourceChange, SourceDishNames = sourceDishNames };
    }

    public async Task<IReadOnlyList<ApprovalHistoryItemDto>> GetHistoryAsync(ClaimsPrincipal actor, string type,
        string id, CancellationToken token = default)
    {
        var mode = await new SystemOperationModeGuard(context).ReadRequiredAsync(token);
        OperationalApprovalRegistry.Require(actor, mode.Mode, type);
        var targetId = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        if (mode.Mode == SystemOperationEligibility.Default)
        {
            if (type == "legacy-lineage-disposition") return await new OperationalLegacyLineageSource(context).HistoryAsync(id, token);
            if (type == "stocktake")
            {
                await new OperationalStocktakeSource(context).DetailAsync(id, token);
                var audits = await context.Auditlogs.AsNoTracking().Include(x => x.ChangedByNavigation)
                    .Where(x => x.EntityName == nameof(Stocktake) && x.EntityId == targetId && x.FieldName == "Status")
                    .OrderBy(x => x.ChangedAt).ThenBy(x => x.AuditId).ToListAsync(token);
                return audits.Select(x => new ApprovalHistoryItemDto { HistoryId = GuidHelper.ToGuidString(x.AuditId), TargetType = type, TargetId = id,
                    Decision = x.NewValue ?? "", OldStatus = x.OldValue, NewStatus = x.NewValue, Reason = x.Reason, ActionBy = GuidHelper.ToGuidString(x.ChangedBy),
                    ActionByName = x.ChangedByNavigation?.FullName ?? "", ActionAt = x.ChangedAt }).ToList();
            }
            if (type == "inventory-issue" && await context.Inventoryissues.AsNoTracking()
                .AnyAsync(item => item.IssueId == targetId && item.ReconciliationBatchId != null, token))
                throw new UnauthorizedAccessException("Hồ sơ thuộc chế độ vận hành khác.");
            return await new ApprovalHistoryQueryService(context).GetHistoryAsync(type, targetId);
        }
        if (type == "mrx-batch-review") return await new OperationalMrxBatchSource(context).HistoryAsync(id, token);
        if (type == "mrx-supplemental-demand")
        {
            await RequiredSupplemental().GetAsync(id, actor, token);
            var audits = await context.Auditlogs.AsNoTracking().Include(row => row.ChangedByNavigation)
                .Where(row => row.BusinessArea == "MATERIAL_RECONCILIATION" && row.EntityName == nameof(ReconciliationSupplementalDemand)
                    && row.EntityId == targetId && row.FieldName == "Status")
                .OrderBy(row => row.ChangedAt).ThenBy(row => row.AuditId).ToListAsync(token);
            var directConfirmation = await context.Approvalhistories.AsNoTracking().AnyAsync(row =>
                row.TargetType == type && row.TargetId == targetId && row.Decision == "ADMIN_DIRECT", token);
            return audits.Select(row => new ApprovalHistoryItemDto { HistoryId = GuidHelper.ToGuidString(row.AuditId), TargetType = type,
                TargetId = id, Decision = row.NewValue == "APPROVED" && directConfirmation ? "ADMIN_DIRECT" : row.NewValue ?? "",
                OldStatus = row.OldValue, NewStatus = row.NewValue, Reason = row.Reason,
                ActionBy = GuidHelper.ToGuidString(row.ChangedBy), ActionByName = row.ChangedByNavigation?.FullName ?? "",
                ActionAt = row.ChangedAt }).ToList();
        }
        await ReadMrxTargetAsync(id, token);
        var events = await context.Auditlogs.AsNoTracking().Include(item => item.ChangedByNavigation)
            .Where(item => item.BusinessArea == "Reconciliation" && item.EntityName == nameof(MenuAmendment) &&
                item.EntityId == targetId && item.FieldName == "Status")
            .OrderBy(item => item.ChangedAt).ThenBy(item => item.AuditId).ToListAsync(token);
        return events.Select(item => new ApprovalHistoryItemDto { HistoryId = GuidHelper.ToGuidString(item.AuditId),
            TargetType = type, TargetId = id, Decision = item.NewValue ?? string.Empty,
            OldStatus = item.OldValue, NewStatus = item.NewValue, Reason = item.Reason,
            ActionBy = GuidHelper.ToGuidString(item.ChangedBy), ActionByName = item.ChangedByNavigation?.FullName ?? "",
            ActionAt = item.ChangedAt }).ToList();
    }

    public async Task<ApprovalResultDto> DecideAsync(ClaimsPrincipal actor, string type, string id,
        OperationalApprovalActionRequest request, CancellationToken token = default)
    {
        var mode = await new SystemOperationModeGuard(context).ReadRequiredAsync(token);
        OperationalApprovalRegistry.Require(actor, mode.Mode, type);
        if (type == "mrx-batch-review")
            throw new BusinessRuleException("Mở trạm đối soát để xử lý sai lệch và chốt lô.");
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Không xác định được người duyệt.");
        var targetId = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        if (!Guid.TryParse(request.CommandId, out _)) throw new ArgumentException("Mã lệnh quyết định không hợp lệ.");
        var aggregate = $"OperationalApproval:{mode.Mode}:{type}";
        var payloadHash = Hash(new { actorId, request.ExpectedModeVersion, request.ExpectedFingerprint, request.Decision, request.Action, request.Reason });
        var replay = await ReadCommandAsync(request.CommandId, aggregate, targetId, token);
        if (replay is not null) return Replay(replay, payloadHash);
        var operation = new SystemOperationRequestContext { Mode = mode.Mode, OperationKey = "approvals.operational",
            ExpectedModeVersion = request.ExpectedModeVersion, Disposition = OperationDisposition.Retained };
        var runner = new EfTransactionRunner(context, operation, new SystemOperationModeGuard(context));
        var envelope = await runner.ExecuteProtectedAsync("approvals.operational", request.ExpectedModeVersion, async ct =>
        {
            context.ChangeTracker.Clear();
            if (mode.Mode == SystemOperationEligibility.Default && type == "legacy-lineage-disposition" && context.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
                await context.Database.ExecuteSqlRawAsync("SELECT dispositionId FROM legacylinedispositions WHERE dispositionId = {0} FOR UPDATE", [targetId], ct);
            else if (mode.Mode == SystemOperationEligibility.Default && type == "stocktake" && context.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
                await context.Database.ExecuteSqlRawAsync("SELECT stocktakeId FROM stocktakes WHERE stocktakeId = {0} FOR UPDATE", [targetId], ct);
            else if (mode.Mode == SystemOperationEligibility.Default && type is not ("stocktake" or "legacy-lineage-disposition"))
                await ApprovalTargetLock.AcquireAsync(context, ApprovalTargetTypeParser.Parse(type)!.Value, targetId, ct);
            else if (context.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
            {
                if (type == "mrx-supplemental-demand")
                {
                    var batchId = await context.Reconciliationsupplementaldemands.AsNoTracking().Where(x => x.DemandId == targetId).Select(x => x.BatchId).SingleOrDefaultAsync(ct)
                        ?? throw new KeyNotFoundException("Không tìm thấy đề nghị suất phát sinh.");
                    await context.Database.ExecuteSqlRawAsync("SELECT batchId FROM reconciliationbatches WHERE batchId = {0} FOR UPDATE", [batchId], ct);
                }
                else await context.Database.ExecuteSqlRawAsync("SELECT menuAmendmentId FROM menuamendments WHERE menuAmendmentId = {0} FOR UPDATE", [targetId], ct);
            }
            var existing = await ReadCommandAsync(request.CommandId, aggregate, targetId, ct);
            if (existing is not null) { Replay(existing, payloadHash); return existing; }
            var activeMode = await new SystemOperationModeGuard(context).ReadRequiredAsync(ct);
            if (activeMode.Mode != mode.Mode || activeMode.Version != mode.Version)
                throw new SystemOperationConflictException("Chế độ vận hành đã thay đổi. Hãy tải lại hồ sơ.");
            CommandEnvelope response;
            try { response = new(payloadHash, await DecideCurrentAsync(actor, type, id, request, ct), null, []); }
            catch (MrxSourceChangeException error) when (error.Code == MrxErrorCodes.DayLocked)
            {
                // The source owner records CORRECTION_REQUIRED after rejecting a newly locked day.
                // Preserve that explicit domain outcome and its audit, and replay the same error.
                response = new(payloadHash, null, error.Message, error.LockedDates?.ToArray() ?? []);
            }
            context.Lifecyclecommandreceipts.Add(new LifecycleCommandReceipt { CommandReceiptId = GuidHelper.NewId(),
                CommandId = request.CommandId, AggregateType = aggregate, AggregateId = targetId,
                ResponseJson = JsonSerializer.Serialize(response), CreatedAt = DateTime.UtcNow });
            await context.SaveChangesAsync(ct);
            return response;
        }, async ct => await ReadCommandAsync(request.CommandId, aggregate, targetId, ct) is not null,
            IsolationLevel.Serializable, token);
        return Replay(envelope, payloadHash);
    }

    private async Task<ApprovalResultDto> DecideCurrentAsync(ClaimsPrincipal actor, string type, string id,
        OperationalApprovalActionRequest request, CancellationToken token)
    {
        OperationalApprovalDetail detail;
        try { detail = await GetDetailAsync(actor, type, id, token); }
        catch (KeyNotFoundException) when (type == "mrx-supplemental-demand")
        {
            // A concurrent decision can move the demand out of the pending queue while this command waits.
            await GetDetailAsync(actor, type, id, token, state: "PROCESSED");
            throw new SystemOperationConflictException("Đề nghị đã được xử lý. Mở Lịch sử quyết định để xem kết quả.");
        }
        if (detail.ModeVersion != request.ExpectedModeVersion || detail.Fingerprint != request.ExpectedFingerprint)
            throw new SystemOperationConflictException("Hồ sơ đã thay đổi. Hãy tải lại và xem xét lại trước khi duyệt.");
        if (!Enum.IsDefined(request.Decision)) throw new ArgumentException("Quyết định không hợp lệ.");
        var binaryAction = request.Decision == ApprovalDecision.Approve ? "APPROVE" : "REJECT";
        if (type != "legacy-lineage-disposition" && request.Action is not null && request.Action != binaryAction)
            throw new ArgumentException("Thao tác không khớp quyết định được gửi.");
        var action = request.Action ?? binaryAction;
        if (!detail.AllowedActions.Contains(action))
            throw new UnauthorizedAccessException(string.Join(" ", detail.BlockedReasons));
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng nhập căn cứ quyết định.");
        var actorId = actor.FindFirstValue(ClaimTypes.NameIdentifier);
        if (detail.Mode == SystemOperationEligibility.Default && type == "legacy-lineage-disposition")
        {
            var owner = lineage ?? throw new InvalidOperationException("Thiếu owner đối chiếu liên kết chứng từ.");
            var current = detail.LegacyLineage!;
            var lineageResult = action == "APPLY"
                ? await owner.ApplyAsync(id, new() { CommandId = request.CommandId, ExpectedVersion = current.Version, Reason = request.Reason }, actorId!, token)
                : await owner.ReviewAsync(id, new() { CommandId = request.CommandId, ExpectedVersion = current.Version,
                    Reason = request.Reason, Approve = action == "REVIEW_APPROVE" }, actorId!, token);
            return new ApprovalResultDto { TargetType = type, TargetId = id, Status = lineageResult.Status, OldStatus = current.Status,
                NewStatus = lineageResult.Status, ActionAt = lineageResult.AppliedAt ?? lineageResult.ReviewedAt ?? lineageResult.CreatedAt };
        }
        if (detail.Mode == SystemOperationEligibility.Default && type == "stocktake")
        {
            var service = stocktakes ?? throw new InvalidOperationException("Thiếu owner duyệt kiểm kê.");
            var stocktakeResult = request.Decision == ApprovalDecision.Approve ? await service.ApproveAsync(id, actorId!)
                : await service.RejectAsync(id, actorId!, request.Reason);
            var stocktakeId = GuidHelper.ParseGuidString(id)!;
            var decisionAudit = context.Auditlogs.Local.SingleOrDefault(x => x.EntityName == nameof(Stocktake) && x.FieldName == "Status"
                && x.EntityId.SequenceEqual(stocktakeId) && x.NewValue == stocktakeResult.Status);
            if (decisionAudit is not null) decisionAudit.Reason = request.Reason.Trim();
            return new ApprovalResultDto { TargetType = type, TargetId = id, OldStatus = "REVIEWING", NewStatus = stocktakeResult.Status,
                Status = stocktakeResult.Status, ActionAt = stocktakeResult.ApprovedAt ?? DateTime.UtcNow };
        }
        if (detail.Mode == SystemOperationEligibility.Default)
            return await workflow.ExecuteAsync(type, id, new ApprovalRequest { Status = request.Decision, Reason = request.Reason }, actorId, actor)
                ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ.");
        if (type == "mrx-supplemental-demand")
        {
            var demand = detail.SupplementalDemand ?? throw new InvalidOperationException("Thiếu hồ sơ nhu cầu phát sinh.");
            var command = new ReconciliationSupplementalDemandCommand(request.CommandId, demand.Version, demand.BatchVersion, request.Reason);
            var decided = request.Decision == ApprovalDecision.Approve
                ? await RequiredSupplemental().ApproveAsync(id, command, actor, token)
                : await RequiredSupplemental().RejectAsync(id, command, actor, token);
            return new ApprovalResultDto { TargetType = type, TargetId = id, OldStatus = demand.Status, NewStatus = decided.Status,
                Status = decided.Status, ActionAt = decided.DecidedAt ?? DateTime.UtcNow };
        }
        var result = await amendments.DecideMrxAsync(id,
            new ReviewMenuAmendmentRequest { Approved = request.Decision == ApprovalDecision.Approve, Reason = request.Reason },
            actorId, actor.FindAll(ClaimTypes.Role).Select(claim => claim.Value).ToArray(), token);
        return new ApprovalResultDto { TargetType = type, TargetId = id, Status = result.Status,
            OldStatus = detail.Item.Status, NewStatus = result.Status };
    }

    private sealed record CommandEnvelope(string PayloadHash, ApprovalResultDto? Result, string? LockedError, DateOnly[] LockedDates);
    private ReconciliationSupplementalDemandService RequiredSupplemental() => supplemental
        ?? throw new InvalidOperationException("Chưa cấu hình xử lý nhu cầu suất phát sinh.");
    private Task<LifecycleCommandReceipt?> FindCommandAsync(string commandId, string aggregate, byte[] id, CancellationToken token) =>
        context.Lifecyclecommandreceipts.AsNoTracking().SingleOrDefaultAsync(row => row.CommandId == commandId &&
            row.AggregateType == aggregate && row.AggregateId == id, token);
    private async Task<CommandEnvelope?> ReadCommandAsync(string commandId, string aggregate, byte[] id, CancellationToken token)
    {
        var receipt = await FindCommandAsync(commandId, aggregate, id, token);
        return receipt is null ? null : JsonSerializer.Deserialize<CommandEnvelope>(receipt.ResponseJson)
            ?? throw new InvalidOperationException("Không đọc được kết quả quyết định đã ghi nhận.");
    }
    private static ApprovalResultDto Replay(CommandEnvelope envelope, string hash)
    {
        if (envelope.PayloadHash != hash) throw new SystemOperationConflictException("Mã lệnh đã được dùng cho quyết định hoặc tài khoản khác.");
        if (envelope.LockedError is not null) throw new MrxSourceChangeException(MrxErrorCodes.DayLocked, 409, envelope.LockedError, envelope.LockedDates);
        return envelope.Result ?? throw new InvalidOperationException("Thiếu kết quả quyết định đã ghi nhận.");
    }
    private static string Hash<T>(T value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> ReadDefaultHistoryPageAsync(ClaimsPrincipal actor, SystemOperationSnapshot mode,
        IReadOnlyList<OperationalApprovalTarget> targets, ApprovalInboxQueryDto query, CancellationToken token)
    {
        var cursor = Decode(query.Cursor, Scope(actor, mode, query));
        var best = new List<ApprovalInboxItemDto>();
        var reader = new OperationalApprovalHistoryReader(context);
        for (var offset = 0; ; offset += 100)
        {
            var batch = await reader.ReadAsync(targets, query, token, offset, 100);
            best.AddRange(ApprovalInboxQueryPolicy.Apply(batch.Items, query).Where(item => cursor is null || item.SubmittedAt > cursor.At
                || item.SubmittedAt == cursor.At && string.CompareOrdinal(item.InboxItemId, cursor.Id) > 0));
            best = best.OrderBy(x => x.SubmittedAt).ThenBy(x => x.InboxItemId, StringComparer.Ordinal).Take(Math.Clamp(query.Limit, 1, 50) + 1).ToList();
            // Mapping excludes inactive source families. A short mapped batch does not prove SQL exhaustion.
            if (!batch.HasMore) break;
        }
        return best;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> ReadStandalonePageAsync(ClaimsPrincipal actor,
        SystemOperationSnapshot mode, ApprovalInboxQueryDto query, string type, CancellationToken token)
    {
        var cursor = Decode(query.Cursor, Scope(actor, mode, query));
        var limit = Math.Clamp(query.Limit, 1, 50) + 1;
        var best = new List<ApprovalInboxItemDto>();
        var source = new OperationalStocktakeSource(context);
        var legacy = new OperationalLegacyLineageSource(context);
        for (var offset = 0; ; offset += 100)
        {
            var rows = type == "stocktake" ? await source.ReadAsync(query, token, offset, 100) : await legacy.ReadAsync(query, token, offset, 100);
            best.AddRange(ApprovalInboxQueryPolicy.Apply(rows, query).Where(item => cursor is null || item.SubmittedAt > cursor.At
                || item.SubmittedAt == cursor.At && string.CompareOrdinal(item.InboxItemId, cursor.Id) > 0));
            best = best.OrderBy(x => x.SubmittedAt).ThenBy(x => x.InboxItemId, StringComparer.Ordinal).Take(limit).ToList();
            if (rows.Count < 100) break;
        }
        return best;
    }

    private async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, IReadOnlyList<OperationalApprovalUnavailableSource> UnavailableSources)> ReadMrxPageAsync(
        ClaimsPrincipal actor, SystemOperationSnapshot mode, ApprovalInboxQueryDto query, CancellationToken token)
    {
        var cursor = Decode(query.Cursor, Scope(actor, mode, query));
        var limit = Math.Clamp(query.Limit, 1, 50) + 1;
        var bestBySource = new Dictionary<string, List<ApprovalInboxItemDto>>();
        var failures = new List<OperationalApprovalUnavailableSource>();
        var sources = OperationalApprovalRegistry.ForActor(actor, mode.Mode).ToDictionary(x => x.TargetType);
        var supplementalSource = new OperationalSupplementalDemandSource(context);
        var batchSource = new OperationalMrxBatchSource(context);
        for (var offset = 0; ; offset += 100)
        {
            var amendments = await ReadSourceAsync("mrx-source-change", () => ReadMrxItemsAsync(query, token, offset, 100));
            var demands = await ReadSourceAsync("mrx-supplemental-demand", () => supplementalSource.ReadAsync(query, token, offset, 100));
            var batches = await ReadSourceAsync("mrx-batch-review", () => batchSource.ReadAsync(query, token, offset, 100));
            foreach (var failure in failures) bestBySource.Remove(failure.TargetType);
            var candidates = ApprovalInboxQueryPolicy.Apply(amendments.Items.Concat(demands.Items).Concat(batches.Items), query)
                .Where(item => cursor is null || item.SubmittedAt > cursor.At
                    || item.SubmittedAt == cursor.At && string.CompareOrdinal(item.InboxItemId, cursor.Id) > 0);
            foreach (var group in candidates.GroupBy(item => item.TargetType))
            {
                var retained = bestBySource.GetValueOrDefault(group.Key, []);
                retained.AddRange(group);
                bestBySource[group.Key] = retained.OrderBy(x => x.SubmittedAt)
                    .ThenBy(x => x.InboxItemId, StringComparer.Ordinal).Take(limit).ToList();
            }
            if (!amendments.HasMore && !demands.HasMore && !batches.HasMore) break;
        }
        var best = bestBySource.Values.SelectMany(x => x).OrderBy(x => x.SubmittedAt)
            .ThenBy(x => x.InboxItemId, StringComparer.Ordinal).Take(limit).ToList();
        return (best, failures);

        async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadSourceAsync(string type,
            Func<Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)>> read)
        {
            if (!sources.ContainsKey(type) || !ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, type)
                || failures.Any(x => x.TargetType == type)) return ([], false);
            try { return await read(); }
            catch (Exception error) when (error is System.Data.Common.DbException or JsonException or InvalidOperationException)
            {
                failures.Add(new(type, $"{sources[type].Label} chưa tải được"));
                return ([], false);
            }
        }
    }

    private async Task<MenuAmendment> ReadMrxTargetAsync(string id, CancellationToken token)
    {
        var key = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        var item = await context.Menuamendments.AsNoTracking().SingleOrDefaultAsync(item => item.MenuAmendmentId == key, token)
            ?? throw new KeyNotFoundException("Không tìm thấy hồ sơ.");
        if (item.BaseMenuVersionId is null)
            throw new UnauthorizedAccessException("Hồ sơ không thuộc chế độ Đối soát nguyên liệu.");
        return item;
    }

    private async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadMrxItemsAsync(ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100)
    {
        var key = string.IsNullOrEmpty(query.TargetId) ? null : GuidHelper.ParseGuidString(query.TargetId) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        var customerCode = query.CustomerCode?.Trim().ToUpperInvariant();
        var records = await context.Menuamendments.AsNoTracking().Include(item => item.Customer).Include(item => item.CreatedByNavigation)
            .Where(item => (query.State == "PENDING" ? item.Status == "PENDING_REVIEW" : item.Status != "PENDING_REVIEW") &&
                (string.IsNullOrEmpty(customerCode) || item.Customer.CustomerCode.ToUpper() == customerCode) && item.BaseMenuVersionId != null && (key == null || item.MenuAmendmentId == key))
            .OrderBy(item => item.CreatedAt).ThenBy(item => item.MenuAmendmentId).Skip(offset).Take(limit + 1).ToListAsync(token);
        var hasMore = records.Count > limit;
        var items = records.Take(limit).Select(item =>
        {
            var targetId = GuidHelper.ToGuidString(item.MenuAmendmentId);
            return new ApprovalInboxItemDto { InboxItemId = $"MATERIAL_RECONCILIATION:mrx-source-change:{targetId}",
                TargetType = "mrx-source-change", TargetId = targetId, TargetCode = item.Customer.CustomerCode,
                CustomerCode = item.Customer.CustomerCode,
                ServiceDates = ReadImpact(item).ImpactLines.Select(x => x.ServiceDate)
                    .Concat(ReadImpact(item).MaterialImpact.Select(x => x.ServiceDate)).Distinct().Order().ToArray(),
                Title = "Thay đổi nguồn thực đơn", Source = item.Customer.CustomerName, SubmittedBy = item.CreatedByNavigation.FullName,
                SubmittedAt = item.CreatedAt, Status = item.Status, Reason = item.Reason, WeekStartDate = item.WeekStartDate,
                Route = $"/approvals?targetType=mrx-source-change&targetId={targetId}" };
        }).ToList();
        return (items, hasMore);
    }

    private static MenuAmendmentResultDto ReadImpact(MenuAmendment item) =>
        JsonSerializer.Deserialize<MenuAmendmentResultDto>(item.ImpactSnapshotJson)
        ?? throw new InvalidOperationException("Thiếu bằng chứng thay đổi nguồn.");
    private sealed record Cursor(DateTime? At, string Id, string Scope);
    private static string Scope(ClaimsPrincipal actor, SystemOperationSnapshot mode, ApprovalInboxQueryDto query) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
            Actor = actor.FindFirstValue(ClaimTypes.NameIdentifier), Roles = actor.FindAll(ClaimTypes.Role).Select(c => c.Value).Order(),
            mode.Mode, mode.Version, query.State, query.TargetType, query.TargetId, query.Date, query.Week, query.CustomerCode, query.SearchKeyword }))));
    private static string Encode(Cursor cursor) => Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(cursor)));
    private static Cursor? Decode(string? value, string scope)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        try
        {
            var cursor = JsonSerializer.Deserialize<Cursor>(Encoding.UTF8.GetString(Convert.FromBase64String(value)));
            if (cursor is null || cursor.Scope != scope) throw new ArgumentException("Phạm vi duyệt đã thay đổi. Hãy tải lại danh sách.");
            return cursor;
        }
        catch (Exception error) when (error is FormatException or JsonException)
        { throw new ArgumentException("Con trỏ phân trang không hợp lệ.", error); }
    }
}
