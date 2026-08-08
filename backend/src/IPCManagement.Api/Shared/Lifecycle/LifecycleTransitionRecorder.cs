using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Shared.Lifecycle;

public sealed class LifecycleTransitionRecorder(IpcManagementContext context) : ILifecycleTransitionRecorder
{
    public Task<LifecycleCommandReceipt?> FindExistingCommandAsync(string commandId, string aggregateType, byte[] aggregateId, CancellationToken cancellationToken = default)
        => context.Lifecyclecommandreceipts.AsNoTracking()
            .SingleOrDefaultAsync(item => item.CommandId == commandId && item.AggregateType == aggregateType && item.AggregateId.SequenceEqual(aggregateId), cancellationToken);

    public LifecycleTransition Stage(LifecycleTransitionRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (string.IsNullOrWhiteSpace(request.AggregateType)) throw new ArgumentException("AggregateType không được để trống.");
        if (request.AggregateId is not { Length: 16 }) throw new ArgumentException("AggregateId không hợp lệ.");
        if (string.IsNullOrWhiteSpace(request.CommandId)) throw new ArgumentException("CommandId không được để trống.");
        if (request.AggregateSequence < 0) throw new ArgumentOutOfRangeException(nameof(request.AggregateSequence));
        if (request.ExpectedVersion < 0) throw new ArgumentOutOfRangeException(nameof(request.ExpectedVersion));
        if (string.IsNullOrWhiteSpace(request.ToState)) throw new ArgumentException("ToState không được để trống.");
        if (string.IsNullOrWhiteSpace(request.PayloadJson)) throw new ArgumentException("PayloadJson không được để trống.");
        if (string.IsNullOrWhiteSpace(request.ResponseJson)) throw new ArgumentException("ResponseJson không được để trống.");

        var now = DateTime.UtcNow;
        var transition = new LifecycleTransition
        {
            TransitionId = GuidHelper.NewId(), AggregateType = request.AggregateType.Trim(), AggregateId = request.AggregateId,
            CommandId = request.CommandId.Trim(), AggregateSequence = request.AggregateSequence, FromState = request.FromState,
            ToState = request.ToState.Trim(), ActorId = request.ActorId, ExpectedVersion = request.ExpectedVersion,
            Reason = request.Reason, CorrelationId = request.CorrelationId, CausationId = request.CausationId,
            PayloadJson = request.PayloadJson, SchemaVersion = request.SchemaVersion, CreatedAt = now
        };

        context.Lifecycletransitions.Add(transition);
        context.Lifecycleoutboxmessages.Add(new LifecycleOutboxMessage
        {
            OutboxMessageId = GuidHelper.NewId(), EventType = $"{transition.AggregateType}.Transitioned", AggregateType = transition.AggregateType,
            AggregateId = transition.AggregateId, AggregateSequence = transition.AggregateSequence, CommandId = transition.CommandId,
            PayloadJson = transition.PayloadJson, Status = "PENDING", CreatedAt = now
        });
        context.Lifecyclecommandreceipts.Add(new LifecycleCommandReceipt
        {
            CommandReceiptId = GuidHelper.NewId(), CommandId = transition.CommandId, AggregateType = transition.AggregateType,
            AggregateId = transition.AggregateId, ResponseJson = request.ResponseJson, CreatedAt = now
        });
        if (request.ActorId is not null)
        {
            context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = request.ActorId, BusinessArea = "Lifecycle",
                EntityName = transition.AggregateType, EntityId = transition.AggregateId, FieldName = "Transition",
                OldValue = transition.FromState, NewValue = transition.ToState, Reason = transition.Reason,
                CorrelationId = transition.CorrelationId
            });
        }

        return transition;
    }
}
