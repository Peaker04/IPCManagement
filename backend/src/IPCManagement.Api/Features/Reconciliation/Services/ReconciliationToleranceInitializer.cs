using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationToleranceInitializer(IpcManagementContext context, IEfTransactionRunner transactions)
{
    public async Task<ReconciliationToleranceInitializationResult> InitializeAsync(string actorId, CancellationToken cancellationToken = default)
    {
        var actor = GuidHelper.ParseGuidString(actorId) ?? throw new ArgumentException("actorId must be a valid GUID", nameof(actorId));
        try
        {
            return await transactions.ExecuteAsync(
                async operationToken =>
                {
                    var existing = await ReadAuthorityAsync(operationToken);
                    if (existing is not null) return Result(false, existing);

                    var created = new ReconciliationTolerance
                    {
                        ToleranceId = GuidHelper.NewId(),
                        ScopeKind = ReconciliationToleranceAuthority.SystemDefaultScope,
                        ScopeId = null,
                        Value = ReconciliationToleranceAuthority.SystemDefaultValue,
                        Version = ReconciliationToleranceAuthority.SystemDefaultVersion,
                        CreatedBy = actor,
                        CreatedAt = DateTime.UtcNow
                    };
                    context.Reconciliationtolerances.Add(created);
                    await context.SaveChangesAsync(operationToken);
                    return Result(true, created);
                },
                verifySucceeded: async verifyToken => await ReadAuthorityAsync(verifyToken) is not null,
                cancellationToken: cancellationToken);
        }
        catch (DbUpdateException insertError)
        {
            context.ChangeTracker.Clear();
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var winner = await ReadAuthorityAsync(cancellationToken);
                if (winner is not null) return Result(false, winner);
                if (attempt < 4) await Task.Delay(TimeSpan.FromMilliseconds(20), cancellationToken);
            }
            throw new ReconciliationToleranceAuthorityException("Không thể khởi tạo dung sai mặc định hệ thống.", insertError);
        }
    }

    private async Task<ReconciliationTolerance?> ReadAuthorityAsync(CancellationToken cancellationToken)
    {
        context.ChangeTracker.Clear();
        var rows = await context.Reconciliationtolerances.AsNoTracking()
            .Where(row => row.ScopeKind == ReconciliationToleranceAuthority.SystemDefaultScope)
            .Take(2)
            .ToListAsync(cancellationToken);
        return ReconciliationToleranceAuthority.ReadSystemDefault(rows);
    }

    private static ReconciliationToleranceInitializationResult Result(bool inserted, ReconciliationTolerance row) =>
        new(inserted, row.ScopeKind, row.Value, row.Version, GuidHelper.ToGuidString(row.CreatedBy), row.CreatedAt);
}

public sealed record ReconciliationToleranceInitializationResult(
    bool Inserted,
    string ScopeKind,
    decimal Value,
    long Version,
    string CreatedBy,
    DateTime CreatedAt);

public sealed class ReconciliationToleranceAuthorityException : InvalidOperationException
{
    public ReconciliationToleranceAuthorityException(string message) : base(message) { }
    public ReconciliationToleranceAuthorityException(string message, Exception innerException) : base(message, innerException) { }
}
