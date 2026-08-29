using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Infrastructure.Lifecycle;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

public sealed class LegacyLineageDispositionService : ILegacyLineageDispositionService
{
    private const string IssueLineType = "ISSUE_LINE";
    private const string ReturnLineType = "RETURN_LINE";
    private const string PendingManagerReview = "PENDING_MANAGER_REVIEW";
    private const string Approved = "APPROVED";
    private const string Rejected = "REJECTED";
    private const string Applied = "APPLIED";

    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly ILifecycleTransitionRecorder _lifecycleRecorder;

    public LegacyLineageDispositionService(IpcManagementContext context)
        : this(context, new EfTransactionRunner(context), new LifecycleTransitionRecorder(context))
    {
    }

    public LegacyLineageDispositionService(
        IpcManagementContext context,
        IEfTransactionRunner transactionRunner,
        ILifecycleTransitionRecorder lifecycleRecorder)
    {
        _context = context;
        _transactionRunner = transactionRunner;
        _lifecycleRecorder = lifecycleRecorder;
    }

    public async Task<IReadOnlyList<LegacyLineageDispositionDto>> GetAsync(
        string? status = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Legacylinedispositions.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = NormalizeStatus(status);
            query = query.Where(item => item.Status == normalizedStatus);
        }

        var items = await query
            .OrderBy(item => item.Status)
            .ThenByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);
        return items.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<LegacyLineageCandidateDto>> GetCandidatesAsync(
        string legacyLineType,
        string legacyLineId,
        CancellationToken cancellationToken = default)
    {
        var type = NormalizeLegacyLineType(legacyLineType);
        var lineId = ParseId(legacyLineId, "Dòng chứng từ legacy không hợp lệ.");
        return type == IssueLineType
            ? await GetIssueLineCandidatesAsync(lineId, cancellationToken)
            : await GetReturnLineCandidatesAsync(lineId, cancellationToken);
    }

    public async Task<LegacyLineageDispositionDto> CreateAsync(
        CreateLegacyLineageDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var actorId = ParseId(actorUserId, "Không xác định được Admin tạo đối soát.");
        var type = NormalizeLegacyLineType(request.LegacyLineType);
        var legacyLineId = ParseId(request.LegacyLineId, "Dòng chứng từ legacy không hợp lệ.");
        var targetLineId = ParseId(request.TargetLineId, "Dòng nguồn được chọn không hợp lệ.");
        var commandId = NormalizeCommandId(request.CommandId);
        var reason = RequireReason(request.Reason, "Cần lý do đối soát provenance legacy.");
        var aggregateType = BuildAggregateType(type);

        var replay = await ReadReplayAsync(commandId, aggregateType, legacyLineId, cancellationToken);
        if (replay is not null)
        {
            return replay;
        }

        return await _transactionRunner.ExecuteAsync(
            async token =>
            {
                var active = await _context.Legacylinedispositions
                    .SingleOrDefaultAsync(item =>
                        item.LegacyLineType == type &&
                        item.LegacyLineId.SequenceEqual(legacyLineId) &&
                        (item.Status == PendingManagerReview || item.Status == Approved), token);
                if (active is not null)
                {
                    throw new BusinessRuleException("Dòng legacy này đã có proposal đối soát đang mở.");
                }

                await ValidateLegacySourceAndTargetAsync(type, legacyLineId, targetLineId, token);
                var disposition = new LegacyLineageDisposition
                {
                    DispositionId = GuidHelper.NewId(),
                    LegacyLineType = type,
                    LegacyLineId = legacyLineId,
                    TargetMaterialRequestLineId = type == IssueLineType ? targetLineId : null,
                    TargetIssueLineId = type == ReturnLineType ? targetLineId : null,
                    Status = PendingManagerReview,
                    Reason = reason,
                    CreatedBy = actorId,
                    CreatedAt = DateTime.UtcNow,
                    Version = 0,
                };
                _context.Legacylinedispositions.Add(disposition);
                var result = Map(disposition);
                _lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    aggregateType, legacyLineId, commandId, 0, null, PendingManagerReview, actorId, 0,
                    reason, commandId, null, Serialize(result), Serialize(result)));
                await _context.SaveChangesAsync(token);
                return result;
            },
            async token => await _lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, legacyLineId, token) is not null,
            IsolationLevel.Serializable,
            cancellationToken);
    }

    public async Task<LegacyLineageDispositionDto> ReviewAsync(
        string dispositionId,
        ReviewLegacyLineageDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var disposition = await LoadForCommandAsync(dispositionId, cancellationToken);
        var aggregateType = BuildAggregateType(disposition.LegacyLineType);
        var commandId = NormalizeCommandId(request.CommandId);
        var replay = await ReadReplayAsync(commandId, aggregateType, disposition.LegacyLineId, cancellationToken);
        if (replay is not null)
        {
            return replay;
        }

        var actorId = ParseId(actorUserId, "Không xác định được Manager duyệt đối soát.");
        var reviewReason = RequireReason(request.Reason, "Manager cần nêu lý do duyệt hoặc từ chối đối soát.");
        return await _transactionRunner.ExecuteAsync(
            async token =>
            {
                var tracked = await LoadTrackedAsync(disposition.DispositionId, token);
                EnsureExpectedVersion(tracked, request.ExpectedVersion);
                if (tracked.Status != PendingManagerReview)
                {
                    throw new BusinessRuleException("Chỉ proposal chờ Manager mới được duyệt hoặc từ chối.");
                }
                if (tracked.CreatedBy.SequenceEqual(actorId))
                {
                    throw new BusinessRuleException("Người tạo proposal không được tự duyệt đối soát lineage.");
                }
                await EnsureManagerAsync(actorId, token);

                var nextStatus = request.Approve ? Approved : Rejected;
                tracked.Status = nextStatus;
                tracked.ReviewReason = reviewReason;
                tracked.ReviewedBy = actorId;
                tracked.ReviewedAt = DateTime.UtcNow;
                tracked.Version++;
                var result = Map(tracked);
                _lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    aggregateType, tracked.LegacyLineId, commandId, checked((int)tracked.Version), PendingManagerReview, nextStatus,
                    actorId, request.ExpectedVersion, reviewReason, commandId, null, Serialize(result), Serialize(result)));
                await _context.SaveChangesAsync(token);
                return result;
            },
            async token => await _lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, disposition.LegacyLineId, token) is not null,
            IsolationLevel.Serializable,
            cancellationToken);
    }

    public async Task<LegacyLineageDispositionDto> ApplyAsync(
        string dispositionId,
        ApplyLegacyLineageDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var disposition = await LoadForCommandAsync(dispositionId, cancellationToken);
        var aggregateType = BuildAggregateType(disposition.LegacyLineType);
        var commandId = NormalizeCommandId(request.CommandId);
        var replay = await ReadReplayAsync(commandId, aggregateType, disposition.LegacyLineId, cancellationToken);
        if (replay is not null)
        {
            return replay;
        }

        var actorId = ParseId(actorUserId, "Không xác định được Admin áp dụng đối soát.");
        var applyReason = RequireReason(request.Reason, "Cần lý do áp dụng provenance đã duyệt.");
        return await _transactionRunner.ExecuteAsync(
            async token =>
            {
                var tracked = await LoadTrackedAsync(disposition.DispositionId, token);
                EnsureExpectedVersion(tracked, request.ExpectedVersion);
                if (tracked.Status != Approved)
                {
                    throw new BusinessRuleException("Chỉ proposal đã được Manager duyệt mới được áp dụng.");
                }
                await EnsureAdminAsync(actorId, token);
                await ApplyProvenanceAsync(tracked, token);

                tracked.Status = Applied;
                tracked.AppliedBy = actorId;
                tracked.AppliedAt = DateTime.UtcNow;
                tracked.Version++;
                var result = Map(tracked);
                _lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                    aggregateType, tracked.LegacyLineId, commandId, checked((int)tracked.Version), Approved, Applied,
                    actorId, request.ExpectedVersion, applyReason, commandId, null, Serialize(result), Serialize(result)));
                await _context.SaveChangesAsync(token);
                return result;
            },
            async token => await _lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, disposition.LegacyLineId, token) is not null,
            IsolationLevel.Serializable,
            cancellationToken);
    }

    private async Task<IReadOnlyList<LegacyLineageCandidateDto>> GetIssueLineCandidatesAsync(byte[] legacyLineId, CancellationToken cancellationToken)
    {
        var source = await _context.Inventoryissuelines
            .SingleOrDefaultAsync(item => item.IssueLineId.SequenceEqual(legacyLineId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy dòng xuất kho legacy.");
        if (source.MaterialRequestLineId is not null || source.ReconciliationBatchLineId is not null)
        {
            throw new BusinessRuleException("Dòng xuất kho này đã có source lineage.");
        }

        var issue = await _context.Inventoryissues.AsNoTracking()
            .SingleOrDefaultAsync(item => item.IssueId.SequenceEqual(source.IssueId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy phiếu xuất kho của dòng legacy.");
        if (issue.MaterialRequestId is null || issue.ReconciliationBatchId is not null)
        {
            throw new BusinessRuleException("Đối soát lineage legacy chỉ áp dụng cho phiếu xuất thuộc đúng nguồn DEFAULT.");
        }
        var targets = await _context.Materialrequestlines.AsNoTracking()
            .Where(item => item.RequestId.SequenceEqual(issue.MaterialRequestId) &&
                item.IngredientId.SequenceEqual(source.IngredientId) && item.UnitId.SequenceEqual(source.UnitId))
            .OrderBy(item => item.RequestLineId)
            .ToListAsync(cancellationToken);
        return targets.Select(item => new LegacyLineageCandidateDto
        {
            LegacyLineType = IssueLineType,
            LegacyLineId = GuidHelper.ToGuidString(legacyLineId),
            TargetLineId = GuidHelper.ToGuidString(item.RequestLineId),
            DocumentCode = issue.IssueCode,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            UnitId = GuidHelper.ToGuidString(item.UnitId),
        }).ToList();
    }

    private async Task<IReadOnlyList<LegacyLineageCandidateDto>> GetReturnLineCandidatesAsync(byte[] legacyLineId, CancellationToken cancellationToken)
    {
        var source = await _context.Inventoryreturnlines
            .SingleOrDefaultAsync(item => item.ReturnLineId.SequenceEqual(legacyLineId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy dòng trả kho legacy.");
        if (source.SourceIssueLineId is not null)
        {
            throw new BusinessRuleException("Dòng trả kho này đã có source issue-line.");
        }

        var returnDocument = await _context.Inventoryreturns.AsNoTracking()
            .SingleOrDefaultAsync(item => item.ReturnId.SequenceEqual(source.ReturnId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy phiếu trả kho của dòng legacy.");
        var targets = await _context.Inventoryissuelines.AsNoTracking()
            .Where(item => item.IssueId.SequenceEqual(returnDocument.IssueId) &&
                item.IngredientId.SequenceEqual(source.IngredientId) && item.UnitId.SequenceEqual(source.UnitId))
            .OrderBy(item => item.IssueLineId)
            .ToListAsync(cancellationToken);
        return targets.Select(item => new LegacyLineageCandidateDto
        {
            LegacyLineType = ReturnLineType,
            LegacyLineId = GuidHelper.ToGuidString(legacyLineId),
            TargetLineId = GuidHelper.ToGuidString(item.IssueLineId),
            DocumentCode = returnDocument.ReturnCode,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            UnitId = GuidHelper.ToGuidString(item.UnitId),
        }).ToList();
    }

    private async Task ValidateLegacySourceAndTargetAsync(string type, byte[] legacyLineId, byte[] targetLineId, CancellationToken cancellationToken)
    {
        var candidates = await GetCandidatesAsync(type, GuidHelper.ToGuidString(legacyLineId), cancellationToken);
        if (!candidates.Any(item => GuidHelper.ParseGuidString(item.TargetLineId)!.SequenceEqual(targetLineId)))
        {
            throw new BusinessRuleException("Dòng nguồn được chọn không thuộc cùng chứng từ, ingredient và unit với dòng legacy.");
        }
    }

    private async Task ApplyProvenanceAsync(LegacyLineageDisposition disposition, CancellationToken cancellationToken)
    {
        if (disposition.LegacyLineType == IssueLineType)
        {
            var source = await _context.Inventoryissuelines
                .SingleOrDefaultAsync(item => item.IssueLineId.SequenceEqual(disposition.LegacyLineId), cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy dòng xuất kho legacy khi áp dụng.");
            if (source.MaterialRequestLineId is not null || source.ReconciliationBatchLineId is not null)
            {
                throw new BusinessRuleException("Dòng xuất kho đã có provenance; không được ghi đè.");
            }
            await ValidateLegacySourceAndTargetAsync(IssueLineType, source.IssueLineId, disposition.TargetMaterialRequestLineId!, cancellationToken);
            source.MaterialRequestLineId = disposition.TargetMaterialRequestLineId;
            return;
        }

        var returnSource = await _context.Inventoryreturnlines
            .SingleOrDefaultAsync(item => item.ReturnLineId.SequenceEqual(disposition.LegacyLineId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy dòng trả kho legacy khi áp dụng.");
        if (returnSource.SourceIssueLineId is not null)
        {
            throw new BusinessRuleException("Dòng trả kho đã có provenance; không được ghi đè.");
        }
        await ValidateLegacySourceAndTargetAsync(ReturnLineType, returnSource.ReturnLineId, disposition.TargetIssueLineId!, cancellationToken);
        returnSource.SourceIssueLineId = disposition.TargetIssueLineId;
    }

    private async Task EnsureManagerAsync(byte[] actorId, CancellationToken cancellationToken)
    {
        var roleName = await ResolveActorRoleNameAsync(actorId, cancellationToken);
        if (!AuthorizationPolicies.MatchesManagerRole(roleName))
        {
            throw new UnauthorizedAccessException("Chỉ Manager được duyệt đối soát lineage legacy.");
        }
    }

    private async Task EnsureAdminAsync(byte[] actorId, CancellationToken cancellationToken)
    {
        var roleName = await ResolveActorRoleNameAsync(actorId, cancellationToken);
        if (!AuthorizationPolicies.IsAdminRole(roleName))
        {
            throw new UnauthorizedAccessException("Chỉ Admin được áp dụng provenance legacy đã duyệt.");
        }
    }

    private async Task<LegacyLineageDisposition> LoadForCommandAsync(string dispositionId, CancellationToken cancellationToken)
    {
        var id = ParseId(dispositionId, "Disposition lineage không hợp lệ.");
        return await _context.Legacylinedispositions.AsNoTracking()
            .SingleOrDefaultAsync(item => item.DispositionId.SequenceEqual(id), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy disposition lineage legacy.");
    }

    private async Task<string?> ResolveActorRoleNameAsync(byte[] actorId, CancellationToken cancellationToken)
    {
        var actor = await _context.Users.AsNoTracking()
            .SingleOrDefaultAsync(item => item.UserId.SequenceEqual(actorId), cancellationToken);
        if (actor is null)
        {
            return null;
        }

        return await _context.Roles.AsNoTracking()
            .Where(item => item.RoleId.SequenceEqual(actor.RoleId))
            .Select(item => item.RoleName)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private async Task<LegacyLineageDisposition> LoadTrackedAsync(byte[] dispositionId, CancellationToken cancellationToken)
        => await _context.Legacylinedispositions
            .SingleOrDefaultAsync(item => item.DispositionId.SequenceEqual(dispositionId), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy disposition lineage legacy.");

    private async Task<LegacyLineageDispositionDto?> ReadReplayAsync(string commandId, string aggregateType, byte[] legacyLineId, CancellationToken cancellationToken)
    {
        var receipt = await _lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, legacyLineId, cancellationToken);
        return receipt is null ? null : JsonSerializer.Deserialize<LegacyLineageDispositionDto>(receipt.ResponseJson)
            ?? throw new InvalidOperationException("Lifecycle command receipt không thể đọc lại kết quả disposition.");
    }

    private static LegacyLineageDispositionDto Map(LegacyLineageDisposition item)
        => new()
        {
            DispositionId = GuidHelper.ToGuidString(item.DispositionId),
            LegacyLineType = item.LegacyLineType,
            LegacyLineId = GuidHelper.ToGuidString(item.LegacyLineId),
            TargetMaterialRequestLineId = item.TargetMaterialRequestLineId is null ? null : GuidHelper.ToGuidString(item.TargetMaterialRequestLineId),
            TargetIssueLineId = item.TargetIssueLineId is null ? null : GuidHelper.ToGuidString(item.TargetIssueLineId),
            Status = item.Status,
            Reason = item.Reason,
            ReviewReason = item.ReviewReason,
            CreatedBy = GuidHelper.ToGuidString(item.CreatedBy),
            CreatedAt = item.CreatedAt,
            ReviewedBy = item.ReviewedBy is null ? null : GuidHelper.ToGuidString(item.ReviewedBy),
            ReviewedAt = item.ReviewedAt,
            AppliedBy = item.AppliedBy is null ? null : GuidHelper.ToGuidString(item.AppliedBy),
            AppliedAt = item.AppliedAt,
            Version = item.Version,
        };

    private static string NormalizeLegacyLineType(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return normalized is IssueLineType or ReturnLineType
            ? normalized
            : throw new ArgumentException("LegacyLineType chỉ nhận ISSUE_LINE hoặc RETURN_LINE.");
    }

    private static string NormalizeStatus(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return normalized is PendingManagerReview or Approved or Rejected or Applied
            ? normalized
            : throw new ArgumentException("Status disposition không hợp lệ.");
    }

    private static string BuildAggregateType(string legacyLineType) => $"LegacyLineageDisposition:{legacyLineType}";
    private static string NormalizeCommandId(string? value) => RequireReason(value, "CommandId không được để trống.");
    private static string RequireReason(string? value, string message)
        => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 1000 ? value.Trim() : throw new ArgumentException(message);
    private static byte[] ParseId(string? value, string message) => GuidHelper.ParseGuidString(value) ?? throw new ArgumentException(message);
    private static string Serialize(LegacyLineageDispositionDto value) => JsonSerializer.Serialize(value);

    private static void EnsureExpectedVersion(LegacyLineageDisposition disposition, long expectedVersion)
    {
        if (expectedVersion != disposition.Version)
        {
            throw new DbUpdateConcurrencyException("Disposition lineage đã thay đổi; hãy tải lại trạng thái hiện hành.");
        }
    }
}
