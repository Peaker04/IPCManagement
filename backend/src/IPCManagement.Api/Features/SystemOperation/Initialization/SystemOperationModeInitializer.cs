using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SystemOperation.Initialization;

public sealed class SystemOperationModeInitializer(IpcManagementContext context)
{
    public async Task<InitializationResult> InitializeAsync(string actorId, CancellationToken cancellationToken = default)
    {
        var actor = GuidHelper.ParseGuidString(actorId) ?? throw new ArgumentException("actorId must be a valid GUID", nameof(actorId));
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var rows = await context.Systemoperationmodes.Take(2).ToListAsync(cancellationToken);
        if (rows.Count > 1) throw new SystemOperationAuthorityException("Có nhiều hơn một dòng chế độ vận hành.");
        if (rows.Count == 1)
        {
            var row = rows[0];
            if (row.Id != 1 || row.Version < 1 || !SystemOperationEligibility.IsValidMode(row.Mode)) throw new SystemOperationAuthorityException("Dòng chế độ vận hành hiện có không hợp lệ.");
            await transaction.CommitAsync(cancellationToken);
            return new(false, row.Mode, row.Version);
        }
        var created = new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1, UpdatedBy = actor, UpdatedAt = DateTime.UtcNow, Reason = "Khởi tạo chế độ vận hành mặc định" };
        context.Systemoperationmodes.Add(created);
        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new(true, created.Mode, created.Version);
    }
}

public sealed record InitializationResult(bool Inserted, string Mode, long Version);
