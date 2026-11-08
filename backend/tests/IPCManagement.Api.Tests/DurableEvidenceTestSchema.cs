using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

internal static class DurableEvidenceTestSchema
{
    public static async Task CreateAsync(IpcManagementContext context)
    {
        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.CommandText = """
            CREATE TABLE businessevidencepackages (packageId BLOB PRIMARY KEY, schemaVersion INTEGER NOT NULL, issueType TEXT NOT NULL, subjectId BLOB NOT NULL, sourceFingerprint TEXT NOT NULL, manifestUtf8 BLOB NOT NULL, manifestSha256 TEXT NOT NULL, sourceDatabase TEXT NOT NULL, migrationHead TEXT NOT NULL, decision TEXT NOT NULL, outcomeEntityType TEXT NULL, outcomeEntityId BLOB NULL, commandId TEXT NOT NULL, createdAtUtc TEXT NOT NULL, expiresAtUtc TEXT NULL, version INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE businessevidenceattestations (attestationId BLOB PRIMARY KEY, packageId BLOB NOT NULL, authoritySlot TEXT NOT NULL, actorId BLOB NOT NULL, authorityReference TEXT NOT NULL, authoritySha256 TEXT NOT NULL, manifestSha256 TEXT NOT NULL, attestedAtUtc TEXT NOT NULL, expiresAtUtc TEXT NULL);
            CREATE TABLE dataqualitydispositions (dispositionId BLOB PRIMARY KEY, issueType TEXT NOT NULL, sourceEntityId BLOB NOT NULL, sourceFingerprint TEXT NOT NULL, proposedAction TEXT NOT NULL, evidenceJson TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, reviewReason TEXT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, reviewedBy BLOB NULL, reviewedAt TEXT NULL, appliedBy BLOB NULL, appliedAt TEXT NULL, correctionEntityType TEXT NULL, correctionEntityId BLOB NULL, version INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE lifecycletransitions (transitionId BLOB PRIMARY KEY, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, commandId TEXT NOT NULL, aggregateSequence INTEGER NOT NULL, fromState TEXT NULL, toState TEXT NOT NULL, actorId BLOB NULL, expectedVersion INTEGER NOT NULL, reason TEXT NULL, correlationId TEXT NULL, causationId TEXT NULL, payloadJson TEXT NOT NULL, schemaVersion INTEGER NOT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE lifecyclecommandreceipts (commandReceiptId BLOB PRIMARY KEY, commandId TEXT NOT NULL, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, responseJson TEXT NOT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE lifecycleoutboxmessages (outboxMessageId BLOB PRIMARY KEY, eventType TEXT NOT NULL, aggregateType TEXT NOT NULL, aggregateId BLOB NOT NULL, aggregateSequence INTEGER NOT NULL, commandId TEXT NOT NULL, payloadJson TEXT NOT NULL, status TEXT NOT NULL, attemptCount INTEGER NOT NULL DEFAULT 0, nextAttemptAt TEXT NULL, lockedAt TEXT NULL, processedAt TEXT NULL, lastError TEXT NULL, createdAt TEXT NOT NULL);
            CREATE TABLE auditlogs (auditId BLOB PRIMARY KEY, businessArea TEXT NOT NULL, changedAt TEXT NOT NULL, changedBy BLOB NOT NULL, entityName TEXT NOT NULL, entityId BLOB NOT NULL, fieldName TEXT NOT NULL, newValue TEXT NULL, oldValue TEXT NULL, reason TEXT NULL, correlationId TEXT NULL);
            """;
        await command.ExecuteNonQueryAsync();
    }
}
