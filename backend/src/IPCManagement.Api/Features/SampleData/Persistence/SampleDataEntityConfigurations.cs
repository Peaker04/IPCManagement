using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.SampleData.Persistence;

internal sealed class CustomerImportMappingConfiguration : IEntityTypeConfiguration<CustomerImportMapping>
{
    public void Configure(EntityTypeBuilder<CustomerImportMapping> entity)
    {
        entity.HasKey(e => e.MappingId).HasName("PRIMARY");
        entity.ToTable("customerimportmappings");
        entity.HasIndex(e => e.CustomerId, "ixCustomerImportMappingsCustomer").IsUnique();
        entity.Property(e => e.MappingId).HasMaxLength(16).IsFixedLength().HasColumnName("mappingId");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.SheetNameHint).HasMaxLength(100).HasColumnName("sheetNameHint");
        entity.Property(e => e.LabelColumn).HasMaxLength(10).HasColumnName("labelColumn");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.HasOne(d => d.Customer).WithMany(p => p.Customerimportmappings)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("customerimportmappings_ibfk_1");
    }
}

internal sealed class PurchaseHistoryReconciliationRunConfiguration
    : IEntityTypeConfiguration<PurchaseHistoryReconciliationRun>
{
    public void Configure(EntityTypeBuilder<PurchaseHistoryReconciliationRun> entity)
    {
        entity.HasKey(e => e.PurchaseHistoryReconciliationRunId).HasName("PRIMARY");
        entity.ToTable("purchasehistoryreconciliationruns", table =>
        {
            table.HasCheckConstraint("ckPurchaseHistoryReconciliationRunsCounts",
                "`candidateCount` >= 0 AND `currentUniqueBusinessKeyCount` >= 0 AND `auditedDeltaCount` >= 0 AND " +
                "`actionCount` >= 0 AND `blockerCount` >= 0 AND `keepCount` >= 0 AND `versionCount` >= 0 AND " +
                "`deactivateCount` >= 0 AND `deleteCount` >= 0 AND `blockCount` >= 0 AND " +
                "`actionCount` = (`keepCount` + `versionCount` + `deactivateCount` + `deleteCount` + `blockCount`) AND " +
                "`blockerCount` = `blockCount`");
            table.HasCheckConstraint("ckPurchaseHistoryReconciliationRunsStatus", "`status` IN ('APPLIED', 'NOOP')");
            table.HasCheckConstraint("ckPurchaseHistoryReconciliationRunsRestoreVerified", "`restoreVerified` = 1");
        });
        entity.HasIndex(e => e.ManifestHash, "uqPurchaseHistoryReconciliationRunsManifestHash").IsUnique();
        entity.HasIndex(e => e.ManifestId, "ixPurchaseHistoryReconciliationRunsManifestId");
        entity.HasIndex(e => new { e.AppliedBy, e.AppliedAt }, "ixPurchaseHistoryReconciliationRunsActor");
        entity.Property(e => e.PurchaseHistoryReconciliationRunId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseHistoryReconciliationRunId");
        entity.Property(e => e.ManifestId).HasMaxLength(32).HasColumnName("manifestId");
        entity.Property(e => e.ManifestHash).HasMaxLength(64).IsFixedLength().HasColumnName("manifestHash");
        entity.Property(e => e.SourceName).HasMaxLength(255).HasColumnName("sourceName");
        entity.Property(e => e.SourceSha256).HasMaxLength(64).IsFixedLength().HasColumnName("sourceSha256");
        entity.Property(e => e.PolicyVersion).HasMaxLength(100).HasColumnName("policyVersion");
        entity.Property(e => e.AsOfDate).HasColumnName("asOfDate");
        entity.Property(e => e.DatabaseFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("databaseFingerprint");
        entity.Property(e => e.BackupIdentifier).HasMaxLength(255).HasColumnName("backupIdentifier");
        entity.Property(e => e.BackupTargetFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("backupTargetFingerprint");
        entity.Property(e => e.RestoreFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("restoreFingerprint");
        entity.Property(e => e.RestoreVerified).HasColumnName("restoreVerified");
        entity.Property(e => e.AppliedBy).HasMaxLength(16).IsFixedLength().HasColumnName("appliedBy");
        entity.Property(e => e.AppliedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("appliedAt");
        entity.Property(e => e.Status).HasMaxLength(20).HasColumnName("status");
        entity.Property(e => e.CandidateCount).HasColumnName("candidateCount");
        entity.Property(e => e.CurrentUniqueBusinessKeyCount).HasColumnName("currentUniqueBusinessKeyCount");
        entity.Property(e => e.AuditedDeltaCount).HasColumnName("auditedDeltaCount");
        entity.Property(e => e.ActionCount).HasColumnName("actionCount");
        entity.Property(e => e.BlockerCount).HasColumnName("blockerCount");
        entity.Property(e => e.KeepCount).HasColumnName("keepCount");
        entity.Property(e => e.VersionCount).HasColumnName("versionCount");
        entity.Property(e => e.DeactivateCount).HasColumnName("deactivateCount");
        entity.Property(e => e.DeleteCount).HasColumnName("deleteCount");
        entity.Property(e => e.BlockCount).HasColumnName("blockCount");
        entity.HasOne(d => d.AppliedByNavigation).WithMany().HasForeignKey(d => d.AppliedBy)
            .OnDelete(DeleteBehavior.Restrict).HasConstraintName("purchasehistoryreconciliationruns_ibfk_1");
    }
}

internal sealed class PurchaseHistoryReconciliationActionConfiguration
    : IEntityTypeConfiguration<PurchaseHistoryReconciliationAction>
{
    public void Configure(EntityTypeBuilder<PurchaseHistoryReconciliationAction> entity)
    {
        entity.HasKey(e => e.PurchaseHistoryReconciliationActionId).HasName("PRIMARY");
        entity.ToTable("purchasehistoryreconciliationactions", table =>
        {
            table.HasCheckConstraint("ckPurchaseHistoryReconciliationActionsDisposition",
                "`actionType` IN ('keep', 'version', 'deactivate', 'delete', 'block')");
            table.HasCheckConstraint("ckPurchaseHistoryReconciliationActionsSourceRow", "`sourceRow` IS NULL OR `sourceRow` > 0");
        });
        entity.HasIndex(e => new { e.PurchaseHistoryReconciliationRunId, e.ActionId },
            "uqPurchaseHistoryReconciliationActionsRunAction").IsUnique();
        entity.HasIndex(e => e.ActionHash, "ixPurchaseHistoryReconciliationActionsHash");
        entity.Property(e => e.PurchaseHistoryReconciliationActionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseHistoryReconciliationActionId");
        entity.Property(e => e.PurchaseHistoryReconciliationRunId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseHistoryReconciliationRunId");
        entity.Property(e => e.ActionId).HasMaxLength(32).IsFixedLength().HasColumnName("actionId");
        entity.Property(e => e.ActionType).HasMaxLength(20).HasColumnName("actionType");
        entity.Property(e => e.SourceKey).HasMaxLength(255).HasColumnName("sourceKey");
        entity.Property(e => e.SourceSheet).HasMaxLength(100).HasColumnName("sourceSheet");
        entity.Property(e => e.SourceRow).HasColumnName("sourceRow");
        entity.Property(e => e.BusinessKey).HasMaxLength(300).HasColumnName("businessKey");
        entity.Property(e => e.TargetType).HasMaxLength(100).HasColumnName("targetType");
        entity.Property(e => e.TargetId).HasMaxLength(64).HasColumnName("targetId");
        entity.Property(e => e.ReasonCode).HasMaxLength(100).HasColumnName("reasonCode");
        entity.Property(e => e.BeforeEvidence).HasColumnType("text").HasColumnName("beforeEvidence");
        entity.Property(e => e.BeforeHash).HasMaxLength(64).IsFixedLength().HasColumnName("beforeHash");
        entity.Property(e => e.AfterEvidence).HasColumnType("text").HasColumnName("afterEvidence");
        entity.Property(e => e.AfterHash).HasMaxLength(64).IsFixedLength().HasColumnName("afterHash");
        entity.Property(e => e.ActionHash).HasMaxLength(64).IsFixedLength().HasColumnName("actionHash");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.HasOne(d => d.PurchaseHistoryReconciliationRun)
            .WithMany(p => p.Purchasehistoryreconciliationactions)
            .HasForeignKey(d => d.PurchaseHistoryReconciliationRunId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("purchasehistoryreconciliationactions_ibfk_1");
    }
}
