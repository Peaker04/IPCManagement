using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Infrastructure.Lifecycle;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class DataQualityDispositionService(
    IpcManagementContext context,
    IEfTransactionRunner transactionRunner,
    ILifecycleTransitionRecorder lifecycleRecorder) : IDataQualityDispositionService
{
    private const string Pending = "PENDING_MANAGER_REVIEW";
    private const string Approved = "APPROVED";
    private const string Rejected = "REJECTED";
    private const string Blocked = "BLOCKED_BUSINESS";
    private const string Applied = "APPLIED";

    public async Task<IReadOnlyList<DataQualityDispositionDto>> GetAsync(
        string? status,
        CancellationToken cancellationToken = default)
    {
        var query = context.Dataqualitydispositions.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToUpperInvariant();
            if (normalized is not (Pending or Approved or Rejected or Blocked or Applied))
                throw new ArgumentException("Status data-quality disposition không hợp lệ.");
            query = query.Where(item => item.Status == normalized);
        }

        return (await query.OrderBy(item => item.Status).ThenByDescending(item => item.CreatedAt).ToListAsync(cancellationToken))
            .Select(Map)
            .ToArray();
    }

    public async Task<DataQualityDispositionDto> CreateAsync(
        CreateDataQualityDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var actorId = ParseId(actorUserId, "Không xác định được Admin tạo disposition.");
        await EnsureAdminAsync(actorId, cancellationToken);
        var issueType = DataQualityDispositionPolicy.NormalizeIssueType(request.IssueType);
        var sourceId = ParseId(request.SourceEntityId, "SourceEntityId không hợp lệ.");
        var fingerprint = DataQualityDispositionPolicy.NormalizeFingerprint(request.SourceFingerprint);
        var proposedAction = DataQualityDispositionPolicy.RequireText(request.ProposedAction, 80, "ProposedAction không hợp lệ.");
        var evidenceJson = DataQualityDispositionPolicy.RequireJson(request.EvidenceJson);
        var reason = DataQualityDispositionPolicy.RequireText(request.Reason, 1000, "Cần lý do tạo disposition.");
        var commandId = DataQualityDispositionPolicy.RequireText(request.CommandId, 100, "CommandId không hợp lệ.");
        var aggregateType = AggregateType(issueType, fingerprint);

        var replay = await ReadReplayAsync(commandId, aggregateType, sourceId, cancellationToken);
        if (replay is not null) return replay;

        return await transactionRunner.ExecuteAsync(async token =>
        {
            await EnsureSourceExistsAsync(issueType, sourceId, token);
            if (await context.Dataqualitydispositions.AnyAsync(item =>
                    item.IssueType == issueType && item.SourceEntityId.SequenceEqual(sourceId) &&
                    item.SourceFingerprint == fingerprint, token))
                throw new BusinessRuleException("Source/fingerprint này đã có disposition.");

            var item = new DataQualityDisposition
            {
                DispositionId = GuidHelper.NewId(),
                IssueType = issueType,
                SourceEntityId = sourceId,
                SourceFingerprint = fingerprint,
                ProposedAction = proposedAction,
                EvidenceJson = evidenceJson,
                Status = Pending,
                Reason = reason,
                CreatedBy = actorId,
                CreatedAt = DateTime.UtcNow,
                Version = 0
            };
            context.Dataqualitydispositions.Add(item);
            var dto = Map(item);
            lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                aggregateType, sourceId, commandId, 0, null, Pending, actorId, 0,
                reason, commandId, null, JsonSerializer.Serialize(dto), JsonSerializer.Serialize(dto)));
            await context.SaveChangesAsync(token);
            return dto;
        }, async token => await lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, sourceId, token) is not null,
        IsolationLevel.Serializable, cancellationToken);
    }

    public async Task<DataQualityDispositionDto> ReviewAsync(
        string dispositionId,
        ReviewDataQualityDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var id = ParseId(dispositionId, "Disposition không hợp lệ.");
        var actorId = ParseId(actorUserId, "Không xác định được Manager review.");
        await EnsureManagerAsync(actorId, cancellationToken);
        var snapshot = await LoadAsync(id, true, cancellationToken);
        var commandId = DataQualityDispositionPolicy.RequireText(request.CommandId, 100, "CommandId không hợp lệ.");
        var reason = DataQualityDispositionPolicy.RequireText(request.Reason, 1000, "Manager phải nêu lý do review.");
        var decision = request.Decision.Trim().ToUpperInvariant();
        var nextStatus = decision switch
        {
            "APPROVE" => Approved,
            "REJECT" => Rejected,
            "BLOCK" => Blocked,
            _ => throw new ArgumentException("Decision chỉ nhận APPROVE, REJECT hoặc BLOCK.")
        };
        var aggregateType = AggregateType(snapshot.IssueType, snapshot.SourceFingerprint);
        var replay = await ReadReplayAsync(commandId, aggregateType, snapshot.SourceEntityId, cancellationToken);
        if (replay is not null) return replay;

        return await transactionRunner.ExecuteAsync(async token =>
        {
            var item = await LoadAsync(id, false, token);
            EnsureVersion(item, request.ExpectedVersion);
            if (item.Status != Pending) throw new BusinessRuleException("Chỉ disposition chờ Manager mới được review.");
            if (item.CreatedBy.SequenceEqual(actorId)) throw new BusinessRuleException("Người tạo không được tự review disposition.");
            item.Status = nextStatus;
            item.ReviewReason = reason;
            item.ReviewedBy = actorId;
            item.ReviewedAt = DateTime.UtcNow;
            item.Version++;
            var dto = Map(item);
            lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                aggregateType, item.SourceEntityId, commandId, 1, Pending, nextStatus, actorId,
                request.ExpectedVersion, reason, commandId, null, JsonSerializer.Serialize(dto), JsonSerializer.Serialize(dto)));
            await context.SaveChangesAsync(token);
            return dto;
        }, async token => await lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, snapshot.SourceEntityId, token) is not null,
        IsolationLevel.Serializable, cancellationToken);
    }

    public async Task<DataQualityDispositionDto> ApplyAsync(
        string dispositionId,
        ApplyDataQualityDispositionRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var id = ParseId(dispositionId, "Disposition không hợp lệ.");
        var actorId = ParseId(actorUserId, "Không xác định được Admin apply.");
        await EnsureAdminAsync(actorId, cancellationToken);
        var snapshot = await LoadAsync(id, true, cancellationToken);
        var correctionId = ParseId(request.CorrectionEntityId, "CorrectionEntityId không hợp lệ.");
        var correctionType = DataQualityDispositionPolicy.RequireText(request.CorrectionEntityType, 80, "CorrectionEntityType không hợp lệ.");
        var reason = DataQualityDispositionPolicy.RequireText(request.Reason, 1000, "Cần lý do apply disposition.");
        var commandId = DataQualityDispositionPolicy.RequireText(request.CommandId, 100, "CommandId không hợp lệ.");
        var aggregateType = AggregateType(snapshot.IssueType, snapshot.SourceFingerprint);
        var replay = await ReadReplayAsync(commandId, aggregateType, snapshot.SourceEntityId, cancellationToken);
        if (replay is not null) return replay;

        return await transactionRunner.ExecuteAsync(async token =>
        {
            var item = await LoadAsync(id, false, token);
            EnsureVersion(item, request.ExpectedVersion);
            if (item.Status != Approved) throw new BusinessRuleException("Chỉ disposition APPROVED mới được apply.");
            await EnsureAppendOnlyCorrectionAsync(item, correctionType, correctionId, token);
            item.Status = Applied;
            item.CorrectionEntityType = correctionType;
            item.CorrectionEntityId = correctionId;
            item.AppliedBy = actorId;
            item.AppliedAt = DateTime.UtcNow;
            item.Version++;
            var dto = Map(item);
            lifecycleRecorder.Stage(new LifecycleTransitionRequest(
                aggregateType, item.SourceEntityId, commandId, 2, Approved, Applied, actorId,
                request.ExpectedVersion, reason, commandId, null, JsonSerializer.Serialize(dto), JsonSerializer.Serialize(dto)));
            await context.SaveChangesAsync(token);
            return dto;
        }, async token => await lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, snapshot.SourceEntityId, token) is not null,
        IsolationLevel.Serializable, cancellationToken);
    }

    private async Task EnsureSourceExistsAsync(string issueType, byte[] id, CancellationToken token)
    {
        var exists = issueType switch
        {
            "STOCK_MOVEMENT_BALANCE" => await context.Stockmovements.AnyAsync(item => item.MovementId.SequenceEqual(id), token),
            "MENU_WEEK_MISMATCH" => await context.Menuschedules.AnyAsync(item => item.MenuScheduleId.SequenceEqual(id), token),
            "UNIT_NORMALIZATION" => await context.Unitnormalizationreviews.AnyAsync(item => item.ReviewId.SequenceEqual(id), token),
            "QUOTATION_GAP" or "DUPLICATE_INGREDIENT" => await context.Ingredients.AnyAsync(item => item.IngredientId.SequenceEqual(id), token),
            "BOM_GAP" => await context.Dishes.AnyAsync(item => item.DishId.SequenceEqual(id), token),
            _ => false
        };
        if (!exists) throw new KeyNotFoundException("Không tìm thấy source entity của data-quality issue.");
    }

    private async Task EnsureAppendOnlyCorrectionAsync(
        DataQualityDisposition item,
        string correctionType,
        byte[] correctionId,
        CancellationToken token)
    {
        var valid = item.IssueType switch
        {
            "STOCK_MOVEMENT_BALANCE" when correctionType == nameof(StockMovement) =>
                await context.Stockmovements.AnyAsync(movement =>
                    movement.MovementId.SequenceEqual(correctionId) &&
                    !movement.MovementId.SequenceEqual(item.SourceEntityId) &&
                    (movement.MovementType == "ADJUSTMENT" || movement.MovementType == "RECEIPT_CORRECTION"), token),
            "MENU_WEEK_MISMATCH" when correctionType == nameof(MenuAmendment) =>
                await context.Menuamendments.AnyAsync(amendment => amendment.MenuAmendmentId.SequenceEqual(correctionId) && amendment.Status == "EXECUTED", token),
            "UNIT_NORMALIZATION" when correctionType == nameof(UnitNormalizationReview) =>
                await context.Unitnormalizationreviews.AnyAsync(review =>
                    review.ReviewId.SequenceEqual(correctionId) &&
                    (review.Status == "CONFIRMED" || review.Status == "RETAIN_DISTINCT"), token),
            _ => false
        };
        if (!valid)
            throw new BusinessRuleException("Correction append-only chưa tồn tại hoặc không phù hợp issue type; không được đánh dấu APPLIED.");
    }

    private async Task EnsureAdminAsync(byte[] actorId, CancellationToken token)
    {
        if (!AuthorizationPolicies.IsAdminRole(await ResolveRoleAsync(actorId, token)))
            throw new UnauthorizedAccessException("Chỉ Admin được tạo/apply data-quality disposition.");
    }

    private async Task EnsureManagerAsync(byte[] actorId, CancellationToken token)
    {
        if (!AuthorizationPolicies.MatchesManagerRole(await ResolveRoleAsync(actorId, token)))
            throw new UnauthorizedAccessException("Chỉ Manager được review data-quality disposition.");
    }

    private async Task<string?> ResolveRoleAsync(byte[] actorId, CancellationToken token)
    {
        var roleId = await context.Users.AsNoTracking().Where(user => user.UserId.SequenceEqual(actorId))
            .Select(user => user.RoleId).SingleOrDefaultAsync(token);
        return roleId is null ? null : await context.Roles.AsNoTracking()
            .Where(role => role.RoleId.SequenceEqual(roleId)).Select(role => role.RoleName).SingleOrDefaultAsync(token);
    }

    private async Task<DataQualityDisposition> LoadAsync(byte[] id, bool noTracking, CancellationToken token)
    {
        var query = noTracking ? context.Dataqualitydispositions.AsNoTracking() : context.Dataqualitydispositions.AsQueryable();
        return await query.SingleOrDefaultAsync(item => item.DispositionId.SequenceEqual(id), token)
            ?? throw new KeyNotFoundException("Không tìm thấy data-quality disposition.");
    }

    private async Task<DataQualityDispositionDto?> ReadReplayAsync(string commandId, string aggregateType, byte[] sourceId, CancellationToken token)
    {
        var receipt = await lifecycleRecorder.FindExistingCommandAsync(commandId, aggregateType, sourceId, token);
        return receipt is null ? null : JsonSerializer.Deserialize<DataQualityDispositionDto>(receipt.ResponseJson)
            ?? throw new InvalidOperationException("Không đọc được command receipt của disposition.");
    }

    private static string AggregateType(string issueType, string fingerprint) => $"DataQuality:{issueType}:{fingerprint[..8]}";
    private static byte[] ParseId(string? value, string message) => GuidHelper.ParseGuidString(value) ?? throw new ArgumentException(message);
    private static void EnsureVersion(DataQualityDisposition item, long expected)
    {
        if (item.Version != expected) throw new DbUpdateConcurrencyException("Disposition đã thay đổi; hãy tải lại.");
    }

    private static DataQualityDispositionDto Map(DataQualityDisposition item) => new(
        GuidHelper.ToGuidString(item.DispositionId), item.IssueType, GuidHelper.ToGuidString(item.SourceEntityId),
        item.SourceFingerprint, item.ProposedAction, item.EvidenceJson, item.Status, item.Reason, item.ReviewReason,
        GuidHelper.ToGuidString(item.CreatedBy), item.CreatedAt,
        item.ReviewedBy is null ? null : GuidHelper.ToGuidString(item.ReviewedBy), item.ReviewedAt,
        item.AppliedBy is null ? null : GuidHelper.ToGuidString(item.AppliedBy), item.AppliedAt,
        item.CorrectionEntityType, item.CorrectionEntityId is null ? null : GuidHelper.ToGuidString(item.CorrectionEntityId), item.Version);
}
