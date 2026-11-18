using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class MrxHistoricalPurposeRecoveryService(IpcManagementContext db, IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    internal const string Operation = "reconciliation.historical-purpose";
    internal const string Target = "mrx-historical-purpose";
    private const string Aggregate = nameof(MrxHistoricalPurposeProposal);

    public async Task<IReadOnlyList<MrxHistoricalPurposeCandidate>> ListAsync(string batchId, DateOnly date, ClaimsPrincipal actor, CancellationToken token)
    {
        RequireActor(actor, AuthorizationPolicies.ReconciliationSupplementalDemandWriteRoles);
        await RequireModeAsync(token);
        var batchKey = Id(batchId);
        var batchVersion = await db.Reconciliationbatches.AsNoTracking().Where(row => row.BatchId == batchKey && row.Status == "IN_PROGRESS")
            .Select(row => (long?)row.Version).SingleOrDefaultAsync(token);
        if (batchVersion is not long currentVersion) return [];
        var issues = await ScopedIssueLines(batchKey, date).Include(row => row.Issue).Include(row => row.Ingredient)
            .Include(row => row.Unit).OrderBy(row => row.Issue.CreatedAt).ThenBy(row => row.IssueLineId).ToListAsync(token);
        var keys = issues.Select(row => row.IssueLineId).ToList();
        var allocations = await db.Reconciliationissueallocations.AsNoTracking().Where(row => keys.Contains(row.IssueLineId)).ToListAsync(token);
        var returns = await db.Inventoryreturnlines.AsNoTracking().Where(row => row.SourceIssueLineId != null
            && keys.Contains(row.SourceIssueLineId) && row.Return.ReceivedAt != null).ToListAsync(token);
        var pending = await db.Mrxhistoricalpurposeproposals.AsNoTracking().Where(row => row.BatchId == batchKey
            && row.ServiceDate == date && row.Status == "PENDING").ToListAsync(token);
        var demands = (await db.Reconciliationsupplementaldemandmaterials.AsNoTracking().Include(row => row.Demand)
            .Where(row => row.BatchId == batchKey && row.Demand.BatchId == batchKey && row.Demand.ServiceDate == date
                && row.Demand.Status == "APPROVED").ToListAsync(token)).ToLookup(row => Key(row.DailyLineId));
        var assigned = allocations.ToLookup(row => Key(row.IssueLineId));
        var returned = returns.ToLookup(row => Key(row.SourceIssueLineId!));
        var open = pending.ToDictionary(row => Key(row.IssueLineId));
        return issues.Select(row =>
        {
            var key = Key(row.IssueLineId);
            return new MrxHistoricalPurposeCandidate(GuidHelper.ToGuidString(row.IssueLineId), row.Issue.IssueCode,
                row.Ingredient.IngredientName, row.Unit.UnitName, row.IssuedQty - assigned[key].Sum(x => x.Quantity),
                returned[key].Sum(x => x.Quantity), currentVersion,
                open.TryGetValue(key, out var proposal) ? GuidHelper.ToGuidString(proposal.ProposalId) : null,
                demands[Key(row.ReconciliationBatchDailyLineId!)].Where(x => x.Demand.DecidedAt <= row.Issue.CreatedAt
                    && x.CanonicalUnitId.SequenceEqual(row.UnitId) && x.IngredientId.SequenceEqual(row.IngredientId))
                    .Select(x => new MrxHistoricalPurposeDemand(GuidHelper.ToGuidString(x.DemandId), GuidHelper.ToGuidString(x.DemandMaterialId), x.Demand.Version)).ToList());
        }).Where(row => row.UnallocatedQuantity > 0).ToList();
    }

    public Task<MrxHistoricalPurposeDetail> ProposeAsync(MrxHistoricalPurposeProposalRequest request, ClaimsPrincipal actor,
        CancellationToken token = default)
    {
        var actorId = RequireActor(actor, AuthorizationPolicies.ReconciliationWarehouseIssueRoles);
        var direct = HasRole(actor, AuthorizationPolicies.AdminRoles);
        var proposalId = Id(request.CommandId);
        var batchId = Id(request.BatchId);
        var issueLineId = Id(request.IssueLineId);
        var reason = Reason(request.Reason);
        return WriteAsync(request.CommandId, proposalId, new { actor = Key(actorId), action = "PROPOSE", request },
            _ => Task.FromResult(batchId), request.ExpectedBatchVersion, async (batch, ct) =>
        {
            var source = await ScopedIssueLines(batchId, request.ServiceDate).Include(x => x.Issue).Include(x => x.Ingredient)
                .Include(x => x.Unit).SingleOrDefaultAsync(row => row.IssueLineId == issueLineId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy dòng phiếu trong lô và ngày đã chọn.");
            if (await db.Mrxhistoricalpurposeproposals.AnyAsync(row => row.IssueLineId == issueLineId && row.Status == "PENDING", ct))
                throw new DbUpdateConcurrencyException("Dòng phiếu đã có đề xuất chờ duyệt.");
            var split = await ValidateAsync(source, request.Allocations, ct);
            var proposal = new MrxHistoricalPurposeProposal
            {
                ProposalId = proposalId, BatchId = batchId, IssueLineId = issueLineId, ServiceDate = request.ServiceDate,
                UnallocatedQuantity = request.Allocations.Sum(row => row.Quantity),
                AllocationsJson = JsonSerializer.Serialize(request.Allocations), CreatedBy = actorId, CreatedAt = DateTime.UtcNow,
                Reason = reason, Status = direct ? "APPLIED" : "PENDING", DecisionReason = direct ? reason : null
            };
            db.Mrxhistoricalpurposeproposals.Add(proposal);
            if (direct) await ApplyAsync(batch, source, split, actorId, ct);
            return Record(proposal, source, batch.Version, actorId, null, direct ? "ADMIN_DIRECT" : "PENDING", reason, request.CommandId);
        }, token);
    }

    public Task<MrxHistoricalPurposeDetail> DecideAsync(string id, MrxHistoricalPurposeDecision request, ClaimsPrincipal actor,
        CancellationToken token = default)
    {
        var actorId = RequireActor(actor, AuthorizationPolicies.ReconciliationDecisionRoles);
        var proposalId = Id(id);
        var reason = Reason(request.Reason);
        return WriteAsync(request.CommandId, proposalId, new { actor = Key(actorId), action = "DECIDE", request },
            async ct => await db.Mrxhistoricalpurposeproposals.AsNoTracking().Where(row => row.ProposalId == proposalId)
                .Select(row => row.BatchId).SingleOrDefaultAsync(ct) ?? throw new KeyNotFoundException("Không tìm thấy đề xuất phân bổ."),
            request.ExpectedBatchVersion, async (batch, ct) =>
        {
            var proposal = await db.Mrxhistoricalpurposeproposals.SingleAsync(row => row.ProposalId == proposalId, ct);
            if (proposal.Version != request.ExpectedVersion || proposal.Status != "PENDING")
                throw new DbUpdateConcurrencyException("Đề xuất đã thay đổi. Hãy tải lại trước khi tiếp tục.");
            if (proposal.CreatedBy.SequenceEqual(actorId))
                throw new UnauthorizedAccessException("Người lập không được tự duyệt đề xuất phân bổ.");
            var source = await ScopedIssueLines(batch.BatchId, proposal.ServiceDate).Include(x => x.Issue).Include(x => x.Ingredient)
                .Include(x => x.Unit).SingleOrDefaultAsync(row => row.IssueLineId == proposal.IssueLineId, ct)
                ?? throw new KeyNotFoundException("Dòng phiếu không còn khớp phạm vi đề xuất.");
            if (request.Approve) await ApplyAsync(batch, source, await ValidateAsync(source, ReadSplit(proposal), ct), actorId, ct);
            proposal.Status = request.Approve ? "APPLIED" : "REJECTED";
            proposal.DecisionReason = reason;
            proposal.Version++;
            return Record(proposal, source, batch.Version, actorId, "PENDING", proposal.Status, reason, request.CommandId);
        }, token);
    }

    internal async Task<MrxHistoricalPurposeDetail> GetDetailAsync(string id, CancellationToken token)
    {
        var key = Id(id);
        var row = await db.Mrxhistoricalpurposeproposals.AsNoTracking().Include(x => x.Batch)
            .Include(x => x.IssueLine).ThenInclude(x => x.Issue)
            .Include(x => x.IssueLine).ThenInclude(x => x.Ingredient)
            .Include(x => x.IssueLine).ThenInclude(x => x.Unit)
            .SingleOrDefaultAsync(x => x.ProposalId == key, token) ?? throw new KeyNotFoundException("Không tìm thấy đề xuất phân bổ.");
        return Map(row, row.IssueLine, row.Batch.Version);
    }

    private IQueryable<InventoryIssueLine> ScopedIssueLines(byte[] batchId, DateOnly date) => db.Inventoryissuelines.AsNoTracking()
        .Where(row => row.Issue.ReconciliationBatchId == batchId && row.Issue.IssueDate == date && row.Issue.MaterialRequestId == null
            && row.MaterialRequestLineId == null && row.ReconciliationBatchDailyLineId != null
            && (row.ReconciliationServiceDate == null || row.ReconciliationServiceDate == date)
            && row.ReconciliationBatchDailyLine!.BatchId == batchId && row.ReconciliationBatchDailyLine.ServiceDate == date
            && row.ReconciliationBatchLineId == row.ReconciliationBatchDailyLine.BatchLineId
            && row.UnitId == row.ReconciliationBatchDailyLine.CanonicalUnitId && row.IngredientId == row.ReconciliationBatchDailyLine.IngredientId);

    private async Task<List<ReconciliationIssueAllocation>> ValidateAsync(InventoryIssueLine source,
        IReadOnlyList<MrxHistoricalPurposeAllocation> split, CancellationToken token)
    {
        if (split is null || split.Count is < 1 or > 20 || split.Any(row => row.Quantity <= 0
            || row.Quantity > source.IssuedQty || DecimalPolicy.RoundQuantity(row.Quantity) != row.Quantity))
            throw new BusinessRuleException("Mỗi phần phân bổ phải dương và có tối đa 6 chữ số thập phân.");
        var existing = await db.Reconciliationissueallocations.AsNoTracking().Where(row => row.IssueLineId == source.IssueLineId).ToListAsync(token);
        var missing = source.IssuedQty - existing.Sum(row => row.Quantity);
        if (missing <= 0 || split.Sum(row => row.Quantity) != missing || existing.Any(row => !row.DailyLineId.SequenceEqual(source.ReconciliationBatchDailyLineId!)))
            throw new BusinessRuleException("Tổng phân bổ phải bằng đúng lượng chưa phân bổ của dòng phiếu.");
        var returned = (await db.Inventoryreturnlines.AsNoTracking().Where(row => row.SourceIssueLineId == source.IssueLineId
            && row.Return.ReceivedAt != null).Select(row => row.Quantity).ToListAsync(token)).Sum();
        if (returned < 0 || returned > source.IssuedQty || returned > 0 && existing.Count + split.Count != 1)
            throw new BusinessRuleException("Phiếu trả chưa xác định được mục đích. Cần đối chiếu chứng từ trước khi phân bổ.");
        var dailyId = source.ReconciliationBatchDailyLineId!;
        var daily = await db.Reconciliationbatchdailylines.AsNoTracking().SingleAsync(row => row.DailyLineId == dailyId, token);
        var balances = await ReconciliationSupplementalFulfillmentQuery.GetManyAsync(db, [daily], token);
        var balance = balances[Key(dailyId)];
        var keys = new HashSet<(string Purpose, string Demand)>();
        var allocations = new List<ReconciliationIssueAllocation>();
        foreach (var part in split)
        {
            var netPart = part.Quantity - returned;
            byte[]? materialId = null;
            if (part.Purpose == "APPROVED_EXTRA_DEMAND")
            {
                materialId = Id(part.DemandMaterialId);
                var material = await db.Reconciliationsupplementaldemandmaterials.AsNoTracking().Include(row => row.Demand)
                    .SingleOrDefaultAsync(row => row.DemandMaterialId == materialId && row.DailyLineId == dailyId, token);
                var demandBalance = balance.ExtraDemands.SingleOrDefault(row => row.DemandMaterialId == GuidHelper.ToGuidString(materialId));
                if (material is null || demandBalance is null || material.Demand.DecidedAt is not { } approvedAt
                    || approvedAt > source.Issue.CreatedAt || part.ExpectedDemandVersion != material.Demand.Version
                    || netPart > demandBalance.RequiredQuantity - demandBalance.IssuedQuantity)
                    throw new BusinessRuleException("Hồ sơ phát sinh chưa duyệt tại thời điểm xuất, đã đổi phiên bản hoặc không đủ phần thiếu.");
            }
            else
            {
                if (part.Purpose is not ("BASELINE_SHORTAGE" or "UNPLANNED_EXTRA")
                    || part.DemandMaterialId is not null || part.ExpectedDemandVersion is not null)
                    throw new BusinessRuleException("Mục đích phân bổ không hợp lệ.");
                if (part.Purpose == "BASELINE_SHORTAGE" && netPart > Math.Max(0, daily.RequiredQuantity - balance.BaselineIssuedQuantity))
                    throw new BusinessRuleException("Phần bù gốc vượt nhu cầu gốc còn thiếu.");
            }
            if (!keys.Add((part.Purpose, materialId is null ? "" : Key(materialId))) || existing.Any(row => row.Purpose == part.Purpose
                && (row.DemandMaterialId is null ? materialId is null : materialId is not null && row.DemandMaterialId.SequenceEqual(materialId))))
                throw new BusinessRuleException("Mục đích phân bổ bị trùng trên dòng phiếu.");
            allocations.Add(new ReconciliationIssueAllocation { AllocationId = GuidHelper.NewId(), IssueLineId = source.IssueLineId,
                DailyLineId = dailyId, DemandMaterialId = materialId, Purpose = part.Purpose, Quantity = part.Quantity });
        }
        return allocations;
    }

    private async Task ApplyAsync(ReconciliationBatch batch, InventoryIssueLine source, List<ReconciliationIssueAllocation> allocations,
        byte[] actor, CancellationToken token)
    {
        db.Reconciliationissueallocations.AddRange(allocations);
        batch.Version++;
        var dailyId = source.ReconciliationBatchDailyLineId!;
        var weeklyId = await db.Reconciliationbatchdailylines.Where(x => x.DailyLineId == dailyId).Select(x => x.BatchLineId).SingleAsync(token);
        var now = DateTime.UtcNow;
        const string reason = "Phân bổ mục đích phiếu lịch sử đã thay đổi.";
        foreach (var row in await db.Reconciliationdailydispositions.Where(x => x.InvalidatedAt == null && x.DailyLineId == dailyId).ToListAsync(token))
        {
            row.InvalidatedAt = now; row.InvalidatedBy = actor; row.InvalidationReason = reason; row.Version++;
        }
        foreach (var row in await db.Reconciliationdispositions.Where(x => x.InvalidatedAt == null && x.BatchLineId == weeklyId).ToListAsync(token))
        {
            row.InvalidatedAt = now; row.InvalidatedBy = actor; row.InvalidationReason = reason; row.Version++;
        }
    }

    private async Task<MrxHistoricalPurposeDetail> WriteAsync(string commandId, byte[] id, object payload,
        Func<CancellationToken, Task<byte[]>> resolveBatch, long expectedBatchVersion,
        Func<ReconciliationBatch, CancellationToken, Task<MrxHistoricalPurposeDetail>> execute, CancellationToken token)
    {
        _ = Id(commandId);
        await RequireModeAsync(token);
        var hash = Key(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(payload)));
        var replay = await ReadReceiptAsync(commandId, id, hash, token);
        if (replay is not null) return replay;
        var version = requestContext.ExpectedModeVersion ?? throw new InvalidOperationException("Thiếu phiên bản chế độ vận hành.");
        return await transactions.ExecuteProtectedAsync(Operation, version, async ct =>
        {
            db.ChangeTracker.Clear();
            var batchId = await resolveBatch(ct);
            if (db.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
                await db.Database.ExecuteSqlRawAsync("SELECT batchId FROM reconciliationbatches WHERE batchId = {0} FOR UPDATE", [batchId], ct);
            var previous = await ReadReceiptAsync(commandId, id, hash, ct);
            if (previous is not null) return previous;
            var batch = await db.Reconciliationbatches.SingleOrDefaultAsync(row => row.BatchId == batchId, ct)
                ?? throw new KeyNotFoundException("Không tìm thấy lô đối soát.");
            if (batch.Version != expectedBatchVersion) throw new DbUpdateConcurrencyException("Lô đã thay đổi. Hãy tải lại trước khi tiếp tục.");
            if (batch.Status != "IN_PROGRESS") throw new BusinessRuleException("Chỉ phân bổ phiếu cho lô đang xuất kho.");
            var result = await execute(batch, ct);
            db.Lifecyclecommandreceipts.Add(new LifecycleCommandReceipt
            {
                CommandReceiptId = GuidHelper.NewId(), CommandId = commandId, AggregateType = Aggregate, AggregateId = id,
                ResponseJson = JsonSerializer.Serialize(new Receipt(hash, result)), CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(ct);
            return result;
        }, async ct => await ReadReceiptAsync(commandId, id, hash, ct) is not null, IsolationLevel.Serializable, token);
    }

    private async Task<MrxHistoricalPurposeDetail?> ReadReceiptAsync(string commandId, byte[] id, string hash, CancellationToken token)
    {
        var json = await db.Lifecyclecommandreceipts.AsNoTracking().Where(row => row.CommandId == commandId
            && row.AggregateId == id && row.AggregateType == Aggregate).Select(row => row.ResponseJson).SingleOrDefaultAsync(token);
        if (json is null) return null;
        var receipt = JsonSerializer.Deserialize<Receipt>(json) ?? throw new InvalidOperationException("Không đọc được biên nhận phân bổ.");
        if (receipt.Hash != hash) throw new SystemOperationConflictException("Mã lệnh đã dùng với thao tác khác.");
        return receipt.Result;
    }

    private MrxHistoricalPurposeDetail Record(MrxHistoricalPurposeProposal proposal, InventoryIssueLine source, long batchVersion,
        byte[] actor, string? previous, string action, string reason, string commandId)
    {
        db.Auditlogs.Add(new AuditLog { AuditId = GuidHelper.NewId(), BusinessArea = SystemOperationEligibility.MaterialReconciliation,
            EntityName = Aggregate, EntityId = proposal.ProposalId, FieldName = "Status", OldValue = previous,
            NewValue = action, ChangedBy = actor, ChangedAt = DateTime.UtcNow, Reason = reason, CorrelationId = commandId });
        return Map(proposal, source, batchVersion);
    }

    private static MrxHistoricalPurposeDetail Map(MrxHistoricalPurposeProposal row, InventoryIssueLine source, long batchVersion) => new(
        GuidHelper.ToGuidString(row.ProposalId), GuidHelper.ToGuidString(row.BatchId), batchVersion, row.ServiceDate,
        GuidHelper.ToGuidString(row.IssueLineId), source.Issue.IssueCode, source.Ingredient.IngredientName, source.Unit.UnitName,
        row.UnallocatedQuantity, row.Status, row.Version, row.Reason, GuidHelper.ToGuidString(row.CreatedBy),
        row.CreatedAt, row.DecisionReason, ReadSplit(row));

    private static IReadOnlyList<MrxHistoricalPurposeAllocation> ReadSplit(MrxHistoricalPurposeProposal row) =>
        JsonSerializer.Deserialize<MrxHistoricalPurposeAllocation[]>(row.AllocationsJson) ?? throw new InvalidOperationException("Thiếu nội dung phân bổ.");
    private async Task RequireModeAsync(CancellationToken token)
    {
        if ((await new SystemOperationModeGuard(db).ReadRequiredAsync(token)).Mode != SystemOperationEligibility.MaterialReconciliation)
            throw new SystemOperationConflictException("Phân bổ phiếu lịch sử chỉ thuộc chế độ Đối soát nguyên liệu.");
    }
    private static string Reason(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 2000
        ? value.Trim() : throw new ArgumentException("Cần lý do từ 1 đến 2000 ký tự.");
    private static byte[] Id(string? value) => GuidHelper.ParseGuidString(value) ?? throw new ArgumentException("Mã định danh không hợp lệ.");
    private static string Key(byte[] value) => Convert.ToHexString(value);
    private static bool HasRole(ClaimsPrincipal actor, IEnumerable<string> roles) =>
        actor.FindAll(ClaimTypes.Role).Any(claim => roles.Contains(claim.Value, StringComparer.OrdinalIgnoreCase));
    private static byte[] RequireActor(ClaimsPrincipal actor, IEnumerable<string> roles) => HasRole(actor, roles)
        ? Id(actor.FindFirstValue(ClaimTypes.NameIdentifier)) : throw new UnauthorizedAccessException("Không có quyền thao tác phân bổ.");
    private sealed record Receipt(string Hash, MrxHistoricalPurposeDetail Result);
}
