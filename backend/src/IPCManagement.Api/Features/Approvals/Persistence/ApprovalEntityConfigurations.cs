using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Approvals.Persistence;

internal sealed class ApprovalHistoryConfiguration : IEntityTypeConfiguration<ApprovalHistory>
{
    public void Configure(EntityTypeBuilder<ApprovalHistory> entity)
    {
        entity.HasKey(e => e.ApprovalHistoryId).HasName("PRIMARY");
        entity.ToTable("approvalhistories");
        entity.HasIndex(e => new { e.TargetType, e.TargetId, e.ActionAt }, "ixApprovalHistoriesTarget");

        entity.Property(e => e.ApprovalHistoryId).HasMaxLength(16).IsFixedLength().HasColumnName("approvalHistoryId");
        entity.Property(e => e.ActionAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("actionAt");
        entity.Property(e => e.ActionBy).HasMaxLength(16).IsFixedLength().HasColumnName("actionBy");
        entity.Property(e => e.Decision).HasMaxLength(20).HasColumnName("decision");
        entity.Property(e => e.NewStatus).HasMaxLength(50).HasColumnName("newStatus");
        entity.Property(e => e.OldStatus).HasMaxLength(50).HasColumnName("oldStatus");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(e => e.TargetId).HasMaxLength(16).IsFixedLength().HasColumnName("targetId");
        entity.Property(e => e.TargetType).HasMaxLength(50).HasColumnName("targetType");

        entity.HasOne(d => d.ActionByNavigation).WithMany()
            .HasForeignKey(d => d.ActionBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("approvalhistories_ibfk_1");
    }
}

internal sealed class ApprovalRuleConfiguration : IEntityTypeConfiguration<ApprovalRule>
{
    public void Configure(EntityTypeBuilder<ApprovalRule> entity)
    {
        entity.HasKey(e => e.RuleId).HasName("PRIMARY");
        entity.ToTable("approvalrules");

        entity.Property(e => e.RuleId).HasMaxLength(16).IsFixedLength().HasColumnName("ruleId");
        entity.Property(e => e.RuleName).HasMaxLength(200).HasColumnName("ruleName");
        entity.Property(e => e.DocumentType).HasMaxLength(50).HasColumnName("documentType");
        entity.Property(e => e.MinAmount).HasPrecision(18, 2).HasColumnName("minAmount");
        entity.Property(e => e.MaxAmount).HasPrecision(18, 2).HasColumnName("maxAmount");
        entity.Property(e => e.SlaHours).HasColumnName("slaHours");
        entity.Property(e => e.IsActive).HasColumnName("isActive").HasDefaultValue(true);
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
    }
}

internal sealed class ApprovalAssignmentConfiguration : IEntityTypeConfiguration<ApprovalAssignment>
{
    public void Configure(EntityTypeBuilder<ApprovalAssignment> entity)
    {
        entity.HasKey(e => e.AssignmentId).HasName("PRIMARY");
        entity.ToTable("approvalassignments");

        entity.Property(e => e.AssignmentId).HasMaxLength(16).IsFixedLength().HasColumnName("assignmentId");
        entity.Property(e => e.RuleId).HasMaxLength(16).IsFixedLength().HasColumnName("ruleId");
        entity.Property(e => e.Sequence).HasColumnName("sequence");
        entity.Property(e => e.ApproverRole).HasMaxLength(50).HasColumnName("approverRole");
        entity.Property(e => e.ApproverUserId).HasMaxLength(16).IsFixedLength().HasColumnName("approverUserId");
        entity.Property(e => e.IsRequired).HasColumnName("isRequired").HasDefaultValue(true);

        entity.HasOne(d => d.Rule).WithMany(p => p.Approvalassignments)
            .HasForeignKey(d => d.RuleId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("approvalassignments_ibfk_1");

        entity.HasOne(d => d.ApproverUser).WithMany()
            .HasForeignKey(d => d.ApproverUserId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("approvalassignments_ibfk_2");
    }
}
