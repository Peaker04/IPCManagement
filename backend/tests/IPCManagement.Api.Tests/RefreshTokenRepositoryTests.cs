using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public class RefreshTokenRepositoryTests
{
    [Fact]
    public async Task PrepareForLoginAsync_Should_RemoveClosedSameDeviceAndSurplusActiveSessions()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseSqlite(connection).Options;
        var userId = GuidHelper.NewId();
        await CreateTableAsync(connection);

        await using (var setup = new IpcManagementContext(options))
        {
            setup.Refreshtokens.Add(CreateToken(userId, 'a', DateTime.UtcNow.AddMinutes(-1), "expired"));
            setup.Refreshtokens.Add(CreateToken(userId, 'b', DateTime.UtcNow.AddDays(1), "same-device"));
            for (var index = 0; index < 12; index++)
            {
                setup.Refreshtokens.Add(CreateToken(
                    userId,
                    (char)('c' + index),
                    DateTime.UtcNow.AddDays(1),
                    $"device-{index}",
                    DateTime.UtcNow.AddMinutes(index)));
            }
            await setup.SaveChangesAsync();
        }

        await using (var context = new IpcManagementContext(options))
        {
            await new RefreshTokenRepository(context).PrepareForLoginAsync(userId, "same-device", 9);
        }

        await using var verification = new IpcManagementContext(options);
        var remaining = await verification.Refreshtokens.AsNoTracking().ToListAsync();
        remaining.Should().HaveCount(9);
        remaining.Should().NotContain(token => token.DeviceInfo == "same-device");
        remaining.Should().OnlyContain(token => token.ExpiresAt >= DateTime.UtcNow && !token.IsUsed && !token.IsRevoked);
    }

    [Fact]
    public async Task CleanupExpiredForUserAsync_Should_BeIdempotentAcrossCompetingContexts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;

        var userId = GuidHelper.NewId();
        await CreateTableAsync(connection);

        await using (var setup = new IpcManagementContext(options))
        {
            setup.Refreshtokens.Add(CreateToken(userId, 'a', DateTime.UtcNow.AddMinutes(-1)));
            await setup.SaveChangesAsync();
        }

        await using var firstContext = new IpcManagementContext(options);
        await using var secondContext = new IpcManagementContext(options);
        var firstRepository = new RefreshTokenRepository(firstContext);
        var secondRepository = new RefreshTokenRepository(secondContext);

        await firstRepository.CleanupExpiredForUserAsync(userId);
        await secondRepository.CleanupExpiredForUserAsync(userId);

        firstRepository.Add(CreateToken(userId, 'b', DateTime.UtcNow.AddDays(1)));
        secondRepository.Add(CreateToken(userId, 'c', DateTime.UtcNow.AddDays(1)));

        await firstRepository.SaveChangesAsync();
        var secondSave = () => secondRepository.SaveChangesAsync();

        await secondSave.Should().NotThrowAsync();
        await using var verification = new IpcManagementContext(options);
        (await verification.Refreshtokens.CountAsync(token => token.UserId.SequenceEqual(userId)))
            .Should().Be(2);
    }

    private static async Task CreateTableAsync(SqliteConnection connection)
    {
        await using var createTable = connection.CreateCommand();
        createTable.CommandText = """
                CREATE TABLE refreshtokens (
                    tokenId BLOB NOT NULL PRIMARY KEY,
                    userId BLOB NOT NULL,
                    tokenHash TEXT NOT NULL UNIQUE,
                    deviceInfo TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    expiresAt TEXT NOT NULL,
                    isUsed INTEGER NOT NULL DEFAULT 0,
                    isRevoked INTEGER NOT NULL DEFAULT 0,
                    revokedAt TEXT NULL,
                    replacedByToken TEXT NULL
                );
                """;
        await createTable.ExecuteNonQueryAsync();
    }

    private static RefreshToken CreateToken(
        byte[] userId,
        char hashCharacter,
        DateTime expiresAt,
        string deviceInfo = "parallel-e2e",
        DateTime? createdAt = null)
        => new()
        {
            TokenId = GuidHelper.NewId(),
            UserId = userId,
            TokenHash = new string(hashCharacter, 64),
            DeviceInfo = deviceInfo,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            ExpiresAt = expiresAt,
            IsUsed = false,
            IsRevoked = false
        };
}
