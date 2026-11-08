using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SystemOperation.Services;

public sealed class SystemOperationModeInitializer(IpcManagementContext context, IEfTransactionRunner transactions)
{
    public async Task<InitializationResult> InitializeAsync(string actorId, CancellationToken cancellationToken = default)
    {
        var actor = GuidHelper.ParseGuidString(actorId) ?? throw new ArgumentException("actorId must be a valid GUID", nameof(actorId));
        try
        {
            return await transactions.ExecuteAsync(
                async operationToken =>
                {
                    var existing = await ReadAuthorityAsync(operationToken);
                    if (existing is not null) return new InitializationResult(false, existing.Mode, existing.Version);

                    var created = new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1, UpdatedBy = actor, UpdatedAt = DateTime.UtcNow, Reason = "Khởi tạo chế độ vận hành mặc định" };
                    context.Systemoperationmodes.Add(created);
                    await context.SaveChangesAsync(operationToken);
                    return new InitializationResult(true, created.Mode, created.Version);
                },
                verifySucceeded: async verifyToken => await ReadAuthorityAsync(verifyToken) is not null,
                cancellationToken: cancellationToken);
        }
        catch (DbUpdateException insertError)
        {
            // A concurrent request may have won the singleton insert. Accept only the exact,
            // valid authority produced by that winner; zero, malformed, or multiple rows fail closed.
            context.ChangeTracker.Clear();
            for (var attempt = 0; attempt < 5; attempt++)
            {
                var winner = await ReadAuthorityAsync(cancellationToken);
                if (winner is not null) return new InitializationResult(false, winner.Mode, winner.Version);
                if (attempt < 4) await Task.Delay(TimeSpan.FromMilliseconds(20), cancellationToken);
            }
            throw new SystemOperationAuthorityException($"Không thể xác nhận chế độ vận hành sau khởi tạo đồng thời: {insertError.Message}");
        }
    }

    private async Task<SystemOperationMode?> ReadAuthorityAsync(CancellationToken cancellationToken)
    {
        context.ChangeTracker.Clear();
        var rows = await context.Systemoperationmodes.AsNoTracking().Take(2).ToListAsync(cancellationToken);
        if (rows.Count > 1) throw new SystemOperationAuthorityException("Có nhiều hơn một dòng chế độ vận hành.");
        if (rows.Count == 0) return null;
        var row = rows[0];
        if (row.Id != 1 || row.Version < 1 || !SystemOperationEligibility.IsValidMode(row.Mode))
            throw new SystemOperationAuthorityException("Dòng chế độ vận hành hiện có không hợp lệ.");
        return row;
    }
}

public sealed record InitializationResult(bool Inserted, string Mode, long Version);
