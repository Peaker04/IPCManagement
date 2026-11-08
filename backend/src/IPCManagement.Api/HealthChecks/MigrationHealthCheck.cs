using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IPCManagement.Api.HealthChecks;

/// <summary>
/// Readiness check: database có đang tụt hậu so với chuỗi migration trong code không.
///
/// Lý do tồn tại: ngày 27/07/2026 phát hiện database chính thiếu migration
/// 20260726120000_AddStocktakeActiveWarehouseUnique mà không có bất kỳ tín hiệu nào —
/// app vẫn chạy, test vẫn xanh, chỉ lộ ra khi có người đi dò tay. Check này biến lỗi
/// im lặng đó thành lỗi nhìn thấy được trên <c>/health/ready</c>.
///
/// Pending migrations make the runtime schema incompatible with the current EF model.
/// Readiness therefore returns <see cref="HealthStatus.Unhealthy"/> so callers cannot
/// route traffic to endpoints that would otherwise fail with missing-table/column errors.
/// </summary>
public sealed class MigrationHealthCheck : IHealthCheck
{
    /// <summary>Số ID hiển thị tối đa để mô tả không phình khi tồn đọng nhiều.</summary>
    private const int MaxListedMigrations = 5;

    private readonly IpcManagementContext _context;
    private readonly ILogger<MigrationHealthCheck> _logger;

    public MigrationHealthCheck(IpcManagementContext context, ILogger<MigrationHealthCheck> logger)
    {
        _context = context;
        _logger  = logger;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var pending = await _context.Database.GetPendingMigrationsAsync(cancellationToken);
            return BuildResult(pending);
        }
        catch (Exception ex)
        {
            // Không để exception thoát ra ngoài: readiness luôn phải trả về một trạng thái.
            // MySQL chết thì check "database" đã báo Unhealthy rồi, check này không nhân đôi
            // mức nghiêm trọng đó.
            _logger.LogError(ex, "Không đọc được danh sách migration chưa áp dụng");
            return HealthCheckResult.Unhealthy("Không đọc được danh sách migration chưa áp dụng.", ex);
        }
    }

    internal static HealthCheckResult BuildResult(IEnumerable<string> pendingMigrations)
    {
        var pending = pendingMigrations.ToArray();
        if (pending.Length == 0)
        {
            return HealthCheckResult.Healthy("Database đã chạy hết migration.");
        }

        var listed = string.Join(", ", pending.Take(MaxListedMigrations));
        var suffix = pending.Length > MaxListedMigrations
            ? $" (và {pending.Length - MaxListedMigrations} migration nữa)"
            : string.Empty;

        return HealthCheckResult.Unhealthy(
            $"Database thiếu {pending.Length} migration chưa chạy: {listed}{suffix}. " +
            "Chạy \"dotnet ef database update\" để đồng bộ.");
    }
}
