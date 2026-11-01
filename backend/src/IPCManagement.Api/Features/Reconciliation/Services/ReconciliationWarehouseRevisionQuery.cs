using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed record ReconciliationWarehouseRevisionStamp(
    DateTime AppliedAt,
    string? AppliedByName,
    string? AppliedByRole);

internal sealed class ReconciliationWarehouseRevisionQuery(IpcManagementContext context)
{
    public async Task<IReadOnlyDictionary<DateOnly, ReconciliationWarehouseRevisionStamp>> GetLatestByDateAsync(
        byte[] batchId,
        CancellationToken token)
    {
        if (context.Model.FindEntityType(typeof(ReconciliationSourceRevision)) is null
            || !await HasSourceRevisionTablesAsync(token))
            return new Dictionary<DateOnly, ReconciliationWarehouseRevisionStamp>();

        var inMemory = string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);
        var revisions = inMemory
            ? (await context.Reconciliationsourcerevisions.AsNoTracking().ToListAsync(token))
                .Where(item => item.BatchId.SequenceEqual(batchId) && item.Status == "APPLIED").ToList()
            : await context.Reconciliationsourcerevisions.AsNoTracking()
                .Where(item => item.BatchId == batchId && item.Status == "APPLIED").ToListAsync(token);
        var revisionIds = revisions.Select(item => item.SourceRevisionId).ToList();
        if (revisionIds.Count == 0)
            return new Dictionary<DateOnly, ReconciliationWarehouseRevisionStamp>();

        var revisionDeltas = inMemory
            ? (await context.Reconciliationsourcedeltas.AsNoTracking().ToListAsync(token))
                .Where(item => revisionIds.Any(idValue => idValue.SequenceEqual(item.SourceRevisionId))).ToList()
            : await context.Reconciliationsourcedeltas.AsNoTracking()
                .Where(item => revisionIds.Contains(item.SourceRevisionId)).ToListAsync(token);
        var revisionById = revisions.ToDictionary(
            item => Convert.ToHexString(item.SourceRevisionId),
            StringComparer.Ordinal);
        var actorIds = revisions.Select(item => item.AppliedBy)
            .DistinctBy(Convert.ToHexString)
            .ToList();
        var actorNames = new Dictionary<string, string>(StringComparer.Ordinal);
        if (actorIds.Count > 0 && context.Model.FindEntityType(typeof(User)) is not null)
        {
            var actors = inMemory
                ? (await context.Users.AsNoTracking().ToListAsync(token))
                    .Where(item => actorIds.Any(idValue => idValue.SequenceEqual(item.UserId))).ToList()
                : await context.Users.AsNoTracking()
                    .Where(item => actorIds.Contains(item.UserId)).ToListAsync(token);
            actorNames = actors.ToDictionary(
                item => Convert.ToHexString(item.UserId),
                item => item.FullName,
                StringComparer.Ordinal);
        }

        return revisionDeltas
            .Select(delta => new
            {
                delta.ServiceDate,
                Revision = revisionById[Convert.ToHexString(delta.SourceRevisionId)]
            })
            .GroupBy(item => item.ServiceDate)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var revision = group.OrderByDescending(item => item.Revision.AppliedAt)
                        .ThenByDescending(item => item.Revision.RevisionNumber)
                        .First().Revision;
                    return new ReconciliationWarehouseRevisionStamp(
                        revision.AppliedAt,
                        actorNames.GetValueOrDefault(Convert.ToHexString(revision.AppliedBy)),
                        revision.AppliedByRole);
                });
    }

    private async Task<bool> HasSourceRevisionTablesAsync(CancellationToken token)
    {
        if (!string.Equals(
                context.Database.ProviderName,
                "Microsoft.EntityFrameworkCore.Sqlite",
                StringComparison.Ordinal))
            return true;

        var connection = context.Database.GetDbConnection();
        var shouldClose = connection.State == ConnectionState.Closed;
        if (shouldClose) await connection.OpenAsync(token);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('reconciliationsourcerevisions', 'reconciliationsourcedeltas')";
            return Convert.ToInt32(await command.ExecuteScalarAsync(token)) == 2;
        }
        finally
        {
            if (shouldClose) await connection.CloseAsync();
        }
    }
}
