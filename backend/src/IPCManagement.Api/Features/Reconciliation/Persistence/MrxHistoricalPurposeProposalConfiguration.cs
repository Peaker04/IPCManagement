using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Reconciliation.Persistence;

internal sealed class MrxHistoricalPurposeProposalConfiguration : IEntityTypeConfiguration<MrxHistoricalPurposeProposal>
{
    public void Configure(EntityTypeBuilder<MrxHistoricalPurposeProposal> entity)
    {
        entity.ToTable("mrxhistoricalpurposeproposals");
        entity.HasKey(x => x.ProposalId);
        ReconciliationMapping.Id(entity.Property(x => x.ProposalId));
        ReconciliationMapping.Id(entity.Property(x => x.BatchId));
        ReconciliationMapping.Id(entity.Property(x => x.IssueLineId));
        ReconciliationMapping.Id(entity.Property(x => x.CreatedBy));
        entity.Property(x => x.Status).HasMaxLength(16);
        entity.Property(x => x.Reason).HasMaxLength(2000);
        entity.Property(x => x.DecisionReason).HasMaxLength(2000);
        entity.Property(x => x.UnallocatedQuantity).HasPrecision(18, 6);
        entity.HasIndex(x => new { x.IssueLineId, x.Status });
        entity.HasIndex(x => new { x.BatchId, x.ServiceDate, x.Status });
        entity.HasIndex(x => new { x.Status, x.CreatedAt, x.ProposalId });
        entity.HasOne(x => x.Batch).WithMany().HasForeignKey(x => x.BatchId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.IssueLine).WithMany().HasForeignKey(x => x.IssueLineId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne(x => x.CreatedByUser).WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
