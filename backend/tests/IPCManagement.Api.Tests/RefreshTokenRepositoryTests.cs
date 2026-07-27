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
    public async Task CleanupExpiredForUserAsync_Should_BeIdempotentAcrossCompetingContexts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .Options;

        var userId = GuidHelper.NewId();
        await using (var createTable = connection.CreateCommand())
        {
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

    private static RefreshToken CreateToken(byte[] userId, char hashCharacter, DateTime expiresAt)
        => new()
        {
            TokenId = GuidHelper.NewId(),
            UserId = userId,
            TokenHash = new string(hashCharacter, 64),
            DeviceInfo = "parallel-e2e",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = expiresAt,
            IsUsed = false,
            IsRevoked = false
        };
}
