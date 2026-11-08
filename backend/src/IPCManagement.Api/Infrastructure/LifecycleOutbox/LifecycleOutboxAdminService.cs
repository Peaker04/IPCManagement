using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Infrastructure.LifecycleOutbox;

public sealed record LifecycleOutboxMessageDto(
    string OutboxMessageId,
    string EventType,
    string AggregateType,
    string AggregateId,
    int AggregateSequence,
    string Status,
    int AttemptCount,
    DateTime? NextAttemptAt,
    DateTime? LockedAt,
    DateTime? ProcessedAt,
    string? LastError,
    DateTime CreatedAt);

public sealed record ReplayLifecycleOutboxRequest(string Reason);

public interface ILifecycleOutboxAdminService
{
    Task<IReadOnlyList<LifecycleOutboxMessageDto>> GetAsync(string? status, int limit, CancellationToken cancellationToken);
    Task<LifecycleOutboxMessageDto> ReplayAsync(string messageId, string actorUserId, string reason, CancellationToken cancellationToken);
}

public sealed class LifecycleOutboxAdminService(
    IpcManagementContext context,
    IEfTransactionRunner transactionRunner) : ILifecycleOutboxAdminService
{
    private static readonly string[] ReplayableStatuses = ["FAILED", "POISON"];

    public async Task<IReadOnlyList<LifecycleOutboxMessageDto>> GetAsync(
        string? status,
        int limit,
        CancellationToken cancellationToken)
    {
        var normalizedStatus = string.IsNullOrWhiteSpace(status) ? null : status.Trim().ToUpperInvariant();
        var query = context.Lifecycleoutboxmessages.AsNoTracking();
        if (normalizedStatus is not null)
        {
            query = query.Where(message => message.Status == normalizedStatus);
        }

        var messages = await query
            .OrderByDescending(message => message.CreatedAt)
            .Take(Math.Clamp(limit, 1, 200))
            .ToListAsync(cancellationToken);
        return messages.Select(ToDto).ToArray();
    }

    public async Task<LifecycleOutboxMessageDto> ReplayAsync(
        string messageId,
        string actorUserId,
        string reason,
        CancellationToken cancellationToken)
    {
        var id = GuidHelper.ParseGuidString(messageId)
            ?? throw new ArgumentException("Mã outbox message không hợp lệ.");
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new UnauthorizedAccessException("Không xác định được Admin.");
        var normalizedReason = reason?.Trim();
        if (string.IsNullOrWhiteSpace(normalizedReason))
        {
            throw new ArgumentException("Replay outbox bắt buộc có lý do.");
        }

        return await transactionRunner.ExecuteAsync(async token =>
        {
            var message = await context.Lifecycleoutboxmessages
                .SingleOrDefaultAsync(item => item.OutboxMessageId.SequenceEqual(id), token)
                ?? throw new KeyNotFoundException("Không tìm thấy outbox message.");
            if (!ReplayableStatuses.Contains(message.Status))
            {
                throw new InvalidOperationException("Chỉ FAILED hoặc POISON message mới được replay.");
            }

            var oldStatus = message.Status;
            message.Status = "PENDING";
            message.AttemptCount = 0;
            message.NextAttemptAt = null;
            message.LockedAt = null;
            message.ProcessedAt = null;
            message.LastError = null;
            context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow,
                ChangedBy = actorId,
                BusinessArea = "Lifecycle",
                EntityName = nameof(LifecycleOutboxMessage),
                EntityId = message.OutboxMessageId,
                FieldName = "Replay",
                OldValue = oldStatus,
                NewValue = "PENDING",
                Reason = normalizedReason
            });
            await context.SaveChangesAsync(token);
            return ToDto(message);
        }, async token => await context.Lifecycleoutboxmessages.AsNoTracking().AnyAsync(message =>
            message.OutboxMessageId.SequenceEqual(id) && message.Status == "PENDING", token),
        cancellationToken: cancellationToken);
    }

    private static LifecycleOutboxMessageDto ToDto(LifecycleOutboxMessage message) => new(
        GuidHelper.ToGuidString(message.OutboxMessageId),
        message.EventType,
        message.AggregateType,
        GuidHelper.ToGuidString(message.AggregateId),
        message.AggregateSequence,
        message.Status,
        message.AttemptCount,
        message.NextAttemptAt,
        message.LockedAt,
        message.ProcessedAt,
        message.LastError,
        message.CreatedAt);
}
