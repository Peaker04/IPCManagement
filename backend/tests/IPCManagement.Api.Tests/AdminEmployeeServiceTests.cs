using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Admin;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services.Admin;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IPCManagement.Api.Tests;

public class AdminEmployeeServiceTests
{
    [Fact]
    public async Task UpdateAsync_Should_UpdateFields_And_CreateAuditLogs()
    {
        // Arrange
        await using var fixture = await AdminEmployeeFixture.CreateAsync();
        var service = new AdminEmployeeService(fixture.Context);

        var employeeIdStr = GuidHelper.ToGuidString(fixture.EmployeeId);
        var adminIdStr = GuidHelper.ToGuidString(fixture.AdminId);
        var newRoleIdStr = GuidHelper.ToGuidString(fixture.ChefRoleId);

        var request = new UpdateEmployeeDto
        {
            FullName = "New Full Name",
            Username = "updated_username",
            RoleId = newRoleIdStr,
            IsActive = false,
            Password = "newpassword"
        };

        // Act
        var result = await service.UpdateAsync(employeeIdStr, request, adminIdStr);

        // Assert
        result.Should().NotBeNull();
        result!.FullName.Should().Be("New Full Name");
        result.Username.Should().Be("updated_username");
        result.RoleId.Should().Be(newRoleIdStr);
        result.IsActive.Should().BeFalse();

        // Verify DB updates
        var updatedUser = await fixture.Context.Users.FirstAsync(u => u.UserId == fixture.EmployeeId);
        updatedUser.FullName.Should().Be("New Full Name");
        updatedUser.Username.Should().Be("updated_username");
        updatedUser.RoleId.Should().Equal(fixture.ChefRoleId);
        updatedUser.IsActive.Should().BeFalse();
        BCrypt.Net.BCrypt.Verify("newpassword", updatedUser.PasswordHash).Should().BeTrue();

        // Verify Audit Logs
        var auditLogs = await fixture.Context.Auditlogs
            .Where(a => a.EntityId == fixture.EmployeeId)
            .ToListAsync();

        auditLogs.Should().HaveCount(5); // FullName, Username, RoleId, IsActive, Password
        auditLogs.Should().OnlyContain(a => a.ChangedBy.SequenceEqual(fixture.AdminId));
        auditLogs.Should().OnlyContain(a => a.BusinessArea == "Admin");
        auditLogs.Should().OnlyContain(a => a.EntityName == "User");
        
        auditLogs.Should().ContainSingle(a => a.FieldName == "FullName" && a.NewValue == "New Full Name");
        auditLogs.Should().ContainSingle(a => a.FieldName == "Username" && a.NewValue == "updated_username");
        auditLogs.Should().ContainSingle(a => a.FieldName == "RoleId" && a.NewValue == newRoleIdStr);
        auditLogs.Should().ContainSingle(a => a.FieldName == "IsActive" && a.NewValue == "False");
        auditLogs.Should().ContainSingle(a => a.FieldName == "PasswordHash");
    }

    [Fact]
    public async Task UpdateStatusAsync_Should_UpdateStatus_And_CreateAuditLog()
    {
        // Arrange
        await using var fixture = await AdminEmployeeFixture.CreateAsync();
        var service = new AdminEmployeeService(fixture.Context);

        var employeeIdStr = GuidHelper.ToGuidString(fixture.EmployeeId);
        var adminIdStr = GuidHelper.ToGuidString(fixture.AdminId);

        var request = new UpdateEmployeeStatusDto { IsActive = false };

        // Act
        var result = await service.UpdateStatusAsync(employeeIdStr, request, adminIdStr);

        // Assert
        result.Should().NotBeNull();
        result!.IsActive.Should().BeFalse();

        // Verify Audit Log
        var audit = await fixture.Context.Auditlogs
            .FirstOrDefaultAsync(a => a.EntityId == fixture.EmployeeId && a.FieldName == "IsActive");

        audit.Should().NotBeNull();
        audit!.ChangedBy.Should().Equal(fixture.AdminId);
        audit.NewValue.Should().Be("False");
        audit.Reason.Should().Be("Khóa tài khoản nhân viên.");
    }

    private sealed class AdminEmployeeFixture(
        SqliteConnection connection,
        IpcManagementContext context) : IAsyncDisposable
    {
        public IpcManagementContext Context { get; } = context;
        public byte[] AdminId { get; private set; } = null!;
        public byte[] EmployeeId { get; private set; } = null!;
        public byte[] AdminRoleId { get; private set; } = null!;
        public byte[] ChefRoleId { get; private set; } = null!;

        public static async Task<AdminEmployeeFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;
            var context = new IpcManagementContext(options);
            await CreateSchemaAsync(connection);

            var adminRoleId = GuidHelper.ToBytes(Guid.Parse("00000000-0000-0000-0000-000000000001"));
            var chefRoleId = GuidHelper.ToBytes(Guid.Parse("00000000-0000-0000-0000-000000000004"));

            context.Roles.AddRange(
                new Role { RoleId = adminRoleId, RoleCode = "ADMIN", RoleName = "Admin" },
                new Role { RoleId = chefRoleId, RoleCode = "CHEF", RoleName = "Bếp trưởng" }
            );

            var adminId = GuidHelper.NewId();
            var employeeId = GuidHelper.NewId();

            context.Users.AddRange(
                new User
                {
                    UserId = adminId,
                    FullName = "Admin Account",
                    Username = "admin",
                    PasswordHash = "hashed",
                    RoleId = adminRoleId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                },
                new User
                {
                    UserId = employeeId,
                    FullName = "Test Employee",
                    Username = "emp1",
                    PasswordHash = "hashed",
                    RoleId = adminRoleId, // Start as Admin role for update tests
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                }
            );

            await context.SaveChangesAsync();

            var fixture = new AdminEmployeeFixture(connection, context)
            {
                AdminId = adminId,
                EmployeeId = employeeId,
                AdminRoleId = adminRoleId,
                ChefRoleId = chefRoleId
            };
            return fixture;
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }

        private static async Task CreateSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE roles (
                    roleId BLOB PRIMARY KEY,
                    roleCode TEXT NOT NULL,
                    roleName TEXT NOT NULL
                );

                CREATE TABLE users (
                    userId BLOB PRIMARY KEY,
                    fullName TEXT NOT NULL,
                    username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL,
                    roleId BLOB NOT NULL,
                    isActive INTEGER NULL,
                    createdAt TEXT NOT NULL
                );

                CREATE TABLE auditlogs (
                    auditId BLOB PRIMARY KEY,
                    changedAt TEXT NOT NULL,
                    changedBy BLOB NOT NULL,
                    businessArea TEXT NOT NULL,
                    entityName TEXT NOT NULL,
                    entityId BLOB NULL,
                    fieldName TEXT NULL,
                    oldValue TEXT NULL,
                    newValue TEXT NULL,
                    reason TEXT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
