using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SystemOperation.Services;

public sealed class SystemOperationModeGuard(IpcManagementContext context)
{
    public async Task<SystemOperationSnapshot> ReadRequiredAsync(CancellationToken cancellationToken = default)
    {
        var rows = await context.Systemoperationmodes.AsNoTracking().Take(2).ToListAsync(cancellationToken);
        if (rows.Count != 1 || rows[0].Id != 1 || rows[0].Version < 1 || !SystemOperationEligibility.IsValidMode(rows[0].Mode))
            throw new SystemOperationAuthorityException("Cấu hình chế độ vận hành không hợp lệ.");
        var row = rows[0];
        return new(row.Mode, row.Version, row.UpdatedAt);
    }

    public async Task ValidateAsync(string operationKey, long expectedVersion, OperationDisposition disposition, CancellationToken cancellationToken = default)
    {
        var snapshot = await ReadRequiredAsync(cancellationToken);
        if (snapshot.Version != expectedVersion)
            throw new SystemOperationConflictException("Chế độ vận hành đã thay đổi. Vui lòng tải lại và kiểm tra thao tác.");
        if (!SystemOperationEligibility.IsAllowed(snapshot.Mode, disposition))
            throw new SystemOperationUnavailableException("Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.");
    }
}

public sealed record SystemOperationSnapshot(string Mode, long Version, DateTime UpdatedAt);
public sealed class SystemOperationAuthorityException(string message) : InvalidOperationException(message);
public sealed class SystemOperationUnavailableException(string message) : InvalidOperationException(message);
public sealed class SystemOperationConflictException(string message) : InvalidOperationException(message);
