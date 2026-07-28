using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Coordination.Persistence;

internal sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> entity)
    {
        entity.HasKey(e => e.CustomerId).HasName("PRIMARY");
        entity.ToTable("customers");
        entity.HasIndex(e => e.CustomerCode, "customerCode").IsUnique();
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.CustomerCode).HasMaxLength(50).HasColumnName("customerCode");
        entity.Property(e => e.CustomerName).HasMaxLength(200).HasColumnName("customerName");
        entity.Property(e => e.IsActive).IsRequired().HasDefaultValueSql("'1'").HasColumnName("isActive");
        entity.Property(e => e.Note).HasColumnType("text").HasColumnName("note");
    }
}

internal sealed class CustomerContractConfiguration : IEntityTypeConfiguration<CustomerContract>
{
    public void Configure(EntityTypeBuilder<CustomerContract> entity)
    {
        entity.HasKey(e => e.ContractId).HasName("PRIMARY");
        entity.ToTable("customercontracts");
        entity.HasIndex(e => e.CustomerId, "customerId");
        entity.HasIndex(e => new { e.CustomerId, e.EffectiveFrom, e.EffectiveTo }, "ixCustomerContractsEffective");
        entity.Property(e => e.ContractId).HasMaxLength(16).IsFixedLength().HasColumnName("contractId");
        entity.Property(e => e.ActiveWeekDays).HasMaxLength(100).HasColumnName("activeWeekDays");
        entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("createdAt");
        entity.Property(e => e.CustomerId).HasMaxLength(16).IsFixedLength().HasColumnName("customerId");
        entity.Property(e => e.DefaultBomRatePercent).HasPrecision(5, 2).HasDefaultValueSql("'100.00'").HasColumnName("defaultBomRatePercent");
        entity.Property(e => e.DefaultMenuPrice).HasPrecision(18, 2).HasColumnName("defaultMenuPrice");
        entity.Property(e => e.EffectiveFrom).HasColumnName("effectiveFrom");
        entity.Property(e => e.EffectiveTo).HasColumnName("effectiveTo");
        entity.Property(e => e.ShiftNames).HasMaxLength(100).HasColumnName("shiftNames");
        entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValueSql("'ACTIVE'").HasColumnName("status");
        entity.Property(e => e.UpdatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP").HasColumnType("datetime").HasColumnName("updatedAt");
        entity.HasOne(d => d.Customer).WithMany(p => p.Customercontracts)
            .HasForeignKey(d => d.CustomerId).OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("customercontracts_ibfk_1");
    }
}
