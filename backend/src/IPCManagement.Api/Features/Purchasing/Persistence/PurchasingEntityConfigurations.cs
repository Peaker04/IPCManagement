using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Purchasing.Persistence;

internal sealed class PurchaseRequestConfiguration : IEntityTypeConfiguration<PurchaseRequest>
{
    public void Configure(EntityTypeBuilder<PurchaseRequest> entity)
    {
        entity.HasKey(e => e.PurchaseRequestId).HasName("PRIMARY");

        entity.ToTable("purchaserequests");

        entity.HasIndex(e => e.ApprovedBy, "approvedBy");

        entity.HasIndex(e => e.CreatedBy, "createdBy");

        entity.HasIndex(e => new { e.PurchaseForDate, e.Status }, "ixPurchaseRequestsDate");

        entity.HasIndex(e => e.PurchaseRequestCode, "purchaseRequestCode").IsUnique();

        entity.Property(e => e.PurchaseRequestId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestId");
        entity.Property(e => e.ApprovedAt)
            .HasColumnType("datetime")
            .HasColumnName("approvedAt");
        entity.Property(e => e.ApprovedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("approvedBy");
        entity.Property(e => e.CreatedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("createdBy");
        entity.Property(e => e.PurchaseForDate).HasColumnName("purchaseForDate");
        entity.Property(e => e.PurchaseRequestCode)
            .HasMaxLength(50)
            .HasColumnName("purchaseRequestCode");
        entity.Property(e => e.RequestDate).HasColumnName("requestDate");
        entity.Property(e => e.ShiftName)
            .HasColumnType("enum('MORNING','AFTERNOON')")
            .HasColumnName("shiftName");
        entity.Property(e => e.Status)
            .HasDefaultValueSql("'DRAFT'")
            .HasColumnType("enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','PARTIALRECEIVED','RECEIVED','CANCELLED')")
            .HasColumnName("status");

        entity.HasOne(d => d.ApprovedByNavigation).WithMany(p => p.PurchaserequestApprovedByNavigations)
            .HasForeignKey(d => d.ApprovedBy)
            .HasConstraintName("purchaserequests_ibfk_2");

        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.PurchaserequestCreatedByNavigations)
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaserequests_ibfk_1");
    }
}

internal sealed class PurchaseRequestLineConfiguration : IEntityTypeConfiguration<PurchaseRequestLine>
{
    public void Configure(EntityTypeBuilder<PurchaseRequestLine> entity)
    {
        entity.HasKey(e => e.PurchaseRequestLineId).HasName("PRIMARY");

        entity.ToTable("purchaserequestlines");

        entity.HasIndex(e => e.IngredientId, "ingredientId")
            .HasDatabaseName("ingredientId4");

        entity.HasIndex(e => e.MaterialRequestLineId, "materialRequestLineId");

        entity.HasIndex(e => e.PurchaseRequestId, "purchaseRequestId");

        entity.HasIndex(e => e.SupplierId, "supplierId");

        entity.HasIndex(e => e.UnitId, "unitId")
            .HasDatabaseName("unitId6");

        entity.Property(e => e.PurchaseRequestLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestLineId");
        entity.Property(e => e.CurrentStockQty)
            .HasPrecision(18, 6)
            .HasColumnName("currentStockQty");
        entity.Property(e => e.EstimatedUnitPrice)
            .HasPrecision(18, 2)
            .HasColumnName("estimatedUnitPrice");
        entity.Property(e => e.ExpectedDeliveryDate)
            .HasColumnType("date")
            .HasColumnName("expectedDeliveryDate");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.MaterialRequestLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("materialRequestLineId");
        entity.Property(e => e.Note)
            .HasColumnType("text")
            .HasColumnName("note");
        entity.Property(e => e.IsLegacySupplierSnapshot)
            .HasDefaultValue(false)
            .HasColumnName("isLegacySupplierSnapshot");
        entity.Property(e => e.PurchaseQty)
            .HasPrecision(18, 6)
            .HasColumnName("purchaseQty");
        entity.Property(e => e.PurchaseRequestId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestId");
        entity.Property(e => e.RequiredQty)
            .HasPrecision(18, 6)
            .HasColumnName("requiredQty");
        entity.Property(e => e.SupplierId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("supplierId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Purchaserequestlines)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaserequestlines_ibfk_3");

        entity.HasOne(d => d.MaterialRequestLine).WithMany(p => p.Purchaserequestlines)
            .HasForeignKey(d => d.MaterialRequestLineId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaserequestlines_ibfk_2");

        entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Purchaserequestlines)
            .HasForeignKey(d => d.PurchaseRequestId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaserequestlines_ibfk_1");

        entity.HasOne(d => d.Supplier).WithMany(p => p.Purchaserequestlines)
            .HasForeignKey(d => d.SupplierId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .IsRequired(false)
            .HasConstraintName("purchaserequestlines_ibfk_4");

        entity.HasOne(d => d.Unit).WithMany(p => p.Purchaserequestlines)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaserequestlines_ibfk_5");
    }
}

internal sealed class PurchaseLineSupplierDecisionConfiguration : IEntityTypeConfiguration<PurchaseLineSupplierDecision>
{
    public void Configure(EntityTypeBuilder<PurchaseLineSupplierDecision> entity)
    {
        entity.HasKey(e => e.PurchaseLineSupplierDecisionId).HasName("PRIMARY");

        entity.ToTable("purchaselinesupplierdecisions", table =>
        {
            table.HasCheckConstraint(
                "ckPurchaseLineSupplierDecisionsEvidenceComplete",
                "`evidenceType` IN ('EFFECTIVE_QUOTATION', 'LATEST_VALID_RECEIPT') AND " +
                "`evidenceReferencePrice` > 0 AND `proposedUnitPrice` > 0");
            table.HasCheckConstraint(
                "ckPurchaseLineSupplierDecisionsConfirmationComplete",
                "`confirmedBy` IS NOT NULL AND `confirmedAt` IS NOT NULL AND `version` > 0 AND `concurrencyVersion` > 0");
            table.HasCheckConstraint(
                "ckPurchaseLineSupplierDecisionsStatus",
                "`status` IN ('CURRENT', 'SUPERSEDED')");
            table.HasCheckConstraint(
                "ckPurchaseLineSupplierDecisionsCurrentKey",
                "(`status` = 'CURRENT' AND `currentDecisionKey` = `purchaseRequestLineId` AND `supersededByDecisionId` IS NULL) OR " +
                "(`status` = 'SUPERSEDED' AND `currentDecisionKey` IS NULL AND `supersededByDecisionId` IS NOT NULL)");
        });

        entity.HasIndex(e => new { e.PurchaseRequestLineId, e.Version }, "uqPurchaseLineSupplierDecisionsLineVersion").IsUnique();
        entity.HasIndex(e => new { e.PurchaseRequestLineId, e.DecisionFingerprint }, "uqPurchaseLineSupplierDecisionsLineFingerprint").IsUnique();
        entity.HasIndex(e => e.CurrentDecisionKey, "uqPurchaseLineSupplierDecisionsCurrentKey").IsUnique();
        entity.HasIndex(e => e.SupplierId, "ixPurchaseLineSupplierDecisionsSupplier");
        entity.HasIndex(e => new { e.SupplierId, e.ProposedDeliveryDate, e.ReceivingWarehouseId, e.PurchasingTerms }, "ixPurchaseLineSupplierDecisionsCompatibility");
        entity.HasIndex(e => e.ConfirmedBy, "ixPurchaseLineSupplierDecisionsConfirmer");
        entity.HasIndex(e => e.SupersededByDecisionId, "ixPurchaseLineSupplierDecisionsSupersededBy");

        entity.Property(e => e.PurchaseLineSupplierDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseLineSupplierDecisionId");
        entity.Property(e => e.PurchaseRequestLineId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseRequestLineId");
        entity.Property(e => e.SupplierId).HasMaxLength(16).IsFixedLength().HasColumnName("supplierId");
        entity.Property(e => e.EvidenceType).HasMaxLength(40).HasColumnName("evidenceType");
        entity.Property(e => e.EvidenceId).HasMaxLength(16).IsFixedLength().HasColumnName("evidenceId");
        entity.Property(e => e.EvidenceDate).HasColumnType("date").HasColumnName("evidenceDate");
        entity.Property(e => e.EvidenceReferencePrice).HasPrecision(18, 2).HasColumnName("evidenceReferencePrice");
        entity.Property(e => e.ProposedUnitPrice).HasPrecision(18, 2).HasColumnName("proposedUnitPrice");
        entity.Property(e => e.ProposedDeliveryDate).HasColumnType("date").HasColumnName("proposedDeliveryDate");
        entity.Property(e => e.ReceivingWarehouseId).HasMaxLength(16).IsFixedLength().HasColumnName("receivingWarehouseId");
        entity.Property(e => e.PurchasingTerms).HasMaxLength(500).HasColumnName("purchasingTerms");
        entity.Property(e => e.ConfirmedBy).HasMaxLength(16).IsFixedLength().HasColumnName("confirmedBy");
        entity.Property(e => e.ConfirmedAt).HasColumnType("datetime").HasColumnName("confirmedAt");
        entity.Property(e => e.DecisionFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("decisionFingerprint");
        entity.Property(e => e.Version).HasColumnName("version");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("CURRENT").HasColumnName("status");
        entity.Property(e => e.CurrentDecisionKey).HasMaxLength(16).IsFixedLength().HasColumnName("currentDecisionKey");
        entity.Property(e => e.SupersededByDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("supersededByDecisionId");
        entity.Property(e => e.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(1).HasColumnName("concurrencyVersion");

        entity.HasOne(d => d.PurchaseRequestLine).WithMany(p => p.SupplierDecisions)
            .HasForeignKey(d => d.PurchaseRequestLineId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchaselinesupplierdecisions_ibfk_1");
        entity.HasOne(d => d.Supplier).WithMany()
            .HasForeignKey(d => d.SupplierId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchaselinesupplierdecisions_ibfk_2");
        entity.HasOne(d => d.ConfirmedByNavigation).WithMany()
            .HasForeignKey(d => d.ConfirmedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchaselinesupplierdecisions_ibfk_3");
        entity.HasOne(d => d.SupersededByDecision).WithMany(p => p.SupersededDecisions)
            .HasForeignKey(d => d.SupersededByDecisionId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchaselinesupplierdecisions_ibfk_4");
    }
}

internal sealed class PurchasePriceExceptionConfiguration : IEntityTypeConfiguration<PurchasePriceException>
{
    public void Configure(EntityTypeBuilder<PurchasePriceException> entity)
    {
        entity.HasKey(e => e.PurchasePriceExceptionId).HasName("PRIMARY");

        entity.ToTable("purchasepriceexceptions", table =>
        {
            table.HasCheckConstraint(
                "ckPurchasePriceExceptionsStrictVariance",
                "`referencePrice` > 0 AND `proposedPrice` > `referencePrice` AND `variancePercent` > 15");
            table.HasCheckConstraint(
                "ckPurchasePriceExceptionsDecisionComplete",
                "(`status` = 'PENDING' AND `decidedBy` IS NULL AND `decisionReason` IS NULL AND `decidedAt` IS NULL) OR " +
                "(`status` IN ('APPROVED', 'REJECTED') AND `decidedBy` IS NOT NULL AND `decisionReason` IS NOT NULL AND `decidedAt` IS NOT NULL) OR " +
                "`status` = 'SUPERSEDED'");
            table.HasCheckConstraint(
                "ckPurchasePriceExceptionsStatus",
                "`status` IN ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')");
            table.HasCheckConstraint(
                "ckPurchasePriceExceptionsSupersession",
                "(`status` = 'SUPERSEDED' AND `supersededByExceptionId` IS NOT NULL) OR " +
                "(`status` <> 'SUPERSEDED' AND `supersededByExceptionId` IS NULL)");
        });

        entity.HasIndex(
                e => new { e.PurchaseLineSupplierDecisionId, e.ProposalFingerprint, e.ProposalVersion },
                "uqPurchasePriceExceptionsProposal")
            .IsUnique();
        entity.HasIndex(e => e.RequestedBy, "ixPurchasePriceExceptionsRequester");
        entity.HasIndex(e => e.DecidedBy, "ixPurchasePriceExceptionsDecider");
        entity.HasIndex(e => e.SupersededByExceptionId, "ixPurchasePriceExceptionsSupersededBy");

        entity.Property(e => e.PurchasePriceExceptionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchasePriceExceptionId");
        entity.Property(e => e.PurchaseLineSupplierDecisionId).HasMaxLength(16).IsFixedLength().HasColumnName("purchaseLineSupplierDecisionId");
        entity.Property(e => e.ReferencePrice).HasPrecision(18, 2).HasColumnName("referencePrice");
        entity.Property(e => e.ProposedPrice).HasPrecision(18, 2).HasColumnName("proposedPrice");
        entity.Property(e => e.VariancePercent).HasPrecision(9, 4).HasColumnName("variancePercent");
        entity.Property(e => e.EvidenceType).HasMaxLength(40).HasColumnName("evidenceType");
        entity.Property(e => e.EvidenceId).HasMaxLength(16).IsFixedLength().HasColumnName("evidenceId");
        entity.Property(e => e.EvidenceDate).HasColumnType("date").HasColumnName("evidenceDate");
        entity.Property(e => e.Reason).HasColumnType("text").HasColumnName("reason");
        entity.Property(e => e.ProposalFingerprint).HasMaxLength(64).IsFixedLength().HasColumnName("proposalFingerprint");
        entity.Property(e => e.ProposalVersion).HasColumnName("proposalVersion");
        entity.Property(e => e.RequestedBy).HasMaxLength(16).IsFixedLength().HasColumnName("requestedBy");
        entity.Property(e => e.RequestedAt).HasColumnType("datetime").HasColumnName("requestedAt");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("PENDING").HasColumnName("status");
        entity.Property(e => e.DecidedBy).HasMaxLength(16).IsFixedLength().HasColumnName("decidedBy");
        entity.Property(e => e.DecisionReason).HasColumnType("text").HasColumnName("decisionReason");
        entity.Property(e => e.DecidedAt).HasColumnType("datetime").HasColumnName("decidedAt");
        entity.Property(e => e.SupersededByExceptionId).HasMaxLength(16).IsFixedLength().HasColumnName("supersededByExceptionId");
        entity.Property(e => e.ConcurrencyVersion).IsConcurrencyToken().HasDefaultValue(1).HasColumnName("concurrencyVersion");

        entity.HasOne(d => d.PurchaseLineSupplierDecision).WithMany(p => p.Purchasepriceexceptions)
            .HasForeignKey(d => d.PurchaseLineSupplierDecisionId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasepriceexceptions_ibfk_1");
        entity.HasOne(d => d.RequestedByNavigation).WithMany()
            .HasForeignKey(d => d.RequestedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasepriceexceptions_ibfk_2");
        entity.HasOne(d => d.DecidedByNavigation).WithMany()
            .HasForeignKey(d => d.DecidedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasepriceexceptions_ibfk_3");
        entity.HasOne(d => d.SupersededByException).WithMany(p => p.SupersededExceptions)
            .HasForeignKey(d => d.SupersededByExceptionId)
            .OnDelete(DeleteBehavior.Restrict)
            .HasConstraintName("purchasepriceexceptions_ibfk_4");
    }
}

internal sealed class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> entity)
    {
        entity.HasKey(e => e.PurchaseOrderId).HasName("PRIMARY");

        entity.ToTable("purchaseorders");

        entity.HasIndex(e => e.PurchaseOrderCode, "purchaseOrderCode").IsUnique();

        entity.HasIndex(e => e.PurchaseRequestId, "ixPurchaseOrdersRequest");

        entity.HasIndex(e => e.SupplierId, "ixPurchaseOrdersSupplier");

        entity.HasIndex(e => new { e.PurchaseRequestId, e.SupplierId, e.ProposedDeliveryDate, e.ReceivingWarehouseId, e.PurchasingTerms }, "ixPurchaseOrdersCompatibility").IsUnique();


        entity.Property(e => e.PurchaseOrderId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderId");
        entity.Property(e => e.PurchaseOrderCode)
            .HasMaxLength(50)
            .HasColumnName("purchaseOrderCode");
        entity.Property(e => e.PurchaseRequestId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestId");
        entity.Property(e => e.SupplierId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("supplierId");
        entity.Property(e => e.ReceivingWarehouseId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("receivingWarehouseId");
        entity.Property(e => e.PurchasingTerms)
            .HasMaxLength(500)
            .HasColumnName("purchasingTerms");
        entity.Property(e => e.ProposedDeliveryDate)
            .HasColumnType("date")
            .HasColumnName("proposedDeliveryDate");
        entity.Property(e => e.OrderDate).HasColumnName("orderDate");
        entity.Property(e => e.Status)
            .HasMaxLength(30)
            .HasDefaultValue("ORDERED")
            .HasColumnName("status");
        entity.Property(e => e.CreatedBy)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("createdBy");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("updatedAt");

        entity.HasOne(d => d.PurchaseRequest).WithMany(p => p.Purchaseorders)
            .HasForeignKey(d => d.PurchaseRequestId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorders_ibfk_1");

        entity.HasOne(d => d.Supplier).WithMany(p => p.Purchaseorders)
            .HasForeignKey(d => d.SupplierId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorders_ibfk_2");

        entity.HasOne(d => d.CreatedByNavigation).WithMany(p => p.Purchaseorders)
            .HasForeignKey(d => d.CreatedBy)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorders_ibfk_3");
    }
}

internal sealed class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> entity)
    {
        entity.HasKey(e => e.PurchaseOrderLineId).HasName("PRIMARY");

        entity.ToTable("purchaseorderlines");

        entity.HasIndex(e => e.PurchaseOrderId, "ixPurchaseOrderLinesOrder");

        entity.HasIndex(e => e.PurchaseRequestLineId, "ixPurchaseOrderLinesRequestLine").IsUnique();

        entity.HasIndex(e => e.IngredientId, "ixPurchaseOrderLinesIngredient");

        entity.HasIndex(e => e.UnitId, "ixPurchaseOrderLinesUnit");

        entity.Property(e => e.PurchaseOrderLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderLineId");
        entity.Property(e => e.PurchaseOrderId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseOrderId");
        entity.Property(e => e.PurchaseRequestLineId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("purchaseRequestLineId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.UnitId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("unitId");
        entity.Property(e => e.OrderedQty)
            .HasPrecision(18, 6)
            .HasColumnName("orderedQty");
        entity.Property(e => e.ReceivedQty)
            .HasPrecision(18, 6)
            .HasColumnName("receivedQty");
        entity.Property(e => e.UnitPrice)
            .HasPrecision(18, 2)
            .HasColumnName("unitPrice");

        entity.HasOne(d => d.PurchaseOrder).WithMany(p => p.Purchaseorderlines)
            .HasForeignKey(d => d.PurchaseOrderId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorderlines_ibfk_1");

        entity.HasOne(d => d.PurchaseRequestLine).WithOne(p => p.PurchaseOrderLine)
            .HasForeignKey<PurchaseOrderLine>(d => d.PurchaseRequestLineId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorderlines_ibfk_2");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Purchaseorderlines)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorderlines_ibfk_3");

        entity.HasOne(d => d.Unit).WithMany(p => p.Purchaseorderlines)
            .HasForeignKey(d => d.UnitId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("purchaseorderlines_ibfk_4");
    }
}

internal sealed class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> entity)
    {
        entity.HasKey(e => e.SupplierId).HasName("PRIMARY");

        entity.ToTable("suppliers");

        entity.HasIndex(e => e.SupplierCode, "supplierCode").IsUnique();

        entity.Property(e => e.SupplierId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("supplierId");
        entity.Property(e => e.Address)
            .HasMaxLength(255)
            .HasColumnName("address");
        entity.Property(e => e.ContactName)
            .HasMaxLength(150)
            .HasColumnName("contactName");
        entity.Property(e => e.DebtPolicy)
            .HasColumnType("text")
            .HasColumnName("debtPolicy");
        entity.Property(e => e.InvoicePolicy)
            .HasColumnType("text")
            .HasColumnName("invoicePolicy");
        entity.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValueSql("'1'")
            .HasColumnName("isActive");
        entity.Property(e => e.Phone)
            .HasMaxLength(30)
            .HasColumnName("phone");
        entity.Property(e => e.SupplierCode)
            .HasMaxLength(50)
            .HasColumnName("supplierCode");
        entity.Property(e => e.SupplierName)
            .HasMaxLength(200)
            .HasColumnName("supplierName");
    }
}

internal sealed class SupplierQuotationConfiguration : IEntityTypeConfiguration<SupplierQuotation>
{
    public void Configure(EntityTypeBuilder<SupplierQuotation> entity)
    {
        entity.HasKey(e => e.QuotationId).HasName("PRIMARY");

        entity.ToTable("supplierquotations");

        entity.HasIndex(e => new { e.SupplierId, e.IngredientId, e.EffectiveFrom }, "ixSupplierQuotationsSupplierIngredientEffective");

        entity.HasIndex(e => e.IngredientId, "ixSupplierQuotationsIngredient");

        entity.Property(e => e.QuotationId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("quotationId");
        entity.Property(e => e.SupplierId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("supplierId");
        entity.Property(e => e.IngredientId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("ingredientId");
        entity.Property(e => e.UnitPrice)
            .HasPrecision(18, 2)
            .HasColumnName("unitPrice");
        entity.Property(e => e.EffectiveFrom)
            .HasColumnName("effectiveFrom");
        entity.Property(e => e.EffectiveTo)
            .HasColumnName("effectiveTo");
        entity.Property(e => e.Note)
            .HasMaxLength(255)
            .HasColumnName("note");
        entity.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValueSql("'1'")
            .HasColumnName("isActive");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("updatedAt");

        entity.HasOne(d => d.Supplier).WithMany(p => p.Supplierquotations)
            .HasForeignKey(d => d.SupplierId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("supplierquotations_ibfk_1");

        entity.HasOne(d => d.Ingredient).WithMany(p => p.Supplierquotations)
            .HasForeignKey(d => d.IngredientId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("supplierquotations_ibfk_2");
    }
}
