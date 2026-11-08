using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Migrations;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;

namespace IPCManagement.Api.Tests;

public sealed class CustomerWeekMenuTierIntegrityTests
{
    [Fact]
    public async Task RequireAsync_Should_ReuseSameTierAndRejectConflictWithoutChangingCanonicalRow()
    {
        await using var connection = await OpenDatabaseAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();
        var week = new DateOnly(2026, 8, 3);

        var created = await CustomerWeekMenuTierInvariant.RequireAsync(context, customerId, week, 25000m);
        await context.SaveChangesAsync();
        var reused = await CustomerWeekMenuTierInvariant.RequireAsync(context, customerId, week, 25000m);

        reused.TierId.Should().Equal(created.TierId);
        var conflict = () => CustomerWeekMenuTierInvariant.RequireAsync(context, customerId, week, 30000m);
        await conflict.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đã khóa định mức 25,000*không thể gán định mức 30,000*rollback/xóa toàn bộ lịch DRAFT*");
        var canonical = await context.Customerweekmenutiers.AsNoTracking().SingleAsync();
        canonical.PriceTierAmount.Should().Be(25000m);
    }

    [Fact]
    public async Task DatabaseUniqueScope_Should_RejectSecondTierForSameCustomerWeek()
    {
        await using var connection = await OpenDatabaseAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        await using var context = new IpcManagementContext(options);
        var customerId = GuidHelper.NewId();
        var week = new DateOnly(2026, 8, 3);
        context.Customerweekmenutiers.Add(Tier(customerId, week, 25000m));
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        context.Customerweekmenutiers.Add(Tier(customerId, week, 30000m));

        var conflict = () => context.SaveChangesAsync();

        await conflict.Should().ThrowAsync<DbUpdateException>();
        context.ChangeTracker.Clear();
        (await context.Customerweekmenutiers.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Customerweekmenutiers.AsNoTracking().SingleAsync()).PriceTierAmount.Should().Be(25000m);
    }

    [Fact]
    public void Migration_Should_BackfillDistinctTiersBeforeFkAndInstallDatabaseGuards()
    {
        var operations = new InspectableMigration().BuildUp();
        var sql = string.Join("\n", operations.OfType<SqlOperation>().Select(item => item.Sql));
        var backfillIndex = operations.FindIndex(item =>
            item is SqlOperation operation && operation.Sql.Contains("INSERT INTO `customerweekmenutiers`"));
        var foreignKeyIndex = operations.FindIndex(item =>
            item is AddForeignKeyOperation operation && operation.Name == "menuschedules_customerweek_tier_fk");

        backfillIndex.Should().BeGreaterThan(-1);
        foreignKeyIndex.Should().BeGreaterThan(backfillIndex);
        sql.Should().Contain("GROUP BY `customerId`, `weekStartDate`, `menuPrice`");
        sql.Should().Contain("trg_menuschedules_tier_insert");
        sql.Should().Contain("trg_menuschedules_tier_update");
        sql.Should().Contain("trg_customerweekmenutiers_immutable_update");
        sql.Should().Contain("SIGNAL SQLSTATE '45000'");
    }

    private static CustomerWeekMenuTier Tier(byte[] customerId, DateOnly week, decimal amount)
        => new()
        {
            TierId = GuidHelper.NewId(),
            CustomerId = customerId,
            WeekStartDate = week,
            PriceTierAmount = amount,
            CreatedAt = DateTime.UtcNow
        };

    private static async Task<SqliteConnection> OpenDatabaseAsync()
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE customerweekmenutiers (
                tierId BLOB NOT NULL PRIMARY KEY,
                customerId BLOB NOT NULL,
                weekStartDate TEXT NOT NULL,
                priceTierAmount TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                CONSTRAINT uqCustomerWeekMenuTiersScope UNIQUE (customerId, weekStartDate)
            );
            CREATE TABLE menuschedules (
                menuScheduleId BLOB NOT NULL PRIMARY KEY,
                customerId BLOB NOT NULL,
                weekStartDate TEXT NOT NULL,
                menuPrice TEXT NOT NULL
            );
            """;
        await command.ExecuteNonQueryAsync();
        return connection;
    }

    private sealed class InspectableMigration : AddCustomerWeekMenuTier
    {
        public List<MigrationOperation> BuildUp()
        {
            var builder = new MigrationBuilder("Pomelo.EntityFrameworkCore.MySql");
            Up(builder);
            return builder.Operations;
        }
    }
}
