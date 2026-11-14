using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

/// <summary>
/// Serializes catalog writers for one existing unit within their transaction.
/// Every path that creates an ingredient must acquire this lock before checking name identity.
/// </summary>
internal static class IngredientUnitLock
{
    public static async Task AcquireAsync(IpcManagementContext context, byte[] unitId, CancellationToken cancellationToken = default)
    {
        // SQLite/in-memory are used by source-contract tests; the live uniqueness oracle runs on MySQL.
        if (!string.Equals(context.Database.ProviderName, "Pomelo.EntityFrameworkCore.MySql", StringComparison.Ordinal)) return;

        var unit = await context.Units
            .FromSqlInterpolated($"SELECT * FROM units WHERE unitId = {unitId} FOR UPDATE")
            .AsNoTracking()
            .SingleOrDefaultAsync(cancellationToken);
        if (unit is null) throw new BusinessRuleException("Đơn vị tính nguyên liệu không tồn tại.");
    }
}
