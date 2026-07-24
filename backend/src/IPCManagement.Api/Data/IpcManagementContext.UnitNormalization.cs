using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data;

public partial class IpcManagementContext
{
    public virtual DbSet<Unitnormalizationreview> Unitnormalizationreviews { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Unitnormalizationreview>(entity =>
        {
            entity.HasKey(item => item.ReviewId).HasName("PRIMARY");
            entity.ToTable("unitnormalizationreviews");

            entity.HasIndex(
                    item => new { item.IngredientId, item.SourceUnitId, item.CatalogUnitId },
                    "uq_unitnormalizationreviews_pair")
                .IsUnique();
            entity.HasIndex(item => item.Status, "idx_unitnormalizationreviews_status");
            entity.HasIndex(item => item.ReviewedBy, "fk_unitnormalizationreviews_reviewer");

            entity.Property(item => item.ReviewId).HasColumnName("reviewId").HasColumnType("binary(16)");
            entity.Property(item => item.IngredientId).HasColumnName("ingredientId").HasColumnType("binary(16)");
            entity.Property(item => item.SourceUnitId).HasColumnName("sourceUnitId").HasColumnType("binary(16)");
            entity.Property(item => item.CatalogUnitId).HasColumnName("catalogUnitId").HasColumnType("binary(16)");
            entity.Property(item => item.RecommendedUnitId).HasColumnName("recommendedUnitId").HasColumnType("binary(16)");
            entity.Property(item => item.ObservedStockQty).HasColumnName("observedStockQty").HasPrecision(18, 6);
            entity.Property(item => item.SourceReceiptCount).HasColumnName("sourceReceiptCount");
            entity.Property(item => item.CatalogReceiptCount).HasColumnName("catalogReceiptCount");
            entity.Property(item => item.BomLineCount).HasColumnName("bomLineCount");
            entity.Property(item => item.ProposedSourceToCatalogFactor)
                .HasColumnName("proposedSourceToCatalogFactor")
                .HasPrecision(18, 6);
            entity.Property(item => item.Confidence).HasColumnName("confidence").HasMaxLength(20);
            entity.Property(item => item.Status).HasColumnName("status").HasMaxLength(30);
            entity.Property(item => item.EvidenceSource).HasColumnName("evidenceSource").HasMaxLength(500);
            entity.Property(item => item.EvidenceNote).HasColumnName("evidenceNote").HasColumnType("text");
            entity.Property(item => item.CreatedAt).HasColumnName("createdAt").HasColumnType("datetime");
            entity.Property(item => item.UpdatedAt).HasColumnName("updatedAt").HasColumnType("datetime");
            entity.Property(item => item.ReviewedAt).HasColumnName("reviewedAt").HasColumnType("datetime");
            entity.Property(item => item.ReviewedBy).HasColumnName("reviewedBy").HasColumnType("binary(16)");

            entity.HasOne(item => item.Ingredient)
                .WithMany()
                .HasForeignKey(item => item.IngredientId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_unitnormalizationreviews_ingredient");
            entity.HasOne(item => item.SourceUnit)
                .WithMany()
                .HasForeignKey(item => item.SourceUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_unitnormalizationreviews_sourceunit");
            entity.HasOne(item => item.CatalogUnit)
                .WithMany()
                .HasForeignKey(item => item.CatalogUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_unitnormalizationreviews_catalogunit");
            entity.HasOne(item => item.RecommendedUnit)
                .WithMany()
                .HasForeignKey(item => item.RecommendedUnitId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_unitnormalizationreviews_recommendedunit");
            entity.HasOne(item => item.Reviewer)
                .WithMany()
                .HasForeignKey(item => item.ReviewedBy)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("fk_unitnormalizationreviews_reviewer");
        });
    }
}
