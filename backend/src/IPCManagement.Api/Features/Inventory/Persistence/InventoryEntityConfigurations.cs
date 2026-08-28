using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Inventory.Persistence;

internal sealed class InventoryAllocationDispositionConfiguration : IEntityTypeConfiguration<InventoryAllocationDisposition>
{
    public void Configure(EntityTypeBuilder<InventoryAllocationDisposition> entity)
    {
        entity.HasKey(item => item.AllocationDispositionId).HasName("PRIMARY");
        entity.ToTable("inventoryallocationdispositions");
        entity.HasIndex(item => item.SourceIssueLineId, "ixInventoryAllocationDispositionsSource");
        entity.HasIndex(item => item.DestinationIssueLineId, "ixInventoryAllocationDispositionsDestination");
        entity.Property(item => item.AllocationDispositionId).HasMaxLength(16).IsFixedLength().HasColumnName("allocationDispositionId");
        entity.Property(item => item.SourceIssueLineId).HasMaxLength(16).IsFixedLength().HasColumnName("sourceIssueLineId");
        entity.Property(item => item.DestinationIssueLineId).HasMaxLength(16).IsFixedLength().HasColumnName("destinationIssueLineId");
        entity.Property(item => item.Quantity).HasPrecision(18, 6).HasColumnName("quantity");
        entity.Property(item => item.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.Version).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("version");
        entity.Property(item => item.CorrelationId).HasMaxLength(128).HasColumnName("correlationId");
        entity.Property(item => item.CausationId).HasMaxLength(128).HasColumnName("causationId");
        entity.HasOne<InventoryIssueLine>().WithMany().HasForeignKey(item => item.SourceIssueLineId).OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryallocationdispositions_ibfk_1");
        entity.HasOne<InventoryIssueLine>().WithMany().HasForeignKey(item => item.DestinationIssueLineId).OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryallocationdispositions_ibfk_2");
        entity.HasOne<User>().WithMany().HasForeignKey(item => item.CreatedBy).OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryallocationdispositions_ibfk_3");
    }
}

internal sealed class InventoryIssueConfiguration : IEntityTypeConfiguration<InventoryIssue>
{
    public void Configure(EntityTypeBuilder<InventoryIssue> entity)
    {
        entity.HasKey(e => e.IssueId).HasName("PRIMARY");

        entity.ToTable("inventoryissues", table => table.HasCheckConstraint(
            "ckInventoryIssuesSourceFamily",
            "(`materialRequestId` IS NOT NULL AND `reconciliationBatchId` IS NULL) OR (`materialRequestId` IS NULL AND `reconciliationBatchId` IS NOT NULL)"));

        entity.HasIndex(e => e.IssueCode, "issueCode").IsUnique();

        entity.HasIndex(e => e.IssuedBy, "issuedBy");

        entity.HasIndex(e => e.MaterialRequestId, "materialRequestId");

        entity.HasIndex(e => e.ReconciliationBatchId, "ixInventoryIssuesReconciliationBatch");

        entity.HasIndex(e => e.ReceivedBy, "receivedBy");

        entity.HasIndex(e => e.WarehouseId, "warehouseId");

        entity.Property(e => e.IssueId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("issueId");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.IssueCode)
            .HasMaxLength(50)
            .HasColumnName("issueCode");
        entity.Property(e => e.IssueDate).HasColumnName("issueDate");
        entity.Property(e => e.IssuedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("issuedBy");
        entity.Property(e => e.MaterialRequestId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("materialRequestId");
        entity.Property(e => e.ReconciliationBatchId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("reconciliationBatchId");
        entity.Property(e => e.ReceivedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receivedBy");
        entity.Property(e => e.ReceivedAt)
            .HasColumnType("datetime")
            .HasColumnName("receivedAt");
        entity.Property(e => e.ShiftName)
            .HasColumnType("enum('MORNING','AFTERNOON')")
            .HasColumnName("shiftName");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");

        entity.HasOne(d => d.IssuedByNavigation).WithMany(p => p.InventoryissueIssuedByNavigations)
            .HasForeignKey(d => d.IssuedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryissues_ibfk_3");

        entity.HasOne(d => d.MaterialRequest).WithMany(p => p.Inventoryissues)
            .HasForeignKey(d => d.MaterialRequestId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryissues_ibfk_2");

        entity.HasOne(d => d.ReconciliationBatch).WithMany()
            .HasForeignKey(d => d.ReconciliationBatchId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryissues_ibfk_5");

        entity.HasOne(d => d.ReceivedByNavigation).WithMany(p => p.InventoryissueReceivedByNavigations)
            .HasForeignKey(d => d.ReceivedBy)
            .HasConstraintName("inventoryissues_ibfk_4");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryissues)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryissues_ibfk_1");
    }
}

internal sealed class InventoryIssueLineConfiguration : IEntityTypeConfiguration<InventoryIssueLine>
{
    public void Configure(EntityTypeBuilder<InventoryIssueLine> entity)
    {
        entity.HasKey(e => e.IssueLineId).HasName("PRIMARY");

        entity.ToTable("inventoryissuelines", table => table.HasCheckConstraint(
            "ckInventoryIssueLinesSourceFamily",
            "(`materialRequestLineId` IS NOT NULL AND `reconciliationBatchLineId` IS NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NOT NULL) OR (`materialRequestLineId` IS NULL AND `reconciliationBatchLineId` IS NULL)"));

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId1");

        entity.HasIndex(e => e.IssueId, "issueId");

        entity.HasIndex(e => e.MaterialRequestLineId, "ixInventoryIssueLinesMaterialRequestLine");

        entity.HasIndex(e => e.ReconciliationBatchLineId, "uxInventoryIssueLinesReconciliationBatchLine").IsUnique();

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId2");

        entity.Property(e => e.IssueLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("issueLineId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.IssueId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("issueId");
        entity.Property(e => e.MaterialRequestLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("materialRequestLineId");
        entity.Property(e => e.ReconciliationBatchLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("reconciliationBatchLineId");
        entity.Property(e => e.IssuedQty)
            .HasPrecision(18, 6)
            .HasColumnName("issuedQty");
        entity.Property(e => e.RequestedQty)
            .HasPrecision(18, 6)
            .HasColumnName("requestedQty");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryissuelines)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryissuelines_ibfk_2");

        entity.HasOne(d => d.Issue).WithMany(p => p.Inventoryissuelines)
            .HasForeignKey(d => d.IssueId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryissuelines_ibfk_1");

        entity.HasOne(d => d.MaterialRequestLine).WithMany(p => p.Inventoryissuelines)
            .HasForeignKey(d => d.MaterialRequestLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryissuelines_ibfk_4");

        entity.HasOne(d => d.ReconciliationBatchLine).WithMany()
            .HasForeignKey(d => d.ReconciliationBatchLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryissuelines_ibfk_5");

        entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryissuelines)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryissuelines_ibfk_3");
    }
}

internal sealed class SupplementalMaterialRequestConfiguration : IEntityTypeConfiguration<SupplementalMaterialRequest>
{
    public void Configure(EntityTypeBuilder<SupplementalMaterialRequest> entity)
    {
        entity.HasKey(e => e.RequestId).HasName("PRIMARY");
        entity.ToTable("supplementalmaterialrequests");
        entity.HasIndex(e => e.RequestCode).IsUnique();
        entity.HasIndex(e => new { e.WarehouseId, e.Status, e.RequestedAt });
        entity.HasIndex(e => e.IssueId);
        entity.HasIndex(e => e.IssueLineId);
        entity.Property<byte[]?>("OpenIssueLineId")
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnType("binary(16)")
            .HasColumnName("openIssueLineId")
            .HasComputedColumnSql("CASE WHEN `status` IN ('REJECTED', 'FULFILLED') THEN NULL ELSE `issueLineId` END", stored: false);
        entity.HasIndex("OpenIssueLineId")
            .IsUnique()
            .HasDatabaseName("uxSupplementalMaterialRequestsOpenIssueLine");

        entity.Property(e => e.RequestId).HasMaxLength(16).IsFixedLength().HasColumnName("requestId");
        entity.Property(e => e.RequestCode).HasMaxLength(50).HasColumnName("requestCode");
        entity.Property(e => e.IssueId).HasMaxLength(16).IsFixedLength().HasColumnName("issueId");
        entity.Property(e => e.IssueLineId).HasMaxLength(16).IsFixedLength().HasColumnName("issueLineId");
        entity.Property(e => e.WarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("warehouseId");
        entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.RequestedQty).HasPrecision(18, 6).HasColumnName("requestedQty");
        entity.Property(e => e.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.Property(e => e.Status).HasMaxLength(24).HasColumnName("status");
        entity.Property(e => e.RequestedBy).HasMaxLength(16).IsFixedLength().HasColumnName("requestedBy");
        entity.Property(e => e.RequestedAt).HasColumnType("datetime").HasColumnName("requestedAt");

        entity.HasOne<InventoryIssue>().WithMany().HasForeignKey(e => e.IssueId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<InventoryIssueLine>().WithMany().HasForeignKey(e => e.IssueLineId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<Warehouse>().WithMany().HasForeignKey(e => e.WarehouseId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<Ingredient>().WithMany().HasForeignKey(e => e.IngredientId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<Unit>().WithMany().HasForeignKey(e => e.UnitId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<User>().WithMany().HasForeignKey(e => e.RequestedBy).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class InventoryReceiptConfiguration : IEntityTypeConfiguration<InventoryReceipt>
{
    public void Configure(EntityTypeBuilder<InventoryReceipt> entity)
    {
        entity.HasKey(e => e.ReceiptId).HasName("PRIMARY");

        entity.ToTable("inventoryreceipts");

        entity.HasIndex(e => e.CreatedBy, "createdBy");

        entity.HasIndex(e => e.PurchaseRequestId, "purchaseRequestId");
        entity.HasIndex(e => e.PurchaseOrderId, "ixInventoryReceiptsPurchaseOrder");

        entity.HasIndex(e => e.ReceiptCode, "receiptCode").IsUnique();

        entity.HasIndex(e => e.SupplierId, "supplierId");

        entity.HasIndex(e => e.WarehouseId, "warehouseId");
        entity.HasIndex(e => new { e.Status, e.QualityStatus, e.CreatedAt }, "ixInventoryReceiptsLifecycle");

        entity.Property(e => e.ReceiptId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receiptId");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.CreatedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("createdBy");
        entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue("DRAFT").HasColumnName("status");
        entity.Property(e => e.QualityStatus).HasMaxLength(30).HasDefaultValue("PENDING_INSPECTION").HasColumnName("qualityStatus");
        entity.Property(e => e.QualityCheckedBy).HasMaxLength(16).IsFixedLength().HasColumnName("qualityCheckedBy");
        entity.Property(e => e.QualityCheckedAt).HasColumnType("datetime").HasColumnName("qualityCheckedAt");
        entity.Property(e => e.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(0L).HasColumnName("concurrencyVersion");
        entity.Property(e => e.ManagerApprovedBy).HasMaxLength(16).IsFixedLength().HasColumnName("managerApprovedBy");
        entity.Property(e => e.ManagerApprovedAt).HasColumnType("datetime").HasColumnName("managerApprovedAt");
        entity.Property(e => e.ManagerApprovalReason).HasColumnType("text").HasColumnName("managerApprovalReason");
        entity.Property(e => e.PostedBy).HasMaxLength(16).IsFixedLength().HasColumnName("postedBy");
        entity.Property(e => e.PostedAt).HasColumnType("datetime").HasColumnName("postedAt");
        entity.Property(e => e.RejectedBy).HasMaxLength(16).IsFixedLength().HasColumnName("rejectedBy");
        entity.Property(e => e.RejectedAt).HasColumnType("datetime").HasColumnName("rejectedAt");
        entity.Property(e => e.RejectionReason).HasColumnType("text").HasColumnName("rejectionReason");
        entity.Property(e => e.PurchaseRequestId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestId");
        entity.Property(e => e.PurchaseOrderId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderId");
        entity.Property(e => e.ReceiptCode)
            .HasMaxLength(50)
            .HasColumnName("receiptCode");
        entity.Property(e => e.ReceiptDate).HasColumnName("receiptDate");
        entity.Property(e => e.SupplierId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("supplierId");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");

        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Inventoryreceipts)
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceipts_ibfk_4");

        entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Inventoryreceipts)
            .HasForeignKey(d => d.PurchaseRequestId)
            .HasConstraintName("inventoryreceipts_ibfk_3");

        entity.HasOne(d => d.Supplier).WithMany(p => p.Inventoryreceipts)
            .HasForeignKey(d => d.SupplierId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceipts_ibfk_2");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryreceipts)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceipts_ibfk_1");
    }
}

internal sealed class InventoryReceiptLineConfiguration : IEntityTypeConfiguration<InventoryReceiptLine>
{
    public void Configure(EntityTypeBuilder<InventoryReceiptLine> entity)
    {
        entity.HasKey(e => e.ReceiptLineId).HasName("PRIMARY");

        entity.ToTable("inventoryreceiptlines", table =>
        {
            table.HasCheckConstraint(
                "ckInventoryReceiptLinesPackageSnapshotComplete",
                "(`packageQuantitySnapshot` IS NULL AND `packageBaseUnitIdSnapshot` IS NULL AND `packagePolicyVersionSnapshot` IS NULL) OR " +
                "(`packageQuantitySnapshot` IS NOT NULL AND `packageBaseUnitIdSnapshot` IS NOT NULL AND `packagePolicyVersionSnapshot` IS NOT NULL)");
            table.HasCheckConstraint(
                "ckInventoryReceiptLinesPackageQuantityPositive",
                "`packageQuantitySnapshot` IS NULL OR `packageQuantitySnapshot` > 0");
        });

        entity.HasIndex(e => new { e.IngredientId, e.ExpiredDate, e.LotNumber }, "ixInventoryReceiptLinesExpiry");

        entity.HasIndex(e => e.PurchaseRequestLineId, "purchaseRequestLineId");

        entity.HasIndex(e => e.PurchaseOrderLineId, "ixInventoryReceiptLinesPurchaseOrderLine");

        entity.HasIndex(e => e.ReceiptId, "receiptId");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId3");

        entity.Property(e => e.ReceiptLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receiptLineId");
        entity.Property(e => e.Amount)
            .HasPrecision(18, 2)
            .HasComputedColumnSql("`quantity` * `unitPrice`", true)
            .HasColumnName("amount");
        entity.Property(e => e.AcceptedQuantity).HasPrecision(18, 6).HasColumnName("acceptedQuantity");
        entity.Property(e => e.RejectedQuantity).HasPrecision(18, 6).HasColumnName("rejectedQuantity");
        entity.Property(e => e.QualityReason).HasMaxLength(1000).HasColumnName("qualityReason");
        entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.LotNumber)
            .HasMaxLength(100)
            .HasColumnName("lotNumber");
        entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
        entity.Property(e => e.PackageBaseUnitIdSnapshot)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("packageBaseUnitIdSnapshot");
        entity.Property(e => e.PackagePolicyVersionSnapshot)
            .HasMaxLength(100)
            .HasColumnName("packagePolicyVersionSnapshot");
        entity.Property(e => e.PackageQuantitySnapshot)
            .HasPrecision(18, 6)
            .HasColumnName("packageQuantitySnapshot");
        entity.Property(e => e.Quantity)
            .HasPrecision(18, 6)
            .HasColumnName("quantity");
        entity.Property(e => e.PurchaseRequestLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestLineId");
        entity.Property(e => e.PurchaseOrderLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderLineId");
        entity.Property(e => e.ReceiptId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receiptId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.UnitPrice)
            .HasPrecision(18, 2)
            .HasColumnName("unitPrice");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryreceiptlines)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceiptlines_ibfk_2");

        entity.HasOne(d => d.Receipt).WithMany(p => p.Inventoryreceiptlines)
            .HasForeignKey(d => d.ReceiptId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceiptlines_ibfk_1");

        entity.HasOne(d => d.PurchaseRequestLine).WithMany(p => p.Inventoryreceiptlines)
            .HasForeignKey(d => d.PurchaseRequestLineId)
            .HasConstraintName("inventoryreceiptlines_ibfk_4");

        entity.HasOne<PurchaseOrderLine>().WithMany()
            .HasForeignKey(d => d.PurchaseOrderLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryreceiptlines_ibfk_6");

        entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryreceiptlines)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreceiptlines_ibfk_3");

        entity.HasOne(d => d.PackageBaseUnitSnapshot).WithMany()
            .HasForeignKey(d => d.PackageBaseUnitIdSnapshot)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryreceiptlines_ibfk_5");
    }
}

internal sealed class ReceiptCorrectionConfiguration : IEntityTypeConfiguration<ReceiptCorrection>
{
    public void Configure(EntityTypeBuilder<ReceiptCorrection> entity)
    {
        entity.HasKey(item => item.CorrectionId).HasName("PRIMARY");
        entity.ToTable("receiptcorrections", table =>
            table.HasCheckConstraint("ckReceiptCorrectionsStatus", "`status` = 'POSTED'"));
        entity.HasIndex(item => item.CorrectionCode, "uqReceiptCorrectionsCode").IsUnique();
        entity.HasIndex(item => item.CommandId, "uqReceiptCorrectionsCommand").IsUnique();
        entity.HasIndex(item => item.ReceiptId, "ixReceiptCorrectionsReceipt");

        entity.Property(item => item.CorrectionId).HasMaxLength(16).IsFixedLength().HasColumnName("correctionId");
        entity.Property(item => item.ReceiptId).HasMaxLength(16).IsFixedLength().HasColumnName("receiptId");
        entity.Property(item => item.CorrectionCode).HasMaxLength(50).HasColumnName("correctionCode");
        entity.Property(item => item.CommandId).HasMaxLength(100).HasColumnName("commandId");
        entity.Property(item => item.Status).HasMaxLength(20).HasDefaultValue("POSTED").HasColumnName("status");
        entity.Property(item => item.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.Property(item => item.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(item => item.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(item => item.ConcurrencyVersion).HasDefaultValue(1L).HasColumnName("concurrencyVersion");

        entity.HasOne<InventoryReceipt>().WithMany()
            .HasForeignKey(item => item.ReceiptId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("receiptcorrections_ibfk_1");
        entity.HasOne<User>().WithMany()
            .HasForeignKey(item => item.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("receiptcorrections_ibfk_2");
    }
}

internal sealed class PurchaseReceiptActiveLineConfiguration : IEntityTypeConfiguration<PurchaseReceiptActiveLine>
{
    public void Configure(EntityTypeBuilder<PurchaseReceiptActiveLine> entity)
    {
        entity.HasKey(item => item.PurchaseOrderLineId).HasName("PRIMARY");
        entity.ToTable("purchasereceiptactivelines");
        entity.HasIndex(item => item.ReceiptId, "ixPurchaseReceiptActiveLinesReceipt");

        entity.Property(item => item.PurchaseOrderLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderLineId");
        entity.Property(item => item.ReceiptId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receiptId");
        entity.Property(item => item.CreatedAt)
            .HasColumnType("datetime")
            .HasColumnName("createdAt");

        entity.HasOne<PurchaseOrderLine>().WithMany()
            .HasForeignKey(item => item.PurchaseOrderLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasereceiptactivelines_ibfk_1");
        entity.HasOne<InventoryReceipt>().WithMany()
            .HasForeignKey(item => item.ReceiptId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasereceiptactivelines_ibfk_2");
    }
}

internal sealed class ReceiptCorrectionLineConfiguration : IEntityTypeConfiguration<ReceiptCorrectionLine>
{
    public void Configure(EntityTypeBuilder<ReceiptCorrectionLine> entity)
    {
        entity.HasKey(item => item.CorrectionLineId).HasName("PRIMARY");
        entity.ToTable("receiptcorrectionlines", table =>
            table.HasCheckConstraint("ckReceiptCorrectionLinesQuantity", "`quantity` > 0"));
        entity.HasIndex(item => item.CorrectionId, "ixReceiptCorrectionLinesCorrection");
        entity.HasIndex(item => item.ReceiptLineId, "ixReceiptCorrectionLinesReceiptLine");

        entity.Property(item => item.CorrectionLineId).HasMaxLength(16).IsFixedLength().HasColumnName("correctionLineId");
        entity.Property(item => item.CorrectionId).HasMaxLength(16).IsFixedLength().HasColumnName("correctionId");
        entity.Property(item => item.ReceiptLineId).HasMaxLength(16).IsFixedLength().HasColumnName("receiptLineId");
        entity.Property(item => item.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(item => item.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(item => item.Quantity).HasPrecision(18, 6).HasColumnName("quantity");
        entity.Property(item => item.SourceLotNumber).HasMaxLength(100).HasColumnName("sourceLotNumber");
        entity.Property(item => item.SourceManufactureDate).HasColumnName("sourceManufactureDate");
        entity.Property(item => item.SourceExpiredDate).HasColumnName("sourceExpiredDate");

        entity.HasOne<ReceiptCorrection>().WithMany(item => item.Lines)
            .HasForeignKey(item => item.CorrectionId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("receiptcorrectionlines_ibfk_1");
        entity.HasOne<InventoryReceiptLine>().WithMany()
            .HasForeignKey(item => item.ReceiptLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("receiptcorrectionlines_ibfk_2");
        entity.HasOne<Ingredient>().WithMany()
            .HasForeignKey(item => item.IngredientId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("receiptcorrectionlines_ibfk_3");
        entity.HasOne<Unit>().WithMany()
            .HasForeignKey(item => item.UnitId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("receiptcorrectionlines_ibfk_4");
    }
}

internal sealed class InventoryReturnConfiguration : IEntityTypeConfiguration<InventoryReturn>
{
    public void Configure(EntityTypeBuilder<InventoryReturn> entity)
    {
        entity.HasKey(e => e.ReturnId).HasName("PRIMARY");

        entity.ToTable("inventoryreturns");

        entity.HasIndex(e => e.CreatedBy, "createdBy");

        entity.HasIndex(e => e.IssueId, "issueId");

        entity.HasIndex(e => e.ReturnCode, "returnCode").IsUnique();

        entity.HasIndex(e => e.WarehouseId, "warehouseId");

        entity.Property(e => e.ReturnId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("returnId");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.CreatedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("createdBy");
        entity.Property(e => e.IssueId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("issueId");
        entity.Property(e => e.Reason)
            .HasColumnType("text")
            .HasColumnName("reason");
        entity.Property(e => e.ReturnCode)
            .HasMaxLength(50)
            .HasColumnName("returnCode");
        entity.Property(e => e.ReturnDate).HasColumnName("returnDate");
        entity.Property(e => e.ReturnType)
            .HasMaxLength(20)
            .HasDefaultValue("RETURN")
            .HasColumnName("returnType");
        entity.Property(e => e.ShiftName)
            .HasColumnType("enum('MORNING','AFTERNOON')")
            .HasColumnName("shiftName");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");
        entity.Property(e => e.ReceivedAt)
            .HasColumnType("datetime")
            .HasColumnName("receivedAt");
        entity.Property(e => e.ReceivedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receivedBy");

        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Inventoryreturns)
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturns_ibfk_3");

        entity.HasOne(d => d.ReceivedByNavigation).WithMany()
            .HasForeignKey(d => d.ReceivedBy)
            .HasConstraintName("inventoryreturns_ibfk_4");

        entity.HasOne(d => d.Issue).WithMany(p => p.Inventoryreturns)
            .HasForeignKey(d => d.IssueId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturns_ibfk_2");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Inventoryreturns)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturns_ibfk_1");
    }
}

internal sealed class InventoryReturnLineConfiguration : IEntityTypeConfiguration<InventoryReturnLine>
{
    public void Configure(EntityTypeBuilder<InventoryReturnLine> entity)
    {
        entity.HasKey(e => e.ReturnLineId).HasName("PRIMARY");

        entity.ToTable("inventoryreturnlines");

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId2");

        entity.HasIndex(e => e.ReturnId, "returnId");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId4");

        entity.HasIndex(e => e.SourceIssueLineId, "ixInventoryReturnLinesSourceIssueLine");

        entity.Property(e => e.ReturnLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("returnLineId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.Quantity)
            .HasPrecision(18, 6)
            .HasColumnName("quantity");
        entity.Property(e => e.ReturnId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("returnId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.SourceIssueLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("sourceIssueLineId");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Inventoryreturnlines)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturnlines_ibfk_2");

        entity.HasOne(d => d.Return).WithMany(p => p.Inventoryreturnlines)
            .HasForeignKey(d => d.ReturnId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturnlines_ibfk_1");

        entity.HasOne(d => d.Unit).WithMany(p => p.Inventoryreturnlines)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("inventoryreturnlines_ibfk_3");

        entity.HasOne(d => d.SourceIssueLine).WithMany()
            .HasForeignKey(d => d.SourceIssueLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("inventoryreturnlines_ibfk_4");
    }
}

internal sealed class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> entity)
    {
        entity.HasKey(e => e.MovementId).HasName("PRIMARY");

        entity.ToTable("stockmovements");

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId5");

        entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.MovementDate }, "ixStockMovementsLookup");

        // Index cho báo cáo biến động NVL theo ngày
        entity.HasIndex(e => new { e.IngredientId, e.MovementDate }, "ixStockMovementsIngredientDate");

        // Index cho báo cáo theo loại giao dịch
        entity.HasIndex(e => new { e.MovementType, e.MovementDate }, "ixStockMovementsTypeDate");

        // Index cho truy vấn tham chiếu chứng từ gốc
        entity.HasIndex(e => new { e.RefTable, e.RefId }, "ixStockMovementsRef");

        entity.HasIndex(e => e.PerformedBy, "performedBy");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId7");

        entity.Property(e => e.MovementId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("movementId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.MovementDate)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("movementDate");
        entity.Property(e => e.MovementType)
            .HasColumnType("enum('RECEIPT','ISSUE','RETURN','ADJUSTMENT','RECEIPT_CORRECTION')")
            .HasColumnName("movementType");
        entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
        entity.Property(e => e.LotNumber)
            .HasMaxLength(100)
            .HasColumnName("lotNumber");
        entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
        entity.Property(e => e.Note)
            .HasColumnType("text")
            .HasColumnName("note");
        entity.Property(e => e.PerformedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("performedBy");
        entity.Property(e => e.QuantityIn)
            .HasPrecision(18, 6)
            .HasColumnName("quantityIn");
        entity.Property(e => e.QuantityOut)
            .HasPrecision(18, 6)
            .HasColumnName("quantityOut");
        entity.Property(e => e.BeforeQty)
            .HasPrecision(18, 6)
            .HasColumnName("beforeQty");
        entity.Property(e => e.AfterQty)
            .HasPrecision(18, 6)
            .HasColumnName("afterQty");
        entity.Property(e => e.Reason)
            .HasColumnType("text")
            .HasColumnName("reason");
        entity.Property(e => e.RefId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("refId");
        entity.Property(e => e.RefTable)
            .HasMaxLength(80)
            .HasColumnName("refTable");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Stockmovements)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stockmovements_ibfk_2");

        entity.HasOne(d => d.PerformedByNavigation).WithMany(p => p.Stockmovements)
            .HasForeignKey(d => d.PerformedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stockmovements_ibfk_4");

        entity.HasOne(d => d.Unit).WithMany(p => p.Stockmovements)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stockmovements_ibfk_3");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Stockmovements)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stockmovements_ibfk_1");
    }
}

internal sealed class CurrentStockLotConfiguration : IEntityTypeConfiguration<CurrentStockLot>
{
    public void Configure(EntityTypeBuilder<CurrentStockLot> entity)
    {
        entity.HasKey(e => e.LotStockId).HasName("PRIMARY");

        entity.ToTable("currentstocklots");

        entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.ExpiredDate, e.LotNumber }, "ixCurrentStockLotsFefo");

        entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.UnitId, e.LotNumber, e.ManufactureDate, e.ExpiredDate }, "ixCurrentStockLotsIdentity");

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId");

        entity.Property(e => e.LotStockId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("lotStockId");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.LotNumber)
            .HasMaxLength(100)
            .HasColumnName("lotNumber");
        entity.Property(e => e.ManufactureDate).HasColumnName("manufactureDate");
        entity.Property(e => e.ExpiredDate).HasColumnName("expiredDate");
        entity.Property(e => e.CurrentQty)
            .HasPrecision(18, 6)
            .HasDefaultValueSql("0.000000")
            .HasColumnName("currentQty");
        entity.Property(e => e.LastUpdated)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("lastUpdated");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Currentstocklots)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstocklots_ibfk_2");

        entity.HasOne(d => d.Unit).WithMany(p => p.Currentstocklots)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstocklots_ibfk_3");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Currentstocklots)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstocklots_ibfk_1");
    }
}

internal sealed class StockSnapshotConfiguration : IEntityTypeConfiguration<StockSnapshot>
{
    public void Configure(EntityTypeBuilder<StockSnapshot> entity)
    {
        entity.HasKey(e => e.SnapshotId).HasName("PRIMARY");

        entity.ToTable("stocksnapshots");

        entity.HasIndex(e => new { e.PeriodMonth, e.WarehouseId, e.IngredientId }, "ixStockSnapshotsPeriod");

        entity.HasIndex(e => new { e.WarehouseId, e.IngredientId, e.UnitId, e.PeriodMonth }, "ixStockSnapshotsIdentity")
            .IsUnique();

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId");

        entity.Property(e => e.SnapshotId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("snapshotId");
        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.PeriodMonth).HasColumnName("periodMonth");
        entity.Property(e => e.OpeningQty)
            .HasPrecision(18, 6)
            .HasDefaultValueSql("0.000000")
            .HasColumnName("openingQty");
        entity.Property(e => e.QuantityIn)
            .HasPrecision(18, 6)
            .HasDefaultValueSql("0.000000")
            .HasColumnName("quantityIn");
        entity.Property(e => e.QuantityOut)
            .HasPrecision(18, 6)
            .HasDefaultValueSql("0.000000")
            .HasColumnName("quantityOut");
        entity.Property(e => e.ClosingQty)
            .HasPrecision(18, 6)
            .HasDefaultValueSql("0.000000")
            .HasColumnName("closingQty");
        entity.Property(e => e.GeneratedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("generatedAt");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Stocksnapshots)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stocksnapshots_ibfk_2");

        entity.HasOne(d => d.Unit).WithMany(p => p.Stocksnapshots)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stocksnapshots_ibfk_3");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Stocksnapshots)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("stocksnapshots_ibfk_1");
    }
}

internal sealed class WarehouseConfiguration : IEntityTypeConfiguration<Warehouse>
{
    public void Configure(EntityTypeBuilder<Warehouse> entity)
    {
        entity.HasKey(e => e.WarehouseId).HasName("PRIMARY");

        entity.ToTable("warehouses");

        entity.HasIndex(e => e.WarehouseCode, "warehouseCode").IsUnique();

        entity.Property<int?>("OperationalSingletonKey")
            .HasColumnName("OperationalSingletonKey")
            .HasComputedColumnSql("CASE WHEN IsOperationalActive THEN 1 ELSE NULL END", stored: false);

        entity.HasIndex("OperationalSingletonKey")
            .HasDatabaseName("uqWarehousesOperationalSingleton")
            .IsUnique();

        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");
        entity.Property(e => e.Note)
            .HasColumnType("text")
            .HasColumnName("note");
        entity.Property(e => e.WarehouseCode)
            .HasMaxLength(50)
            .HasColumnName("warehouseCode");
        entity.Property(e => e.WarehouseName)
            .HasMaxLength(150)
            .HasColumnName("warehouseName");
        entity.Property(e => e.IsOperationalActive)
            .HasDefaultValue(false)
            .HasColumnName("IsOperationalActive");
        entity.Property(e => e.WarehouseType)
            .HasDefaultValueSql("'KHAC'")
            .HasColumnType("enum('PHULIEUGIAVI','TUOI','DONGLANH','KHAC')")
            .HasColumnName("warehouseType");
    }
}

internal sealed class CurrentStockConfiguration : IEntityTypeConfiguration<CurrentStock>
{
    public void Configure(EntityTypeBuilder<CurrentStock> entity)
    {
        entity.HasKey(e => new { e.WarehouseId, e.IngredientId }).HasName("PRIMARY");

        entity.ToTable("currentstock");

        entity.HasIndex(e => e.IngredientId, "ix_currentstock_ingredient");

        entity.Property(e => e.WarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("warehouseId");

        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");

        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");

        entity.Property(e => e.CurrentQty)
            .HasPrecision(18, 6)
            .HasColumnName("currentQty")
            .HasDefaultValueSql("0.000000");

        entity.Property(e => e.LastUpdated)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("lastUpdated");

        entity.Property(e => e.RowVersion)
            .IsRowVersion()
            .IsConcurrencyToken()
            .HasDefaultValueSql("CURRENT_TIMESTAMP(6)")
            .HasColumnType("timestamp(6)")
            .HasColumnName("rowVersion");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Currentstocks)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstock_ibfk_2");

        entity.HasOne(d => d.Unit).WithMany(p => p.Currentstocks)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstock_ibfk_3");

        entity.HasOne(d => d.Warehouse).WithMany(p => p.Currentstocks)
            .HasForeignKey(d => d.WarehouseId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("currentstock_ibfk_1");
    }
}

internal sealed class StocktakeConfiguration : IEntityTypeConfiguration<Stocktake>
{
    public void Configure(EntityTypeBuilder<Stocktake> entity)
    {
        entity.HasKey(e => e.StocktakeId).HasName("PRIMARY");
        entity.ToTable("stocktakes");
        entity.HasIndex(e => e.StocktakeCode, "ixStocktakeCode").IsUnique();
        entity.HasIndex(e => e.WarehouseId, "ixStocktakeWarehouse");
        entity.Property(e => e.StocktakeId).HasMaxLength(16).IsFixedLength().HasColumnName("stocktakeId");
        entity.Property(e => e.StocktakeCode).HasMaxLength(50).HasColumnName("stocktakeCode");
        entity.Property(e => e.WarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("warehouseId");
        entity.Property(e => e.Status).HasMaxLength(50).HasColumnName("status");
        entity.Property(e => e.Notes).HasMaxLength(1000).HasColumnName("notes");
        entity.Property(e => e.CreatedBy).HasMaxLength(16).IsFixedLength().HasColumnName("createdBy");
        entity.Property(e => e.CreatedAt).HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.ApprovedBy).HasMaxLength(16).IsFixedLength().HasColumnName("approvedBy");
        entity.Property(e => e.ApprovedAt).HasColumnType("datetime").HasColumnName("approvedAt");
        entity.HasOne(d => d.Warehouse).WithMany(p => p.Stocktakes).HasForeignKey(d => d.WarehouseId).OnDelete(DeleteBehavior.ClientSetNull);
        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.StocktakesCreatedByNavigations).HasForeignKey(d => d.CreatedBy).OnDelete(DeleteBehavior.ClientSetNull);
        entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.StocktakesApprovedByNavigations).HasForeignKey(d => d.ApprovedBy);
    }
}

internal sealed class StocktakeLineConfiguration : IEntityTypeConfiguration<StocktakeLine>
{
    public void Configure(EntityTypeBuilder<StocktakeLine> entity)
    {
        entity.HasKey(e => e.LineId).HasName("PRIMARY");
        entity.ToTable("stocktakelines");
        entity.HasIndex(e => e.StocktakeId, "ixStocktakelineStocktake");
        entity.HasIndex(e => e.IngredientId, "ixStocktakelineIngredient");
        entity.Property(e => e.LineId).HasMaxLength(16).IsFixedLength().HasColumnName("lineId");
        entity.Property(e => e.StocktakeId).HasMaxLength(16).IsFixedLength().HasColumnName("stocktakeId");
        entity.Property(e => e.IngredientId).HasMaxLength(16).IsFixedLength().HasColumnName("ingredientId");
        entity.Property(e => e.UnitId).HasMaxLength(16).IsFixedLength().HasColumnName("unitId");
        entity.Property(e => e.SystemQty).HasPrecision(18, 2).HasColumnName("systemQty");
        entity.Property(e => e.ActualQty).HasPrecision(18, 2).HasColumnName("actualQty");
        entity.Property(e => e.DiscrepancyQty).HasPrecision(18, 2).HasColumnName("discrepancyQty");
        entity.Property(e => e.Reason).HasMaxLength(1000).HasColumnName("reason");
        entity.HasOne(d => d.Stocktake).WithMany(p => p.Stocktakelines).HasForeignKey(d => d.StocktakeId).OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(d => d.Ingredient).WithMany(p => p.Stocktakelines).HasForeignKey(d => d.IngredientId).OnDelete(DeleteBehavior.ClientSetNull);
        entity.HasOne(d => d.Unit).WithMany().HasForeignKey(d => d.UnitId).OnDelete(DeleteBehavior.ClientSetNull);
    }
}

internal sealed class UnitNormalizationReviewConfiguration : IEntityTypeConfiguration<UnitNormalizationReview>
{
    public void Configure(EntityTypeBuilder<UnitNormalizationReview> entity)
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
    }
}
