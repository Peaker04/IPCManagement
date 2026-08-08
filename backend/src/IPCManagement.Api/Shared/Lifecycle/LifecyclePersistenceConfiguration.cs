using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Shared.Lifecycle;

internal sealed class LifecycleTransitionConfiguration : IEntityTypeConfiguration<LifecycleTransition>
{
    public void Configure(EntityTypeBuilder<LifecycleTransition> entity)
    {
        entity.HasKey(item => item.TransitionId).HasName("PRIMARY");
        entity.ToTable("lifecycletransitions");
        entity.HasIndex(item => new { item.AggregateType, item.AggregateId, item.AggregateSequence }, "uqLifecycleTransitionsAggregateSequence").IsUnique();
        entity.HasIndex(item => item.CommandId, "uqLifecycleTransitionsCommand").IsUnique();
        entity.HasIndex(item => new { item.CreatedAt, item.TransitionId }, "ixLifecycleTransitionsCreatedAt");

        entity.Property(item => item.TransitionId).HasMaxLength(16).IsFixedLength().HasColumnName("transitionId");
        entity.Property(item => item.AggregateType).HasMaxLength(80).HasColumnName("aggregateType");
        entity.Property(item => item.AggregateId).HasMaxLength(16).IsFixedLength().HasColumnName("aggregateId");
        entity.Property(item => item.CommandId).HasMaxLength(100).HasColumnName("commandId");
        entity.Property(item => item.AggregateSequence).HasColumnName("aggregateSequence");
        entity.Property(item => item.FromState).HasMaxLength(60).HasColumnName("fromState");
        entity.Property(item => item.ToState).HasMaxLength(60).HasColumnName("toState");
        entity.Property(item => item.ActorId).HasMaxLength(16).IsFixedLength().HasColumnName("actorId");
        entity.Property(item => item.ExpectedVersion).HasColumnName("expectedVersion");
        entity.Property(item => item.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(item => item.CorrelationId).HasMaxLength(120).HasColumnName("correlationId");
        entity.Property(item => item.CausationId).HasMaxLength(120).HasColumnName("causationId");
        entity.Property(item => item.PayloadJson).HasColumnType("longtext").HasColumnName("payloadJson");
        entity.Property(item => item.SchemaVersion).HasDefaultValue(1).HasColumnName("schemaVersion");
        entity.Property(item => item.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
    }
}

internal sealed class LifecycleOutboxMessageConfiguration : IEntityTypeConfiguration<LifecycleOutboxMessage>
{
    public void Configure(EntityTypeBuilder<LifecycleOutboxMessage> entity)
    {
        entity.HasKey(item => item.OutboxMessageId).HasName("PRIMARY");
        entity.ToTable("lifecycleoutboxmessages", table => table.HasCheckConstraint("ckLifecycleOutboxStatus", "`status` IN ('PENDING','PROCESSING','PROCESSED','FAILED','POISON')"));
        entity.HasIndex(item => new { item.Status, item.NextAttemptAt, item.CreatedAt }, "ixLifecycleOutboxPending");
        entity.HasIndex(item => item.CommandId, "uqLifecycleOutboxCommand").IsUnique();
        entity.HasIndex(item => new { item.AggregateType, item.AggregateId, item.AggregateSequence }, "ixLifecycleOutboxAggregate");

        entity.Property(item => item.OutboxMessageId).HasMaxLength(16).IsFixedLength().HasColumnName("outboxMessageId");
        entity.Property(item => item.EventType).HasMaxLength(120).HasColumnName("eventType");
        entity.Property(item => item.AggregateType).HasMaxLength(80).HasColumnName("aggregateType");
        entity.Property(item => item.AggregateId).HasMaxLength(16).IsFixedLength().HasColumnName("aggregateId");
        entity.Property(item => item.AggregateSequence).HasColumnName("aggregateSequence");
        entity.Property(item => item.CommandId).HasMaxLength(100).HasColumnName("commandId");
        entity.Property(item => item.PayloadJson).HasColumnType("longtext").HasColumnName("payloadJson");
        entity.Property(item => item.Status).HasMaxLength(20).HasDefaultValue("PENDING").HasColumnName("status");
        entity.Property(item => item.AttemptCount).HasDefaultValue(0).HasColumnName("attemptCount");
        entity.Property(item => item.NextAttemptAt).HasColumnType("datetime").HasColumnName("nextAttemptAt");
        entity.Property(item => item.LockedAt).HasColumnType("datetime").HasColumnName("lockedAt");
        entity.Property(item => item.ProcessedAt).HasColumnType("datetime").HasColumnName("processedAt");
        entity.Property(item => item.LastError).HasColumnType("text").HasColumnName("lastError");
        entity.Property(item => item.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
    }
}

internal sealed class LifecycleCommandReceiptConfiguration : IEntityTypeConfiguration<LifecycleCommandReceipt>
{
    public void Configure(EntityTypeBuilder<LifecycleCommandReceipt> entity)
    {
        entity.HasKey(item => item.CommandReceiptId).HasName("PRIMARY");
        entity.ToTable("lifecyclecommandreceipts");
        entity.HasIndex(item => new { item.CommandId, item.AggregateType, item.AggregateId }, "uqLifecycleCommandReceiptsCommand").IsUnique();
        entity.HasIndex(item => item.CreatedAt, "ixLifecycleCommandReceiptsCreatedAt");

        entity.Property(item => item.CommandReceiptId).HasMaxLength(16).IsFixedLength().HasColumnName("commandReceiptId");
        entity.Property(item => item.CommandId).HasMaxLength(100).HasColumnName("commandId");
        entity.Property(item => item.AggregateType).HasMaxLength(80).HasColumnName("aggregateType");
        entity.Property(item => item.AggregateId).HasMaxLength(16).IsFixedLength().HasColumnName("aggregateId");
        entity.Property(item => item.ResponseJson).HasColumnType("longtext").HasColumnName("responseJson");
        entity.Property(item => item.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
    }
}
