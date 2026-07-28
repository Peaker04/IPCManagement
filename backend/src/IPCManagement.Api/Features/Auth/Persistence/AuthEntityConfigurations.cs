using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IPCManagement.Api.Features.Auth.Persistence;

internal sealed class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> entity)
    {
        entity.HasKey(e => e.RoleId).HasName("PRIMARY");

        entity.ToTable("roles");

        entity.HasIndex(e => e.RoleCode, "roleCode").IsUnique();

        entity.Property(e => e.RoleId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("roleId");
        entity.Property(e => e.RoleCode)
            .HasMaxLength(50)
            .HasColumnName("roleCode");
        entity.Property(e => e.RoleName)
            .HasMaxLength(100)
            .HasColumnName("roleName");
    }
}

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> entity)
    {
        entity.HasKey(e => e.UserId).HasName("PRIMARY");

        entity.ToTable("users");

        entity.HasIndex(e => e.RoleId, "roleId");

        entity.HasIndex(e => e.Username, "username").IsUnique();

        entity.Property(e => e.UserId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("userId");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");
        entity.Property(e => e.FullName)
            .HasMaxLength(150)
            .HasColumnName("fullName");
        entity.Property(e => e.IsActive)
            .IsRequired()
            .HasDefaultValueSql("'1'")
            .HasColumnName("isActive");
        entity.Property(e => e.PasswordHash)
            .HasMaxLength(255)
            .HasColumnName("passwordHash");
        entity.Property(e => e.RoleId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("roleId");
        entity.Property(e => e.Username)
            .HasMaxLength(100)
            .HasColumnName("username");

        entity.HasOne(d => d.Role).WithMany(p => p.Users)
            .HasForeignKey(d => d.RoleId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("users_ibfk_1");
    }
}

internal sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> entity)
    {
        entity.HasKey(e => e.TokenId).HasName("PRIMARY");

        entity.ToTable("refreshtokens");

        entity.HasIndex(e => new { e.UserId, e.ExpiresAt }, "ixRefreshTokensUserExpiry");
        entity.HasIndex(e => e.TokenHash, "ixRefreshTokensHash").IsUnique();

        entity.Property(e => e.TokenId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("tokenId");

        entity.Property(e => e.UserId)
            .HasMaxLength(16)
            .IsFixedLength()
            .HasColumnName("userId");

        entity.Property(e => e.TokenHash)
            .HasMaxLength(64)
            .IsFixedLength()
            .HasColumnName("tokenHash");

        entity.Property(e => e.DeviceInfo)
            .HasMaxLength(200)
            .HasDefaultValue(string.Empty)
            .HasColumnName("deviceInfo");

        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("CURRENT_TIMESTAMP")
            .HasColumnType("datetime")
            .HasColumnName("createdAt");

        entity.Property(e => e.ExpiresAt)
            .HasColumnType("datetime")
            .HasColumnName("expiresAt");

        entity.Property(e => e.IsUsed)
            .HasDefaultValue(false)
            .HasColumnName("isUsed");

        entity.Property(e => e.IsRevoked)
            .HasDefaultValue(false)
            .HasColumnName("isRevoked");

        entity.Property(e => e.RevokedAt)
            .HasColumnType("datetime")
            .HasColumnName("revokedAt");

        entity.Property(e => e.ReplacedByToken)
            .HasMaxLength(64)
            .HasColumnName("replacedByToken");

        entity.HasOne(d => d.User)
            .WithMany(p => p.Refreshtokens)
            .HasForeignKey(d => d.UserId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("refreshtokens_ibfk_1");
    }
}
